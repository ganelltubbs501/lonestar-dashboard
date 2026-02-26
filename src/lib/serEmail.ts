import nodemailer from 'nodemailer';
import logger from './logger';

interface SerNotification {
  to: string[];
  subject: string;
  heading: string;
  body: string;
  itemUrl?: string;
}

/**
 * Send a SER reminder email.
 * Gracefully no-ops if SMTP_HOST env var is not configured.
 * Returns true if email was sent, false if skipped/failed.
 */
export async function sendSerEmail(n: SerNotification): Promise<boolean> {
  if (!process.env.SMTP_HOST) {
    logger.info(
      { to: n.to, subject: n.subject },
      '[SerEmail] SMTP_HOST not set — reminder logged but not emailed'
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  const linkHtml = n.itemUrl
    ? `<p style="margin-top:16px"><a href="${n.itemUrl}" style="color:#6366f1">View item →</a></p>`
    : '';

  const html = `
    <div style="font-family:sans-serif;max-width:560px">
      <h2 style="margin:0 0 8px">${n.heading}</h2>
      <p style="color:#374151;margin:0 0 12px">${n.body}</p>
      ${linkHtml}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin-top:24px"/>
      <p style="font-size:12px;color:#9ca3af">Ops Desktop — SER Intelligence</p>
    </div>`;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? 'noreply@opsdesktop.internal',
      to: n.to.join(', '),
      subject: n.subject,
      text: `${n.heading}\n\n${n.body}${n.itemUrl ? `\n\nView item: ${n.itemUrl}` : ''}`,
      html,
    });
    logger.info({ to: n.to, subject: n.subject }, '[SerEmail] sent');
    return true;
  } catch (err) {
    logger.error({ err, to: n.to, subject: n.subject }, '[SerEmail] send failed');
    return false;
  }
}
