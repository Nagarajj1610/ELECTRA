import { QUIZ_CONFIG } from '../constants.ts';
import type { QuizQuestion } from '../types/index.ts';

/**
 * Strips markdown formatting (e.g. ```json) from a string and trims it.
 * @param {string} text - The raw text from the AI
 * @returns {string} The cleaned string ready for JSON.parse
 */
export const stripMarkdownJson = (text: string): string => {
  return text.replace(/```json/gi, '').replace(/```/g, '').trim();
};

/**
 * Validates that an array is a valid quiz of the expected length.
 * @param {any[]} parsed - The parsed JSON array
 * @returns {boolean} True if valid
 */
export const isValidQuizArray = (parsed: any[]): parsed is QuizQuestion[] => {
  return Array.isArray(parsed) && parsed.length === QUIZ_CONFIG.QUESTIONS_COUNT;
};

/**
 * Safely parses JSON with fallback.
 * @param {string} text - The JSON string
 * @returns {any} Parsed JSON or null
 */
export const safeJsonParse = (text: string): any | null => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};
