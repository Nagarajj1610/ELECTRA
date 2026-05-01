import { GoogleGenerativeAI, type Content, type SafetySetting, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import NodeCache from 'node-cache';
import dotenv from 'dotenv';
import logger from './logger.ts';
dotenv.config();

/** Validated quiz question shape */
export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
  explanation: string;
}

/** Myth-bust response shape */
export interface MythBustResult {
  verdict: 'TRUE' | 'FALSE' | 'MISLEADING';
  explanation: string;
  source: string;
}

/** Eligibility check result */
export interface EligibilityResult {
  eligible: boolean;
  reason: string;
  requirements: string[];
  deadline: string;
  voterIdLink: string;
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const safetySettings: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: `You are ELECTRA — the official AI guide to Indian elections and the Constitution of India.
Your role: Help citizens, especially first-time voters, understand the democratic process.
Rules:
- Always cite the relevant law or Article (e.g., Article 324, Section 62 RPA 1951).
- Be strictly factual, neutral, and non-partisan. Never express opinions on political parties or candidates.
- Reply in the user's chosen language (Hindi or English).
- Keep answers concise, clear, and citizen-friendly.
- Encourage civic participation and voter registration.`,
  safetySettings,
});

// Cache for quiz responses (10 min TTL) — reduces Gemini API calls for popular topics
const quizCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

// Hardcoded high-quality fallback quiz — used when Gemini unavailable
const FALLBACK_QUIZ: QuizQuestion[] = [
  {
    question: "Which Article of the Indian Constitution provides for the Election Commission?",
    options: ["Article 320", "Article 324", "Article 356", "Article 370"],
    correct: 1,
    explanation: "Article 324 provides for the superintendence, direction, and control of elections to be vested in the Election Commission of India.",
  },
  {
    question: "What is the minimum voting age in India?",
    options: ["16 years", "18 years", "21 years", "25 years"],
    correct: 1,
    explanation: "The 61st Constitutional Amendment Act, 1988 lowered the voting age from 21 to 18 years.",
  },
  {
    question: "What does VVPAT stand for?",
    options: ["Voter Verified Paper Audit Trail", "Voter Validated Power Audit Tool", "Visual Voter Paper Account Trace", "Verified Voter Paper Authentication Trail"],
    correct: 0,
    explanation: "VVPAT (Voter Verified Paper Audit Trail) allows voters to verify that their vote was cast correctly to the intended candidate.",
  },
  {
    question: "Who appoints the Chief Election Commissioner of India?",
    options: ["Prime Minister", "Chief Justice of India", "President of India", "Parliament"],
    correct: 2,
    explanation: "Under Article 324, the Chief Election Commissioner and other Election Commissioners are appointed by the President of India.",
  },
  {
    question: "What does NOTA stand for?",
    options: ["None of the Above", "New Online Trust Authority", "National Official Trade Association", "No Option To Accept"],
    correct: 0,
    explanation: "NOTA (None of the Above) was introduced by the Supreme Court in 2013 (PUCL v. Union of India) to allow voters to reject all candidates.",
  },
];

/**
 * Streams a chat response from Gemini for a given user message and conversation history.
 */
export const chatStream = async (history: Content[], message: string, language: string = 'en') => {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
    return (async function* (): AsyncGenerator<{ text: () => string }> {
      yield { text: () => '⚠️ GEMINI_API_KEY is not configured. Please set it in your environment.' };
    })();
  }

  const langInstruction = language === 'hi' ? ' (Please respond in Hindi)' : ' (Please respond in English)';
  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(message + langInstruction);
  return result.stream;
};

/**
 * Generates 5 adaptive quiz questions on a given Indian election topic.
 * Uses cached results when available.
 */
export const generateQuiz = async (topic: string, score: number = 0): Promise<QuizQuestion[]> => {
  const difficulty = score > 60 ? 'hard' : score > 30 ? 'medium' : 'easy';
  const cacheKey = `quiz:${topic}:${difficulty}`;

  const cached = quizCache.get<QuizQuestion[]>(cacheKey);
  if (cached) return cached;

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
    return FALLBACK_QUIZ;
  }

  try {
    const prompt = `Generate exactly 5 ${difficulty}-difficulty multiple-choice quiz questions about "${topic}" in Indian elections and democracy.
Return ONLY a valid JSON array. Each item must have:
- "question": string
- "options": array of exactly 4 strings
- "correct": integer 0-3 (index of correct answer)  
- "explanation": string (1-2 sentences citing the relevant law or article)
No extra text, just the JSON array.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });

    let rawText = result.response.text();
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    const parsed = JSON.parse(rawText) as QuizQuestion[];
    if (Array.isArray(parsed) && parsed.length === 5) {
      quizCache.set(cacheKey, parsed);
      return parsed;
    }
    throw new Error('Invalid quiz format from Gemini');
  } catch (err: any) {
    logger.warn(`Quiz generation failed (topic=${topic}): ${err?.message || err}. Using fallback.`);
    return FALLBACK_QUIZ;
  }
};

/**
 * Fact-checks an election-related claim using Gemini.
 */
export const mythBust = async (claim: string): Promise<MythBustResult> => {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
    return { verdict: 'MISLEADING', explanation: 'API not configured.', source: 'N/A' };
  }

  try {
    const prompt = `You are a fact-checker for Indian elections. Fact-check this claim: "${claim}"
Return ONLY valid JSON in this exact format:
{ "verdict": "TRUE" | "FALSE" | "MISLEADING", "explanation": "<2-3 sentences>", "source": "<official source name>" }
Be accurate, cite ECI, Constitution, or RPA 1951 where applicable.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(result.response.text()) as MythBustResult;
    if (!['TRUE', 'FALSE', 'MISLEADING'].includes(parsed.verdict)) {
      throw new Error('Invalid verdict value');
    }
    return parsed;
  } catch (err: any) {
    logger.warn(`Myth bust failed: ${err?.message || err}`);
    return {
      verdict: 'MISLEADING',
      explanation: "I couldn't verify this claim right now. Always check the official Election Commission of India website (eci.gov.in) for accurate information.",
      source: 'ECI — eci.gov.in',
    };
  }
};

/**
 * Checks voter eligibility based on age and citizenship.
 * Fully rule-based — no AI call needed for deterministic logic.
 */
export const checkEligibility = (state: string, age: number, citizenship: string): EligibilityResult => {
  const requirements: string[] = [];
  const reasons: string[] = [];

  if (age < 18) {
    reasons.push(`You must be at least 18 years old (you are ${age}). [Section 14, RPA 1950]`);
  }
  if (citizenship !== 'Indian') {
    reasons.push('You must be a citizen of India to vote. [Article 326, Constitution]');
  }

  if (reasons.length === 0) {
    return {
      eligible: true,
      reason: `You meet all eligibility criteria under Article 326 of the Constitution and Section 14 of RPA 1950.`,
      requirements: ['Valid Voter ID (EPIC)', 'Name enrolled in Electoral Roll for ' + state, 'Must vote at your designated polling booth'],
      deadline: 'Register before the electoral roll cutoff date for the next election',
      voterIdLink: 'https://voters.eci.gov.in',
    };
  }

  return {
    eligible: false,
    reason: reasons.join(' '),
    requirements: age >= 18 ? ['Indian citizenship required'] : ['Must be 18+ years old', 'Indian citizenship required'],
    deadline: age < 18 ? `Eligible in ${18 - age} year(s)` : 'N/A',
    voterIdLink: 'https://voters.eci.gov.in',
  };
};
