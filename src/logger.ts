import winston from 'winston';
import { LoggingWinston } from '@google-cloud/logging-winston';
import { env } from './config/env.ts';

const isProd = env.NODE_ENV === 'production';

/**
 * Winston transport configuration.
 * Uses Cloud Logging in production, Console in development.
 */
const transports = isProd
  ? [new LoggingWinston({ projectId: env.GOOGLE_CLOUD_PROJECT })]
  : [new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    })];

const logger = winston.createLogger({
  level: isProd ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports,
});

const stats = {
  queries: 0,
  mythBusts: 0,
  quizCompletions: 0,
  languages: { en: 0, hi: 0 },
  topQuestions: new Map<string, number>(),
};

type StatKey = 'queries' | 'mythBusts' | 'quizCompletions' | 'en' | 'hi';

/**
 * Helper to update question frequency map.
 * @param {string} question - The query string
 */
const trackQuestion = (question: string) => {
  const q = question.trim().slice(0, 200);
  stats.topQuestions.set(q, (stats.topQuestions.get(q) ?? 0) + 1);
  if (stats.topQuestions.size > 100) {
    const oldest = stats.topQuestions.keys().next().value;
    if (oldest) stats.topQuestions.delete(oldest);
  }
};

/**
 * Increments aggregate metrics and sends a structured log event.
 * @param {StatKey | 'question'} key - The metric
 * @param {string} [question] - Optional question text
 */
export const incrementStat = (key: StatKey | 'question', question?: string): void => {
  let eventType = 'unknown';
  
  if (key === 'question' && question) {
    trackQuestion(question);
    eventType = 'query_count';
  } else if (key === 'en' || key === 'hi') {
    stats.languages[key]++;
    eventType = 'language_selected';
  } else if (key !== 'question') {
    stats[key]++;
    eventType = 'feature_used';
  }

  // Send structured analytics log to GCP (Cloud Logging)
  // These events are aggregated for analytics and contain NO PII
  logger.info(`aggregate_event:${eventType}`, {
    eventType,
    metric: 'aggregate_event',
    feature: key,
    language: (key === 'en' || key === 'hi') ? key : undefined,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Retrieves the current memory stats.
 * @returns {any} Aggregate stats object
 */
export const getStats = (): any => {
  const topQuestions = Array.from(stats.topQuestions.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([q, count]) => ({ question: q, count }));

  return {
    queries: stats.queries,
    mythBusts: stats.mythBusts,
    quizCompletions: stats.quizCompletions,
    languages: { ...stats.languages },
    topQuestions,
  };
};

export default logger;
