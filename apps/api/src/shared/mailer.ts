import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import { badRequest } from './errors/AppError.js';

let transporter: Transporter | null = null;
if (env.SMTP_USER && env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

/**
 * Sends an email via Gmail SMTP. With no SMTP_USER/SMTP_PASS configured (local dev without
 * credentials), the message is logged instead of sent so flows like password reset still work
 * end-to-end for testing.
 */
export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  if (!transporter) {
    logger.warn(
      { to: params.to, subject: params.subject, html: params.html },
      'SMTP_USER/SMTP_PASS not set — email logged, not sent',
    );
    return;
  }

  try {
    await transporter.sendMail({
      from: `proAssist <${env.SMTP_USER}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
  } catch (err) {
    logger.error({ err, to: params.to }, 'Failed to send email');
    throw badRequest('Could not send the email. Please try again later.');
  }
}
