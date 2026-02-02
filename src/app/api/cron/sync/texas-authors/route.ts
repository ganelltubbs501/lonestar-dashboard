import { NextResponse } from "next/server";
import { syncTexasAuthors } from "@/lib/texasAuthors/sync";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SYNC_SECRET || secret !== process.env.CRON_SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncTexasAuthors();
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Sync failed" }, { status: 500 });
  }
}
