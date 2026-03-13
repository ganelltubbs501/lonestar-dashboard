import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runBookScraper, formatResultsAsTxt } from '@/lib/bookScraper';

function ok(data: unknown) {
  return NextResponse.json({ success: true, data });
}
function err(msg: string, status = 500) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

// GET /api/scrape-results          → list of runs
// GET /api/scrape-results?runId=…  → results for a run
// GET /api/scrape-results?runId=…&format=txt → download txt
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get('runId');
    const format = searchParams.get('format');

    if (!runId) {
      const runs = await (prisma as any).bookScrapeRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: 20,
        select: {
          id: true, startedAt: true, finishedAt: true,
          status: true, sitesChecked: true, resultsFound: true, error: true,
        },
      });
      return ok({ runs });
    }

    const run = await (prisma as any).bookScrapeRun.findUnique({ where: { id: runId } });
    if (!run) return err('Run not found', 404);

    const results = await (prisma as any).bookScrapeResult.findMany({
      where: { runId },
      orderBy: { texasConnection: 'asc' },
    });

    if (format === 'txt') {
      const txt = formatResultsAsTxt(run, results);
      return new NextResponse(txt, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="texas-books-${new Date(run.startedAt).toISOString().slice(0, 10)}.txt"`,
        },
      });
    }

    return ok({ run, results });
  } catch (e: any) {
    return err(e?.message ?? 'Internal error');
  }
}

// POST /api/scrape-results → trigger manual run (fire-and-forget)
export async function POST() {
  try {
    // Create the run record immediately so UI can poll it
    const run = await (prisma as any).bookScrapeRun.create({
      data: { status: 'RUNNING' },
    });

    // Kick off the scraper without awaiting — responds immediately
    runBookScraper(run.id).catch(() => {});

    return ok({ runId: run.id, status: 'RUNNING' });
  } catch (e: any) {
    return err(e?.message ?? 'Scrape failed');
  }
}
