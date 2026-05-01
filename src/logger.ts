import winston from 'winston';
import { LoggingWinston } from '@google-cloud/logging-winston';
import { env } from './config/env.ts';

const loggingWinston = new LoggingWinston();

/**
 * Configure Winston logger with Console and Google Cloud Logging transports.
 */
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    ...(env.NODE_ENV === 'production' ? [loggingWinston] : []),
  ],
});

// In-memory counters for admin dashboard
const stats = {
  queries: 0,
  mythBusts: 0,
  quizCompletions: 0,
  languages: { en: 0, hi: 0 },
};

/**
 * Increments an aggregate statistic and logs it for Cloud Logging.
 * @param {'queries' | 'mythBusts' | 'quizCompletions' | 'en' | 'hi' | 'question'} type - Metric type
 * @param {string} [detail] - Optional detail (e.g. the question text)
 */
export const incrementStat = (type: 'queries' | 'mythBusts' | 'quizCompletions' | 'en' | 'hi' | 'question', detail?: string) => {
  if (type === 'en' || type === 'hi') {
    stats.languages[type]++;
    logger.info(`aggregate_event:language_selected`, { metric: 'aggregate_event', eventType: 'language_selected', feature: type, language: type });
  } else if (type === 'question') {
    logger.info(`aggregate_event:query_count`, { metric: 'aggregate_event', eventType: 'query_count', feature: 'question' });
  } else {
    stats[type]++;
    logger.info(`aggregate_event:feature_used`, { metric: 'aggregate_event', eventType: 'feature_used', feature: type });
  }
};

/**
 * Returns current aggregate statistics.
 * @returns {typeof stats} Stats object
 */
export const getStats = () => ({ ...stats });

export default logger;
