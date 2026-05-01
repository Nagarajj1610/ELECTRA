import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/** Zod schema for environment variables */
const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  MAPS_API_KEY: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(1),
  PORT: z.string().default('8080'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

/** Validated environment variables */
export const env = _env.data;
