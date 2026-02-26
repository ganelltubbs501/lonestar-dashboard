import { NextResponse } from 'next/server';
import { runSerReminders } from '@/lib/serReminders';
import { logCronRun } from '@/lib/cronLog';

// POST /api/cron/ser-reminders
// Called by Cloud Scheduler daily. Auth: x-cron-secret header.
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (!process.env.CRON_SYNC_SECRET || secret !== process.env.CRON_SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const result = await runSerReminders();
    const durationMs = Date.now() - startedAt;

    await logCronRun({
      jobName: 'ser-reminders',
      status: result.errors.length === 0 ? 'success' : 'error',
      result: { sent: result.sent, skipped: result.skipped, errors: result.errors.length },
      error: result.errors.length > 0 ? result.errors[0] : undefined,
      durationMs,
    });

    return NextResponse.json({ ok: true, ...result, durationMs });
  } catch (err: any) {
    const durationMs = Date.now() - startedAt;
    await logCronRun({
      jobName: 'ser-reminders',
      status: 'error',
      error: err?.message ?? String(err),
      durationMs,
    });
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
