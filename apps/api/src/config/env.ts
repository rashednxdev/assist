import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('365d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('365d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  OCR_MAX_FILE_MB: z.coerce.number().min(1).max(50).default(15),
  OCR_LANGUAGES: z.string().default('eng+ben'),
  OCR_MIN_TEXT_CHARS: z.coerce.number().min(0).default(40),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-opus-4-8'),
  /** Directory for public content cache JSON files (no user/auth data). */
  CONTENT_CACHE_DIR: z.string().optional(),
});

export const env = envSchema.parse(process.env);
