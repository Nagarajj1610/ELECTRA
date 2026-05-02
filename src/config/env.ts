import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/** 
 * Zod schema for environment variables validation.
 */
const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  MAPS_API_KEY: z.string().min(1, "MAPS_API_KEY is required"),
  ADMIN_PASSWORD: z.string().min(1, "ADMIN_PASSWORD is required"),
  GOOGLE_CLOUD_PROJECT: z.string().min(1, "GOOGLE_CLOUD_PROJECT is required"),
  PORT: z.string().default('8080'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  // Note: Using console.error here to avoid circular dependency with logger.ts
  console.error('❌ Invalid environment variables:', JSON.stringify(_env.error.format(), null, 2));
  process.exit(1);
}

/** Validated environment variables */
export const env = _env.data;
