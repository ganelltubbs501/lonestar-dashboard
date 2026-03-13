import nodemailer from 'nodemailer';
import { prisma } from './db';
import logger from './logger';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DigestItem {
  id: string;
  title: string;
  type: string;
  status: string;
  dueAt: Date | null;
  blockedReason: string | null;
  statusChangedAt: Date | null;
  ownerName: string | null;
  ownerEmail: string | null;
}

export interface DigestData {
  overdue: DigestItem[];
  dueToday: DigestItem[];
  dueSoon: DigestItem[];
  blocked: DigestItem[];
  generatedAt: Date;
}

export interface DigestResult {
  summary: { overdue: number; dueToday: number; dueSoon: number; blockedOver3d: number; total: number };
  sent: { email: boolean; slack: boolean; ghl: boolean };
}

// ─── DB Queries ────────────────────────────────────────────────────────────────

async function getDigestData(): Promise<DigestData> {
  const now = new Date();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const tomorrowStart = new Date(todayEnd);
  tomorrowStart.setTime(todayEnd.getTime() + 1);

  const threeDaysEnd = new Date(todayEnd);
  threeDaysEnd.setDate(threeDaysEnd.getDate() + 3);

  const blockThreshold = new Date(now);
  blockThreshold.setDate(blockThreshold.getDate() - 3);

  const select = {
    id: true,
    title: true,
    type: true,
    status: true,
    dueAt: true,
    blockedReason: true,
    statusChangedAt: true,
    owner: { select: { name: true, email: true } },
  } as const;

  const wi = (prisma as any).workItem;
  const [overdue, dueToday, dueSoon, blocked] = await Promise.all([
    wi.findMany({
      where: { status: { not: 'DONE' }, dueAt: { lt: todayStart, not: null } },
      select,
      orderBy: { dueAt: 'asc' },
    }),
    wi.findMany({
      where: { status: { not: 'DONE' }, dueAt: { gte: todayStart, lte: todayEnd } },
      select,
      orderBy: { dueAt: 'asc' },
    }),
    wi.findMany({
      where: { status: { not: 'DONE' }, dueAt: { gte: tomorrowStart, lte: threeDaysEnd } },
      select,
      orderBy: { dueAt: 'asc' },
    }),
    wi.findMany({
      where: { status: 'BLOCKED', statusChangedAt: { lt: blockThreshold } },
      select,
      orderBy: { statusChangedAt: 'asc' },
    }),
  ]);

  const toItem = (w: any): DigestItem => ({
    id: w.id,
    title: w.title,
    type: w.type,
    status: w.status,
    dueAt: w.dueAt,
    blockedReason: w.blockedReason ?? null,
    statusChangedAt: w.statusChangedAt ?? null,
    ownerName: w.owner?.name ?? null,
    ownerEmail: w.owner?.email ?? null,
  });

  return {
    overdue: overdue.map(toItem),
    dueToday: dueToday.map(toItem),
    dueSoon: dueSoon.map(toItem),
    blocked: blocked.map(toItem),
    generatedAt: now,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysDiff(a: Date, b: Date) {
  return Math.round(Math.abs(a.getTime() - b.getTime()) / 86_400_000);
}

function fmtDate(d: Date | null) {
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    SOCIAL_ASSET_REQUEST: 'Graphics',
    SPONSORED_EDITORIAL_REVIEW: 'SER',
    BOOK_CAMPAIGN: 'Campaign',
    WEBSITE_EVENT: 'Event',
    TX_BOOK_PREVIEW_LEAD: 'TX Preview',
    ACCESS_REQUEST: 'Access',
    GENERAL: 'General',
  };
  return map[type] ?? type;
}

// ─── Email ────────────────────────────────────────────────────────────────────

function buildEmailHtml(data: DigestData): string {
  const { overdue, dueToday, dueSoon, blocked, generatedAt } = data;
  const total = overdue.length + dueToday.length + dueSoon.length + blocked.length;
  const now = generatedAt;

  const dateStr = generatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (total === 0) {
    return `
      <div style="font-family:sans-serif;max-width:600px">
        <h2 style="margin:0 0 8px">✅ All clear — ${dateStr}</h2>
        <p style="color:#374151">Nothing is overdue, due, or blocked today. Great work!</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin-top:24px"/>
        <p style="font-size:12px;color:#9ca3af">LSLL HUB · Daily Digest</p>
      </div>`;
  }

  const tableStyle = 'border-collapse:collapse;width:100%;margin-bottom:24px;font-size:13px';
  const thStyle = 'text-align:left;padding:6px 10px;background:#f9fafb;border-bottom:1px solid #e5e7eb;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase';
  const tdStyle = 'padding:8px 10px;border-bottom:1px solid #f3f4f6;color:#111827;vertical-align:top';

  const buildTable = (items: DigestItem[], cols: string[], rows: (item: DigestItem) => string[]) => {
    if (items.length === 0) return '';
    const headers = cols.map(c => `<th style="${thStyle}">${c}</th>`).join('');
    const body = items.map(item => {
      const cells = rows(item).map(v => `<td style="${tdStyle}">${v}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table style="${tableStyle}"><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table>`;
  };

  const overdueTable = buildTable(
    overdue,
    ['Title', 'Type', 'Owner', 'Overdue by'],
    (w) => [
      w.title,
      typeLabel(w.type),
      w.ownerName ?? w.ownerEmail ?? '—',
      w.dueAt ? `${daysDiff(now, w.dueAt)}d` : '—',
    ]
  );

  const todayTable = buildTable(
    dueToday,
    ['Title', 'Type', 'Owner'],
    (w) => [w.title, typeLabel(w.type), w.ownerName ?? w.ownerEmail ?? '—']
  );

  const soonTable = buildTable(
    dueSoon,
    ['Title', 'Type', 'Owner', 'Due'],
    (w) => [w.title, typeLabel(w.type), w.ownerName ?? w.ownerEmail ?? '—', fmtDate(w.dueAt)]
  );

  const blockedTable = buildTable(
    blocked,
    ['Title', 'Type', 'Owner', 'Blocked reason', 'Days blocked'],
    (w) => [
      w.title,
      typeLabel(w.type),
      w.ownerName ?? w.ownerEmail ?? '—',
      w.blockedReason ?? '—',
      w.statusChangedAt ? `${daysDiff(now, w.statusChangedAt)}d` : '—',
    ]
  );

  const section = (emoji: string, label: string, count: number, table: string) => {
    if (count === 0) return '';
    return `
      <h3 style="margin:0 0 8px;font-size:15px">${emoji} ${label} <span style="color:#6b7280;font-weight:400;font-size:13px">(${count})</span></h3>
      ${table}`;
  };

  const appUrl = process.env.AUTH_URL ?? '';

  return `
    <div style="font-family:sans-serif;max-width:620px">
      <h2 style="margin:0 0 4px">📋 Daily Digest — ${dateStr}</h2>
      <p style="color:#6b7280;margin:0 0 20px;font-size:13px">
        🔴 ${overdue.length} overdue &nbsp;·&nbsp;
        📅 ${dueToday.length} due today &nbsp;·&nbsp;
        ⚠️ ${dueSoon.length} due soon &nbsp;·&nbsp;
        🚫 ${blocked.length} blocked &gt;3d
      </p>
      ${section('🔴', 'Overdue', overdue.length, overdueTable)}
      ${section('📅', 'Due Today', dueToday.length, todayTable)}
      ${section('⚠️', 'Due Soon (next 3 days)', dueSoon.length, soonTable)}
      ${section('🚫', 'Blocked >3 Days', blocked.length, blockedTable)}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin-top:8px"/>
      <p style="font-size:12px;color:#9ca3af;margin:12px 0 0">
        LSLL HUB · Daily Digest
        ${appUrl ? ` · <a href="${appUrl}" style="color:#6366f1">Open dashboard</a>` : ''}
      </p>
    </div>`;
}

async function sendDigestEmail(data: DigestData): Promise<boolean> {
  const digestTo = process.env.DIGEST_TO;
  if (!process.env.SMTP_HOST || !digestTo) {
    logger.info('[Digest] Email skipped — SMTP_HOST or DIGEST_TO not set');
    return false;
  }

  const total = data.overdue.length + data.dueToday.length + data.dueSoon.length + data.blocked.length;
  const dateStr = data.generatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const subject = total === 0
    ? `[LSLL HUB] Daily Digest — ${dateStr} · All clear ✅`
    : `[LSLL HUB] Daily Digest — ${dateStr} · ${total} items need attention`;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  const recipients = digestTo.split(',').map(e => e.trim()).filter(Boolean);

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? 'noreply@opsdesktop.internal',
      to: recipients.join(', '),
      subject,
      html: buildEmailHtml(data),
      text: `Daily Ops Digest — ${dateStr}\n\nOverdue: ${data.overdue.length}\nDue Today: ${data.dueToday.length}\nDue Soon: ${data.dueSoon.length}\nBlocked >3d: ${data.blocked.length}`,
    });
    logger.info({ to: recipients, subject }, '[Digest] Email sent');
    return true;
  } catch (err) {
    logger.error({ err }, '[Digest] Email send failed');
    return false;
  }
}

// ─── Slack ────────────────────────────────────────────────────────────────────

async function sendSlackDigest(data: DigestData): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.info('[Digest] Slack skipped — SLACK_WEBHOOK_URL not set');
    return false;
  }

  const { overdue, dueToday, dueSoon, blocked, generatedAt } = data;
  const total = overdue.length + dueToday.length + dueSoon.length + blocked.length;
  const dateStr = generatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const now = generatedAt;

  const MAX = 10;

  const itemLine = (w: DigestItem, extra?: string) => {
    const owner = w.ownerName ?? w.ownerEmail ?? 'Unassigned';
    return `• *${w.title}* — ${owner}${extra ? ` (${extra})` : ''}`;
  };

  const sectionBlock = (emoji: string, label: string, items: DigestItem[], lineFn: (w: DigestItem) => string) => {
    if (items.length === 0) return null;
    const shown = items.slice(0, MAX);
    const overflow = items.length - shown.length;
    const lines = shown.map(lineFn).join('\n');
    const text = `*${emoji} ${label}*\n${lines}${overflow > 0 ? `\n_…and ${overflow} more_` : ''}`;
    return { type: 'section', text: { type: 'mrkdwn', text } };
  };

  const blocks: any[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `📋 Ops Daily Digest — ${dateStr}`, emoji: true },
    },
  ];

  if (total === 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '✅ *All clear* — nothing is overdue, due, or blocked today.' },
    });
  } else {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🔴 *${overdue.length} overdue*   📅 *${dueToday.length} due today*   ⚠️ *${dueSoon.length} due soon*   🚫 *${blocked.length} blocked >3d*`,
      },
    });
    blocks.push({ type: 'divider' });

    const overdueSection = sectionBlock('🔴', 'Overdue', overdue,
      w => itemLine(w, w.dueAt ? `${daysDiff(now, w.dueAt)}d overdue` : 'no date'));
    const todaySection = sectionBlock('📅', 'Due Today', dueToday,
      w => itemLine(w));
    const soonSection = sectionBlock('⚠️', 'Due Soon', dueSoon,
      w => itemLine(w, fmtDate(w.dueAt)));
    const blockedSection = sectionBlock('🚫', 'Blocked >3 Days', blocked,
      w => itemLine(w, w.statusChangedAt ? `${daysDiff(now, w.statusChangedAt)}d blocked` : 'blocked'));

    for (const b of [overdueSection, todaySection, soonSection, blockedSection]) {
      if (b) blocks.push(b);
    }
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });
    if (!res.ok) throw new Error(`Slack responded ${res.status}`);
    logger.info('[Digest] Slack message sent');
    return true;
  } catch (err) {
    logger.error({ err }, '[Digest] Slack send failed');
    return false;
  }
}

// ─── GHL Webhook ──────────────────────────────────────────────────────────────

async function sendGhlDigest(data: DigestData): Promise<boolean> {
  const webhookUrl = process.env.GHL_DIGEST_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.info('[Digest] GHL skipped — GHL_DIGEST_WEBHOOK_URL not set');
    return false;
  }

  const { overdue, dueToday, dueSoon, blocked, generatedAt } = data;
  const now = generatedAt;

  const toPayloadItem = (w: DigestItem) => ({
    id: w.id,
    title: w.title,
    type: typeLabel(w.type),
    ownerEmail: w.ownerEmail ?? null,
    dueAt: w.dueAt?.toISOString() ?? null,
  });

  const payload = {
    event: 'daily_digest',
    date: generatedAt.toISOString().split('T')[0],
    summary: {
      overdue: overdue.length,
      dueToday: dueToday.length,
      dueSoon: dueSoon.length,
      blockedOver3d: blocked.length,
    },
    items: {
      overdue: overdue.map(toPayloadItem),
      dueToday: dueToday.map(toPayloadItem),
      dueSoon: dueSoon.map(toPayloadItem),
      blocked: blocked.map(w => ({
        ...toPayloadItem(w),
        blockedReason: w.blockedReason ?? null,
        daysBlocked: w.statusChangedAt ? daysDiff(now, w.statusChangedAt) : null,
      })),
    },
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`GHL webhook responded ${res.status}`);
    logger.info('[Digest] GHL webhook sent');
    return true;
  } catch (err) {
    logger.error({ err }, '[Digest] GHL send failed');
    return false;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runDigest(): Promise<DigestResult> {
  const data = await getDigestData();

  const [emailOk, slackOk, ghlOk] = await Promise.all([
    sendDigestEmail(data),
    sendSlackDigest(data),
    sendGhlDigest(data),
  ]);

  return {
    summary: {
      overdue: data.overdue.length,
      dueToday: data.dueToday.length,
      dueSoon: data.dueSoon.length,
      blockedOver3d: data.blocked.length,
      total: data.overdue.length + data.dueToday.length + data.dueSoon.length + data.blocked.length,
    },
    sent: { email: emailOk, slack: slackOk, ghl: ghlOk },
  };
}
