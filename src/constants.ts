/**
 * Global application constants to avoid magic numbers.
 */
export const PORT = 8080;
export const CACHE_TTL_TIMELINE = 3600; // 1 hour
export const CACHE_TTL_QUIZ = 600; // 10 minutes
export const CACHE_CHECK_PERIOD = 120; // 2 minutes
export const GEO_CACHE_TTL = 86400; // 24 hours
export const GEO_CACHE_CHECK = 3600; // 1 hour
export const RATE_LIMIT_API_WINDOW = 15 * 60 * 1000; // 15 mins
export const RATE_LIMIT_API_MAX = 100;
export const RATE_LIMIT_CHAT_WINDOW = 60 * 1000; // 1 min
export const RATE_LIMIT_CHAT_MAX = 10;
export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_TRANSLATE_LENGTH = 2000;
export const MAX_CLAIM_LENGTH = 500;
export const MIN_AGE = 0;
export const MAX_AGE = 120;
export const DEFAULT_QUIZ_SCORE = 0;
export const QUIZ_QUESTIONS_COUNT = 5;
