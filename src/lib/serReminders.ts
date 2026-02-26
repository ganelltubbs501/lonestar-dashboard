import { prisma } from './db';
import { sendSerEmail } from './serEmail';
import logger from './logger';
import { WorkItemStatus } from '@prisma/client';

export type ReminderType = 'DUE_7DAY' | 'DUE_2DAY' | 'OVERDUE';

const SER_TYPE = 'SPONSORED_EDITORIAL_REVIEW';
const APP_URL =
  process.env.AUTH_URL ??
  'https://ops-desktop-41047594468.us-east5.run.app';

interface SERItem {
  id: string;
  title: string;
  status: string;
  dueAt: Date | null;
  ownerId: string | null;
  owner: { name: string | null; email: string } | null;
}

export interface ReminderResult {
  sent: number;
  skipped: number;
  errors: string[];
  detail: Array<{ workItemId: string; type: ReminderType; emailed: boolean }>;
}

export async function runSerReminders(): Promise<ReminderResult> {
  const now = new Date();
  const adminEmail = process.env.ADMIN_EMAIL ?? '';
  const result: ReminderResult = { sent: 0, skipped: 0, errors: [], detail: [] };

  // All non-DONE SER items with a due date
  const items = (await prisma.workItem.findMany({
    where: {
      type: SER_TYPE as any,
      status: { not: WorkItemStatus.DONE },
      dueAt: { not: null },
    },
    select: {
      id: true,
      title: true,
      status: true,
      dueAt: true,
      ownerId: true,
      owner: { select: { name: true, email: true } },
    },
  })) as unknown as SERItem[];

  if (items.length === 0) return result;

  const itemIds = items.map((i) => i.id);

  // Fetch existing reminders for these items
  const existing = await (prisma as any).serReminder.findMany({
    where: { workItemId: { in: itemIds } },
    select: { workItemId: true, type: true, sentAt: true },
  });

  // Quick-lookup: "workItemId:type" → already sent (for DUE_7DAY / DUE_2DAY)
  const sentSet = new Set<string>(existing.map((r: any) => `${r.workItemId}:${r.type}`));

  // For OVERDUE: track most-recent sentAt per item so we can re-send after 3 days
  const lastOverdue = new Map<string, Date>();
  for (const r of existing) {
    if (r.type === 'OVERDUE') {
      const prev = lastOverdue.get(r.workItemId);
      if (!prev || new Date(r.sentAt) > prev) lastOverdue.set(r.workItemId, new Date(r.sentAt));
    }
  }

  for (const item of items) {
    if (!item.dueAt) continue;
    const dueAt = new Date(item.dueAt);
    const daysUntilDue = Math.ceil((dueAt.getTime() - now.getTime()) / 86400000);

    const recipients = [...new Set([item.owner?.email, adminEmail].filter((e): e is string => !!e))];
    const itemUrl = `${APP_URL}/board`;

    // ─── 7-day reminder ─────────────────────────────────────────────────────
    if (daysUntilDue >= 5 && daysUntilDue <= 8) {
      const key = `${item.id}:DUE_7DAY`;
      if (sentSet.has(key)) {
        result.skipped++;
      } else {
        try {
          const emailed = await sendSerEmail({
            to: recipients,
            subject: `[SER] Action required — "${item.title}" due in ${daysUntilDue} days`,
            heading: `SER due in ${daysUntilDue} days`,
            body: `"${item.title}" (${item.status}) is due on ${dueAt.toDateString()}. Owner: ${item.owner?.name ?? 'Unassigned'}.`,
            itemUrl,
          });
          await (prisma as any).serReminder.create({
            data: { workItemId: item.id, type: 'DUE_7DAY' },
          });
          result.sent++;
          result.detail.push({ workItemId: item.id, type: 'DUE_7DAY', emailed });
        } catch (err) {
          result.errors.push(`DUE_7DAY ${item.id}: ${String(err)}`);
        }
      }
    }

    // ─── 2-day reminder ─────────────────────────────────────────────────────
    if (daysUntilDue >= 0 && daysUntilDue <= 3) {
      const key = `${item.id}:DUE_2DAY`;
      if (sentSet.has(key)) {
        result.skipped++;
      } else {
        try {
          const d = daysUntilDue;
          const emailed = await sendSerEmail({
            to: recipients,
            subject: `[SER] URGENT — "${item.title}" due in ${d} day${d === 1 ? '' : 's'}`,
            heading: `⚠️ SER due in ${d} day${d === 1 ? '' : 's'}`,
            body: `"${item.title}" (${item.status}) is nearly due! Due: ${dueAt.toDateString()}. Owner: ${item.owner?.name ?? 'Unassigned'}.`,
            itemUrl,
          });
          await (prisma as any).serReminder.create({
            data: { workItemId: item.id, type: 'DUE_2DAY' },
          });
          result.sent++;
          result.detail.push({ workItemId: item.id, type: 'DUE_2DAY', emailed });
        } catch (err) {
          result.errors.push(`DUE_2DAY ${item.id}: ${String(err)}`);
        }
      }
    }

    // ─── Overdue escalation (resends every 3 days) ──────────────────────────
    if (daysUntilDue < 0) {
      const daysPast = Math.abs(daysUntilDue);
      const last = lastOverdue.get(item.id);
      const shouldSend = !last || Date.now() - last.getTime() > 3 * 86400000;
      if (!shouldSend) {
        result.skipped++;
      } else {
        try {
          const emailed = await sendSerEmail({
            to: recipients,
            subject: `[SER] 🔴 OVERDUE — "${item.title}" (${daysPast}d past due)`,
            heading: `🔴 SER OVERDUE — ${daysPast} day${daysPast === 1 ? '' : 's'} past due`,
            body: `"${item.title}" (${item.status}) was due on ${dueAt.toDateString()}. Owner: ${item.owner?.name ?? 'Unassigned'}. Immediate action required.`,
            itemUrl,
          });
          await (prisma as any).serReminder.create({
            data: { workItemId: item.id, type: 'OVERDUE' },
          });
          result.sent++;
          result.detail.push({ workItemId: item.id, type: 'OVERDUE', emailed });
          lastOverdue.set(item.id, now);
        } catch (err) {
          result.errors.push(`OVERDUE ${item.id}: ${String(err)}`);
        }
      }
    }
  }

  logger.info(result, '[SerReminders] run complete');
  return result;
}
