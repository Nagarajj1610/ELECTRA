/**
 * Strips markdown JSON code fences from a string.
 * @param {string} text - Raw text from Gemini
 * @returns {string} Clean JSON string
 */
export const stripMarkdownJson = (text: string): string =>
  text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

/**
 * Safely parses a JSON string without throwing.
 * @param {string} text - JSON string to parse
 * @returns {unknown} Parsed value or null
 */
export const safeJsonParse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/**
 * Validates that a value is a non-empty array of valid quiz questions.
 * @param {unknown} data - Data to validate
 * @returns {boolean} True if valid quiz array
 */
export const isValidQuizArray = (data: unknown): data is import('../types/index.ts').QuizQuestion[] => {
  if (!Array.isArray(data) || data.length === 0) return false;
  return data.every(
    (q) =>
      typeof q.question === 'string' &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      typeof q.correct === 'number' &&
      typeof q.explanation === 'string'
  );
};
