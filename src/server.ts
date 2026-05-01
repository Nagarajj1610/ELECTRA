import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import compression from 'compression';
import { ZodError } from 'zod';
import { env } from './config/env.ts';
import { PORT, RATE_LIMIT } from './constants.ts';
import { chatStream, mythBust, generateQuiz } from './gemini.ts';
import { checkEligibility } from './services/eligibility.ts';
import { translateText } from './translate.ts';
import { lookupConstituency, getMapsKey } from './maps.ts';
import { incrementStat } from './logger.ts';
import { getAdminStats } from './admin.ts';
import { getTimeline } from './services/timeline.ts';
import { 
  ChatRequestSchema, 
  EligibilityRequestSchema, 
  TranslateRequestSchema, 
  QuizRequestSchema, 
  MythBustRequestSchema, 
  MapsLookupRequestSchema 
} from './types/index.ts';
import logger from './logger.ts';
import { AppError } from './errors/AppError.ts';

export const app = express();

// ─── Security & Middleware ──────────────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.tailwindcss.com", "maps.googleapis.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "maps.gstatic.com", "*.googleapis.com"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginEmbedderPolicy: false,
}));

// Permissions Policy explicitly
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

app.use(cors({ origin: env.NODE_ENV === 'production' ? false : true }));
app.use(express.json({ limit: '50kb' }));
app.use(compression());

// ─── Rate Limiting ─────────────────────────────────────────────────────────

const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT.windowMs,
  max: RATE_LIMIT.max,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: RATE_LIMIT.chatMax,
  message: { error: 'Too many chat messages. Please wait a moment.' },
});

app.use('/api/', apiLimiter);

// ─── Static Files ──────────────────────────────────────────────────────────

app.use(express.static('public', {
  maxAge: env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Wraps async route handlers to forward errors to Express error handler */
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// ─── Routes ────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() }));

/** POST /api/chat - SSE streaming chat with Gemini */
app.post('/api/chat', chatLimiter, asyncHandler(async (req, res) => {
  const { history, message, language } = ChatRequestSchema.parse(req.body);
  incrementStat('question', message);
  incrementStat(language as 'en' | 'hi');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const stream = await chatStream(history, message, language);
  for await (const chunk of stream) {
    res.write(`data: ${JSON.stringify({ text: chunk.text() })}\n\n`);
  }
  res.write('data: [DONE]\n\n');
  res.end();
  incrementStat('queries');
}));

/** POST /api/eligibility - Voter eligibility rule engine */
app.post('/api/eligibility', asyncHandler(async (req, res) => {
  const { state, age, citizenship } = EligibilityRequestSchema.parse(req.body);
  res.json(checkEligibility(state, age, citizenship));
}));

/** POST /api/translate - Translation proxy */
app.post('/api/translate', asyncHandler(async (req, res) => {
  const { text, target } = TranslateRequestSchema.parse(req.body);
  const translated = await translateText(text, target);
  res.json({ translated });
}));

/** POST /api/quiz - Adaptive quiz generation */
app.post('/api/quiz', asyncHandler(async (req, res) => {
  const { topic, score } = QuizRequestSchema.parse(req.body);
  const quiz = await generateQuiz(topic, score);
  incrementStat('quizCompletions');
  res.json(quiz);
}));

/** POST /api/mythbust - AI myth busting */
app.post('/api/mythbust', asyncHandler(async (req, res) => {
  const { claim } = MythBustRequestSchema.parse(req.body);
  const result = await mythBust(claim);
  incrementStat('mythBusts');
  res.json(result);
}));

/** GET /api/timeline - Election timeline data */
app.get('/api/timeline', (_req, res) => {
  res.json(getTimeline());
});

/** GET /api/admin/stats - Admin dashboard data */
app.get('/api/admin/stats', (req, res) => {
  const password = req.headers['x-admin-password'] as string | undefined;
  if (!password) throw new AppError('Password required', 401, 'AUTH_REQUIRED');
  res.json(getAdminStats(password));
});

/** GET /api/maps/key - Maps API key exposure */
app.get('/api/maps/key', (_req, res) => {
  res.json({ key: getMapsKey() });
});

/** POST /api/maps/lookup - Pincode to constituency mapping */
app.post('/api/maps/lookup', asyncHandler(async (req, res) => {
  const { pincode } = MapsLookupRequestSchema.parse(req.body);
  res.json(await lookupConstituency(pincode));
}));

// ─── Error Handlers ────────────────────────────────────────────────────────

/** Global error handler middleware */
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ 
      error: 'Invalid input', 
      errorCode: 'VALIDATION_ERROR',
      details: err.errors.map(e => e.message) 
    });
  }
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, errorCode: err.errorCode });
  }
  logger.error(`Unhandled error on ${req.method} ${req.path}: ${err.message}`, { stack: err.stack });
  res.status(500).json({ error: 'Internal server error', errorCode: 'INTERNAL_ERROR' });
});

// ─── Start Server ──────────────────────────────────────────────────────────

if (env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`ELECTRA server running at http://0.0.0.0:${PORT}`);
  });
}
