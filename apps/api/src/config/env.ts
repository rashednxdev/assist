import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('8h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  OCR_MAX_FILE_MB: z.coerce.number().min(1).max(50).default(15),
  OCR_LANGUAGES: z.string().default('eng+ben'),
  OCR_MIN_TEXT_CHARS: z.coerce.number().min(0).default(40),
});

export const env = envSchema.parse(process.env);
