import { withAdminAuth, successResponse, errorResponse } from "@/lib/api-utils";
import { syncTexasAuthors } from "@/lib/texasAuthors/sync";
import { prisma } from "@/lib/db";
import logger from "@/lib/logger";

const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

export async function POST() {
  return withAdminAuth(async () => {
    // Rate limit: reject if a sync completed less than 5 minutes ago
    const lastRun = await prisma.sheetsImportRun.findFirst({
      where: { kind: "TEXAS_AUTHORS" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (lastRun && Date.now() - lastRun.createdAt.getTime() < RATE_LIMIT_MS) {
      const retryAfter = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastRun.createdAt.getTime())) / 1000);
      return errorResponse(`Sync was run recently. Try again in ${retryAfter}s.`, 429);
    }

    try {
      const result = await syncTexasAuthors();
      return successResponse({ result });
    } catch (err: any) {
      const errorDetails = {
        message: err?.message ?? String(err),
        name: err?.name,
        stack: err?.stack,
        cause: err?.cause,
      };

      logger.error({ error: errorDetails }, "Texas Authors sync failed");

      return errorResponse(err?.message ?? "Texas Authors sync failed", 500);
    }
  });
}
