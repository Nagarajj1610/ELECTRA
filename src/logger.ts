import winston from 'winston';

/** Structured logger using Winston */
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV !== 'production'
        ? winston.format.combine(winston.format.colorize(), winston.format.simple())
        : winston.format.json(),
    }),
  ],
});

/** In-memory counters for admin stats dashboard */
const stats = {
  queries: 0,
  mythBusts: 0,
  quizCompletions: 0,
  languages: { en: 0, hi: 0 },
  topQuestions: new Map<string, number>(),
};

type StatKey = keyof Pick<typeof stats, 'queries' | 'mythBusts' | 'quizCompletions'>;

/**
 * Increments a named stat counter. Tracks language usage and top questions separately.
 */
export const incrementStat = (
  key: StatKey | 'en' | 'hi' | 'question',
  question?: string
): void => {
  switch (key) {
    case 'queries': stats.queries++; break;
    case 'mythBusts': stats.mythBusts++; break;
    case 'quizCompletions': stats.quizCompletions++; break;
    case 'en': stats.languages.en++; break;
    case 'hi': stats.languages.hi++; break;
    case 'question':
      if (question) {
        // Trim and truncate to prevent memory abuse from large queries
        const q = question.trim().slice(0, 200);
        stats.topQuestions.set(q, (stats.topQuestions.get(q) ?? 0) + 1);
        // Keep only the top 100 questions to prevent unbounded growth
        if (stats.topQuestions.size > 100) {
          const oldest = stats.topQuestions.keys().next().value;
          if (oldest) stats.topQuestions.delete(oldest);
        }
      }
      break;
  }
};

/**
 * Returns all current stats, with top questions sorted by frequency.
 */
export const getStats = () => {
  const topQuestions = Array.from(stats.topQuestions.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([question, count]) => ({ question, count }));

  return {
    queries: stats.queries,
    mythBusts: stats.mythBusts,
    quizCompletions: stats.quizCompletions,
    languages: { ...stats.languages },
    topQuestions,
  };
};

export default logger;
