import { prisma } from "@/lib/db";
import { successResponse, withAuth } from "@/lib/api-utils";

const MAX_PAGE_SIZE = 50;

export async function GET(req: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const skip = (page - 1) * limit;

    const contactedParam = searchParams.get("contacted");
    const contactedFilter =
      contactedParam === "true" ? true : contactedParam === "false" ? false : undefined;

    // Only search indexed/short-text fields. Searching phone/website/notes
    // with ILIKE on unindexed columns across large tables is slow.
    const where = {
      ...(q ? {
        OR: [
          { name:  { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { city:  { contains: q, mode: "insensitive" as const } },
          { state: { contains: q, mode: "insensitive" as const } },
        ],
      } : {}),
      ...(contactedFilter !== undefined ? { contacted: contactedFilter } : {}),
    };

    const [items, total, lastRun] = await Promise.all([
      prisma.texasAuthor.findMany({
        where,
        orderBy: { name: "asc" },
        take: limit,
        skip,
        select: {
          id: true, name: true, email: true, website: true,
          city: true, state: true, contacted: true,
          sourceRef: true, updatedAt: true,
        },
      }),
      prisma.texasAuthor.count({ where }),
      prisma.sheetsImportRun.findFirst({
        where: { kind: "TEXAS_AUTHORS" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return successResponse({ items, total, page, limit, lastRun });
  });
}
