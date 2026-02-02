import { prisma } from "@/lib/db";
import { errorResponse, successResponse, withAuth } from "@/lib/api-utils";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const item = await prisma.texasAuthor.findUnique({
      where: { id: params.id },
    });

    if (!item) return errorResponse("Not found", 404);
    return successResponse({ item });
  });
}
