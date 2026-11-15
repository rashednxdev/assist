import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// Always read apps/api/.env, even when the process is started from the repo root.
loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('365d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('365d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  /** Directory for public content cache JSON files (no user/auth data). */
  CONTENT_CACHE_DIR: z.string().optional(),
  /** Directory for uploaded files (schedule PDFs). Use a persistent disk in production. Defaults to ./storage. */
  UPLOAD_DIR: z.string().optional(),
  SCHEDULE_MAX_FILE_MB: z.coerce.number().min(1).max(50).default(20),
  /** Set to "false" to disable the schedule reminder runner on this instance. */
  SCHEDULE_RUNNER: z.enum(['true', 'false']).default('true'),
  /**
   * Gmail SMTP for outgoing email (password-reset OTP, etc.). Unset in dev logs the code instead
   * of sending. The "from" address is always SMTP_USER itself — Gmail rejects/rewrites mismatched
   * From headers, so there's no separate EMAIL_FROM to configure.
   */
  SMTP_USER: z.string().optional(),
  /** Gmail App Password (not the account password) — Google Account > Security > App passwords. */
  SMTP_PASS: z.string().optional(),
  /** BulkSMS BD API key for the login verification code. Unset means login SMS cannot be sent. */
  SMS_API_KEY: z.string().optional(),
  /** Approved sender id for BulkSMS BD. */
  SMS_SENDER_ID: z.string().default('8809604903051'),
  SMS_API_URL: z.string().url().default('https://isms.bulksmsbd.info/api/sendsms'),
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
