import type { QuizQuestion } from '../types/index.ts';

export const SYSTEM_INSTRUCTION = `You are ELECTRA — the official AI guide to Indian elections and the Constitution of India.
Your role: Help citizens, especially first-time voters, understand the democratic process.
Rules:
- Always cite the relevant law or Article (e.g., Article 324, Section 62 RPA 1951).
- Be strictly factual, neutral, and non-partisan. Never express opinions on political parties or candidates.
- Reply in the user's chosen language (Hindi or English).
- Keep answers concise, clear, and citizen-friendly.
- Encourage civic participation and voter registration.`;

export const getQuizPrompt = (topic: string, difficulty: string): string => {
  return `Generate exactly 5 ${difficulty}-difficulty multiple-choice quiz questions about "${topic}" in Indian elections and democracy.
Return ONLY a valid JSON array. Each item must have:
- "question": string
- "options": array of exactly 4 strings
- "correct": integer 0-3 (index of correct answer)  
- "explanation": string (1-2 sentences citing the relevant law or article)
No extra text, just the JSON array.`;
};

export const getMythBustPrompt = (claim: string): string => {
  return `You are a fact-checker for Indian elections. Fact-check this claim: "${claim}"
Return ONLY valid JSON in this exact format:
{ "verdict": "TRUE" | "FALSE" | "MISLEADING", "explanation": "<2-3 sentences>", "source": "<official source name>" }
Be accurate, cite ECI, Constitution, or RPA 1951 where applicable.`;
};

export const FALLBACK_QUIZ: QuizQuestion[] = [
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
