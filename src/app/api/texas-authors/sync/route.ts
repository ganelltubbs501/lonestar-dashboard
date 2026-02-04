import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { syncTexasAuthors } from "@/lib/texasAuthors/sync";
import logger from "@/lib/logger";

export async function POST() {
  return withAuth(async () => {
    try {
      const result = await syncTexasAuthors();
      return NextResponse.json({ success: true, result });
    } catch (err: any) {
      // Better error serialization for logging
      const errorDetails = {
        message: err?.message ?? String(err),
        name: err?.name,
        stack: err?.stack,
        cause: err?.cause,
      };

      logger.error({ error: errorDetails }, "Texas Authors sync failed");

      return NextResponse.json(
        {
          error: "Texas Authors sync failed",
          message: err?.message ?? String(err),
          details: process.env.NODE_ENV === "development" ? errorDetails : undefined,
        },
        { status: 500 }
      );
    }
  });
}
