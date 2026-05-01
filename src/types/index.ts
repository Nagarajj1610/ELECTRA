import { z } from 'zod';
import { VALIDATION, QUIZ_CONFIG, Verdict } from '../constants.ts';

// ─── API Request Schemas ───────────────────────────────────────────────────

export const ChatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(VALIDATION.MAX_MESSAGE_LENGTH, 'Message too long'),
  language: z.enum(['en', 'hi']).default('en'),
  history: z.array(z.any()).default([]),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const EligibilityRequestSchema = z.object({
  state: z.string().min(1).max(100),
  age: z.coerce.number().int().min(VALIDATION.MIN_AGE, 'Age must be non-negative').max(VALIDATION.MAX_AGE, 'Age seems invalid'),
  citizenship: z.string().min(1),
});
export type EligibilityRequest = z.infer<typeof EligibilityRequestSchema>;

export const TranslateRequestSchema = z.object({
  text: z.string().min(1).max(VALIDATION.MAX_TRANSLATE_LENGTH),
  target: z.enum(['en', 'hi']),
});
export type TranslateRequest = z.infer<typeof TranslateRequestSchema>;

export const QuizRequestSchema = z.object({
  topic: z.string().min(1).max(100),
  score: z.number().min(0).max(100).default(QUIZ_CONFIG.DEFAULT_SCORE),
});
export type QuizRequest = z.infer<typeof QuizRequestSchema>;

export const MythBustRequestSchema = z.object({
  claim: z.string().min(1, 'Claim cannot be empty').max(VALIDATION.MAX_CLAIM_LENGTH),
});
export type MythBustRequest = z.infer<typeof MythBustRequestSchema>;

export const MapsLookupRequestSchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
});
export type MapsLookupRequest = z.infer<typeof MapsLookupRequestSchema>;

// ─── API Response Schemas ──────────────────────────────────────────────────

export const QuizQuestionSchema = z.object({
  question: z.string(),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  correct: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  explanation: z.string(),
});
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const MythBustResultSchema = z.object({
  verdict: z.nativeEnum(Verdict),
  explanation: z.string(),
  source: z.string(),
});
export type MythBustResult = z.infer<typeof MythBustResultSchema>;

/** Eligibility check result */
export interface EligibilityResult {
  eligible: boolean;
  reason: string;
  requirements: string[];
  deadline: string;
  voterIdLink: string;
}

/** Type for constituency lookup result */
export interface ConstituencyInfo {
  state: string;
  lokSabha: string;
  vidhanSabha: string;
  lat?: number;
  lng?: number;
}

/** Admin Stats shape */
export interface AdminStats {
  queries: number;
  mythBusts: number;
  quizCompletions: number;
  languages: { en: number; hi: number };
}

export type { Verdict };
