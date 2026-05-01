import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import compression from 'compression';
import { z, ZodError } from 'zod';
import dotenv from 'dotenv';
import NodeCache from 'node-cache';
import { chatStream, mythBust, generateQuiz } from './gemini.ts';
import { checkEligibility } from './services/eligibility.ts';
import { translateText } from './translate.ts';
import { lookupConstituency, getMapsKey } from './maps.ts';
import { incrementStat, getStats } from './logger.ts';
import { getAdminStats } from './admin.ts';
import logger from './logger.ts';

dotenv.config();

// Startup validation — warn if key services are not configured
if (!process.env.GEMINI_API_KEY) logger.warn('GEMINI_API_KEY is not set — AI features will be degraded');
if (!process.env.MAPS_API_KEY) logger.warn('MAPS_API_KEY is not set — Maps features will be degraded');
if (!process.env.ADMIN_PASSWORD) logger.warn('ADMIN_PASSWORD is not set — admin endpoint is insecure');
logger.info(`ELECTRA starting in ${process.env.NODE_ENV || 'development'} mode`);

export const app = express();
const port = parseInt(process.env.PORT || '8080', 10);

// ─── Security Middleware ───────────────────────────────────────────────────
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
  crossOriginEmbedderPolicy: false,
}));

// Only allow CORS from same origin in production
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
}));

app.use(express.json({ limit: '50kb' })); // Limit request body size
app.use(compression());

// ─── Rate Limiting ─────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health', // Don't rate limit health checks
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Max 10 chat messages per minute per IP
  message: { error: 'Too many chat messages. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);
app.use('/api/chat', chatLimiter);

// ─── Static Files ──────────────────────────────────────────────────────────
app.use(express.static('public', {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0, // Cache static assets in production
  etag: true,
}));

// ─── In-memory cache for timeline (static data — cache for 1 hour) ─────────
const timelineCache = new NodeCache({ stdTTL: 3600 });

// ─── Helpers ───────────────────────────────────────────────────────────────
/** Wraps async route handlers to forward errors to Express error handler */
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// ─── Routes ────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() }));
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// Chat — SSE streaming
app.post('/api/chat', chatLimiter, asyncHandler(async (req, res) => {
  const schema = z.object({
    message: z.string().min(1, 'Message cannot be empty').max(1000, 'Message too long'),
    language: z.enum(['en', 'hi']).default('en'),
    history: z.array(z.any()).default([]),
  });

  const { history, message, language } = schema.parse(req.body);

  incrementStat('question', message);
  incrementStat(language as 'en' | 'hi');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const stream = await chatStream(history, message, language);
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ text: chunk.text() })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
  } catch (error: any) {
    logger.error(`Chat stream error: ${error.message}`);
    res.write(`data: ${JSON.stringify({ text: `\n\n⚠️ **Error**: ${error.message || 'Failed to generate response due to an API error.'}` })}\n\n`);
    res.write('data: [DONE]\n\n');
  } finally {
    res.end();
    incrementStat('queries');
  }
}));

// Eligibility check — rule-based, no AI needed
app.post('/api/eligibility', asyncHandler(async (req, res) => {
  const schema = z.object({
    state: z.string().min(1).max(100),
    age: z.coerce.number().int().min(0, 'Age must be non-negative').max(120, 'Age seems invalid'),
    citizenship: z.string().min(1),
  });
  const { state, age, citizenship } = schema.parse(req.body);
  const result = checkEligibility(state, age, citizenship);
  res.json(result);
}));

// Translation proxy
app.post('/api/translate', asyncHandler(async (req, res) => {
  const schema = z.object({
    text: z.string().min(1).max(2000),
    target: z.enum(['en', 'hi']),
  });
  const { text, target } = schema.parse(req.body);
  const translated = await translateText(text, target);
  res.json({ translated });
}));

// Quiz generation
app.post('/api/quiz', asyncHandler(async (req, res) => {
  const schema = z.object({
    topic: z.string().min(1).max(100),
    score: z.number().min(0).max(100).default(0),
  });
  const { topic, score } = schema.parse(req.body);
  const quiz = await generateQuiz(topic, score);
  incrementStat('quizCompletions');
  res.json(quiz);
}));

// Myth buster
app.post('/api/mythbust', asyncHandler(async (req, res) => {
  const schema = z.object({ claim: z.string().min(1, 'Claim cannot be empty').max(500) });
  const { claim } = schema.parse(req.body);
  const result = await mythBust(claim);
  incrementStat('mythBusts');
  res.json(result);
}));

// Election timeline — cached static data
app.get('/api/timeline', (_req, res) => {
  const cached = timelineCache.get('timeline');
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }
  const timeline = [
    { stage: "Announcement", date: "T-45 Days", detail: "ECI announces election schedule via press conference.", law: "Article 324" },
    { stage: "MCC in Force", date: "Immediately", detail: "Model Code of Conduct comes into force, restricting parties and government.", law: "ECI Guidelines" },
    { stage: "Nominations", date: "T-30 Days", detail: "Candidates file nomination papers with the Returning Officer.", law: "Sec 33, RPA 1951" },
    { stage: "Scrutiny", date: "T-28 Days", detail: "Returning Officer examines nomination papers for validity.", law: "Sec 36, RPA 1951" },
    { stage: "Withdrawal", date: "T-25 Days", detail: "Last date for candidates to withdraw their candidature.", law: "Sec 37, RPA 1951" },
    { stage: "Campaigning", date: "T-25 to T-2", detail: "Candidates and parties actively campaign across constituencies.", law: "Sec 126, RPA 1951" },
    { stage: "Campaign Silence", date: "T-48 Hours", detail: "All campaigning must stop 48 hours before polling begins.", law: "Sec 126, RPA 1951" },
    { stage: "Polling Day", date: "Election Day", detail: "Registered voters cast their votes at designated polling booths.", law: "Sec 56, RPA 1951" },
    { stage: "Vote Counting", date: "T+3 Days", detail: "Votes are counted at counting centres under ECI supervision.", law: "Rule 56, Conduct of Election Rules 1961" },
    { stage: "Results & Oath", date: "Counting Day", detail: "Winners declared and new government formation begins.", law: "Sec 66, RPA 1951 & Article 75" },
  ];
  timelineCache.set('timeline', timeline);
  res.setHeader('X-Cache', 'MISS');
  res.json(timeline);
});

// Admin stats — password-protected
app.get('/api/admin/stats', (req, res) => {
  const password = req.headers['x-admin-password'] as string | undefined;
  if (!password) return res.status(401).json({ error: 'Password required' });
  try {
    const statsData = getAdminStats(password);
    res.json(statsData);
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Maps key — returns key for client-side Google Maps JS API
app.get('/api/maps/key', (_req, res) => {
  res.json({ key: getMapsKey() });
});

// Maps constituency lookup
app.post('/api/maps/lookup', asyncHandler(async (req, res) => {
  const schema = z.object({ pincode: z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits') });
  const { pincode } = schema.parse(req.body);
  const data = await lookupConstituency(pincode);
  res.json(data);
}));

// ─── Global Error Handler ──────────────────────────────────────────────────
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Invalid input', details: err.errors.map(e => e.message) });
  }
  logger.error(`Unhandled error on ${req.method} ${req.path}: ${err.message}`, { stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start Server ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, '0.0.0.0', () => {
    logger.info(`ELECTRA server running at http://0.0.0.0:${port}`);
  });
}
