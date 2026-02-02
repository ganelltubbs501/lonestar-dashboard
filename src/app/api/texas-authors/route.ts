import { prisma } from "@/lib/db";
import { successResponse, withAuth } from "@/lib/api-utils";

export async function GET(req: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();

    const items = await prisma.texasAuthor.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { website: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true, email: true, website: true, city: true, state: true, updatedAt: true },
    });

    const lastRun = await prisma.sheetsImportRun.findFirst({
      where: { kind: "TEXAS_AUTHORS" },
      orderBy: { createdAt: "desc" },
    });

    return successResponse({ items, lastRun });
  });
}
