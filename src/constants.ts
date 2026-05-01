/** 
 * Global application constants.
 * ALL magic strings, numbers, and enums reside here.
 */

export const PORT = process.env.PORT || 8080;

export const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 100,
  chatMax: 10
};

/** 
 * Verdict constants for MythBust.
 * Using const object for Node.js 22 --experimental-strip-types compatibility.
 */
export const Verdict = {
  TRUE: 'TRUE',
  FALSE: 'FALSE',
  MISLEADING: 'MISLEADING',
} as const;
export type Verdict = (typeof Verdict)[keyof typeof Verdict];

export const CACHE_TTL = {
  timeline: 3600,
  quiz: 600,
  geocoding: 86400,
  checkPeriod: 120
};

export const VALIDATION = {
  MAX_MESSAGE_LENGTH: 1000,
  MAX_TRANSLATE_LENGTH: 2000,
  MAX_CLAIM_LENGTH: 500,
  MIN_AGE: 0,
  MAX_AGE: 120
};

export const QUIZ_CONFIG = {
  DEFAULT_SCORE: 0,
  QUESTIONS_COUNT: 5
};
