import { NextResponse } from "next/server";
import { generateUpcomingDeadlines } from "@/lib/deadlines/generator";
import { logCronRun } from "@/lib/cronLog";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SYNC_SECRET || secret !== process.env.CRON_SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const result = await generateUpcomingDeadlines(35);
    const durationMs = Date.now() - startedAt;

    await logCronRun({
      jobName: "generate-deadlines",
      status: "success",
      result: { created: result.created, skipped: result.skipped },
      durationMs,
    });

    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    await logCronRun({
      jobName: "generate-deadlines",
      status: "error",
      error: e?.message ?? "Generation failed",
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      { ok: false, error: e?.message ?? "Generation failed" },
      { status: 500 }
    );
  }
}
