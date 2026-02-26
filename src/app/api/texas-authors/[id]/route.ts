import { prisma } from "@/lib/db";
import { errorResponse, successResponse, withAuth } from "@/lib/api-utils";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const item = await prisma.texasAuthor.findUnique({ where: { id } });
    if (!item) return errorResponse("Not found", 404);
    return successResponse({ item });
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;
    const body = await req.json();

    const item = await prisma.texasAuthor.findUnique({ where: { id }, select: { id: true } });
    if (!item) return errorResponse("Not found", 404);

    const updated = await prisma.texasAuthor.update({
      where: { id },
      data: {
        ...(typeof body.contacted === "boolean" && { contacted: body.contacted }),
        ...(typeof body.notes === "string" && { notes: body.notes }),
        updatedAt: new Date(),
      },
    });
    return successResponse({ item: updated });
  });
}
