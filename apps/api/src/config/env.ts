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
  /** Directory for public content cache JSON files (no user/auth data). */
  CONTENT_CACHE_DIR: z.string().optional(),
  /**
   * Gmail SMTP for outgoing email (password-reset OTP, etc.). Unset in dev logs the code instead
   * of sending. The "from" address is always SMTP_USER itself — Gmail rejects/rewrites mismatched
   * From headers, so there's no separate EMAIL_FROM to configure.
   */
  SMTP_USER: z.string().optional(),
  /** Gmail App Password (not the account password) — Google Account > Security > App passwords. */
  SMTP_PASS: z.string().optional(),
  /** Agora.io App ID for LIVE_STREAM (one-to-many). Required to join a session. */
  AGORA_APP_ID: z.string().optional(),
  /** Agora.io App Certificate — used to mint short-lived RTC tokens server-side. */
  AGORA_APP_CERTIFICATE: z.string().optional(),
  /** Set to "false" only if App Certificate auth is disabled in Agora Console (join with App ID only). */
  AGORA_USE_TOKEN: z.enum(['true', 'false']).optional(),
  /** Zoom Server-to-Server OAuth — create meetings + ZAK (REST API). */
  ZOOM_ACCOUNT_ID: z.string().optional(),
  /** Zoom S2S OAuth client id. */
  ZOOM_CLIENT_ID: z.string().optional(),
  /** Zoom S2S OAuth client secret. */
  ZOOM_CLIENT_SECRET: z.string().optional(),
  /**
   * Meeting SDK Client ID (from a General / Meeting SDK app — NOT Server-to-Server OAuth).
   * Falls back to ZOOM_CLIENT_ID only if unset (will fail for S2S-only apps).
   */
  ZOOM_SDK_KEY: z.string().optional(),
  /** Meeting SDK Client Secret — used to sign join/start JWTs. */
  ZOOM_SDK_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
