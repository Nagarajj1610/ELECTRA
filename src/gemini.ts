import { GoogleGenerativeAI, type Content, type SafetySetting, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import NodeCache from 'node-cache';
import logger from './logger.ts';
import { env } from './config/env.ts';
import { Verdict } from './types/index.ts';
import type { QuizQuestion, MythBustResult } from './types/index.ts';
import { SYSTEM_INSTRUCTION, getQuizPrompt, getMythBustPrompt, FALLBACK_QUIZ } from './prompts/index.ts';
import { stripMarkdownJson, isValidQuizArray, safeJsonParse } from './utils/helpers.ts';
import { CACHE_TTL_QUIZ, CACHE_CHECK_PERIOD } from './constants.ts';
import { AppError } from './utils/AppError.ts';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY || '');

const safetySettings: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: SYSTEM_INSTRUCTION,
  safetySettings,
});

const quizCache = new NodeCache({ stdTTL: CACHE_TTL_QUIZ, checkperiod: CACHE_CHECK_PERIOD });

/**
 * Checks if Gemini is available.
 * @returns {boolean} True if key is set
 */
const isGeminiEnabled = (): boolean => !!env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY';

/**
 * Streams a chat response from Gemini for a given user message and conversation history.
 * @param {Content[]} history - The chat history
 * @param {string} message - The new message
 * @param {string} language - Target language (en/hi)
 * @returns {Promise<AsyncGenerator<{ text: () => string }>>} The chat stream
 */
export const chatStream = async (history: Content[], message: string, language: string = 'en') => {
  if (!isGeminiEnabled()) {
    return (async function* () { yield { text: () => '⚠️ GEMINI_API_KEY is not configured.' }; })();
  }
  const langInstruction = language === 'hi' ? ' (Please respond in Hindi)' : ' (Please respond in English)';
  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(message + langInstruction);
  return result.stream;
};

/**
 * Executes a Gemini prompt expecting JSON.
 * @param {string} prompt - The prompt
 * @returns {Promise<string>} Raw text
 */
const callGeminiJson = async (prompt: string): Promise<string> => {
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  });
  return stripMarkdownJson(result.response.text());
};

/**
 * Generates 5 adaptive quiz questions on a given Indian election topic.
 * @param {string} topic - The topic
 * @param {number} score - Current score
 * @returns {Promise<QuizQuestion[]>} Array of questions
 */
export const generateQuiz = async (topic: string, score: number = 0): Promise<QuizQuestion[]> => {
  const difficulty = score > 60 ? 'hard' : score > 30 ? 'medium' : 'easy';
  const cacheKey = `quiz:${topic}:${difficulty}`;
  const cached = quizCache.get<QuizQuestion[]>(cacheKey);
  if (cached) return cached;
  if (!isGeminiEnabled()) return FALLBACK_QUIZ;

  try {
    const prompt = getQuizPrompt(topic, difficulty);
    const rawText = await callGeminiJson(prompt);
    const parsed = safeJsonParse(rawText);
    
    if (isValidQuizArray(parsed)) {
      quizCache.set(cacheKey, parsed);
      return parsed;
    }
    throw new AppError('Invalid quiz format from Gemini', 500, 'GEMINI_INVALID_JSON');
  } catch (err: any) {
    logger.warn(`Quiz generation failed (topic=${topic}): ${err?.message || err}.`);
    return FALLBACK_QUIZ;
  }
};

/**
 * Fact-checks an election-related claim using Gemini.
 * @param {string} claim - The claim
 * @returns {Promise<MythBustResult>} Verdict
 */
export const mythBust = async (claim: string): Promise<MythBustResult> => {
  if (!isGeminiEnabled()) {
    return { verdict: Verdict.MISLEADING, explanation: 'API not configured.', source: 'N/A' };
  }

  try {
    const prompt = getMythBustPrompt(claim);
    const rawText = await callGeminiJson(prompt);
    const parsed = safeJsonParse(rawText) as MythBustResult | null;
    
    if (!parsed || !Object.values(Verdict).includes(parsed.verdict)) {
      throw new AppError('Invalid verdict value', 500, 'GEMINI_INVALID_JSON');
    }
    return parsed;
  } catch (err: any) {
    logger.warn(`Myth bust failed: ${err?.message || err}`);
    return {
      verdict: Verdict.MISLEADING,
      explanation: "Couldn't verify right now. Check eci.gov.in.",
      source: 'ECI',
    };
  }
};
