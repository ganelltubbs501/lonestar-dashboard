import { NextResponse } from 'next/server';
import { runDigest } from '@/lib/digest';
import { logCronRun } from '@/lib/cronLog';

// POST /api/cron/digest
// Called by Cloud Scheduler daily at 08:00 CT (14:00 UTC). Auth: x-cron-secret header.
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (!process.env.CRON_SYNC_SECRET || secret !== process.env.CRON_SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const result = await runDigest();
    const durationMs = Date.now() - startedAt;

    await logCronRun({
      jobName: 'daily-digest',
      status: 'success',
      result: { ...result.summary, sent: result.sent },
      durationMs,
    });

    return NextResponse.json({ ok: true, ...result, durationMs });
  } catch (err: any) {
    const durationMs = Date.now() - startedAt;
    await logCronRun({
      jobName: 'daily-digest',
      status: 'error',
      error: err?.message ?? String(err),
      durationMs,
    });
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
