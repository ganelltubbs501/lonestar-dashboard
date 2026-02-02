import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, withAdminAuth } from '@/lib/api-utils';
import { z } from 'zod';

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  subtasks: z.array(z.object({
    title: z.string().min(1),
    offsetDays: z.number().optional(),
  })).optional(),
  dueDaysOffset: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/templates/[id] - Get single template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAdminAuth(async () => {
    const { id } = await params;

    const template = await prisma.triggerTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return errorResponse('Template not found', 404);
    }

    return successResponse(template);
  });
}

// PUT /api/templates/[id] - Update template (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAdminAuth(async () => {
    const { id } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body');
    }

    const result = updateTemplateSchema.safeParse(body);
    if (!result.success) {
      return errorResponse(result.error.issues.map(i => i.message).join(', '), 400);
    }

    const existing = await prisma.triggerTemplate.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('Template not found', 404);
    }

    const template = await prisma.triggerTemplate.update({
      where: { id },
      data: result.data,
    });

    return successResponse(template);
  });
}

// DELETE /api/templates/[id] - Delete template (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAdminAuth(async () => {
    const { id } = await params;

    const existing = await prisma.triggerTemplate.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('Template not found', 404);
    }

    await prisma.triggerTemplate.delete({ where: { id } });

    return successResponse({ deleted: true });
  });
}
