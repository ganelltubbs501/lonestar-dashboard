import { NextResponse } from 'next/server';
import { runBookScraper } from '@/lib/bookScraper';
import { logCronRun } from '@/lib/cronLog';

export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (!process.env.CRON_SYNC_SECRET || secret !== process.env.CRON_SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const result = await runBookScraper();
    const durationMs = Date.now() - startedAt;

    await logCronRun({
      jobName: 'scrape-books',
      status: 'success',
      result: {
        sitesChecked: result.sitesChecked,
        resultsFound: result.resultsFound,
        runId: result.runId,
      },
      durationMs,
    });

    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    await logCronRun({
      jobName: 'scrape-books',
      status: 'error',
      error: e?.message ?? 'Scrape failed',
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({ ok: false, error: e?.message ?? 'Scrape failed' }, { status: 500 });
  }
}
