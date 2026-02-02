import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, withAuth, withAdminAuth } from '@/lib/api-utils';
import { z } from 'zod';

const templateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  workItemType: z.enum([
    'BOOK_CAMPAIGN',
    'SOCIAL_ASSET_REQUEST',
    'SPONSORED_EDITORIAL_REVIEW',
    'TX_BOOK_PREVIEW_LEAD',
    'WEBSITE_EVENT',
    'ACCESS_REQUEST',
    'GENERAL',
  ]),
  subtasks: z.array(z.object({
    title: z.string().min(1),
    offsetDays: z.number().optional(),
  })),
  dueDaysOffset: z.number().min(0).default(7),
  isActive: z.boolean().default(true),
});

// GET /api/templates - List all trigger templates (admin sees all, others see active only)
export async function GET(request: NextRequest) {
  return withAuth(async (userId) => {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('all') === 'true';

    // Check if user is admin for showing inactive templates
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const showAll = includeInactive && user?.role === 'ADMIN';

    const templates = await prisma.triggerTemplate.findMany({
      where: showAll ? {} : { isActive: true },
      orderBy: [{ workItemType: 'asc' }, { name: 'asc' }],
    });

    return successResponse(templates);
  });
}

// POST /api/templates - Create a new template (admin only)
export async function POST(request: NextRequest) {
  return withAdminAuth(async () => {
    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body');
    }

    const result = templateSchema.safeParse(body);
    if (!result.success) {
      return errorResponse(result.error.issues.map(i => i.message).join(', '), 400);
    }

    const { name, description, workItemType, subtasks, dueDaysOffset, isActive } = result.data;

    const template = await prisma.triggerTemplate.create({
      data: {
        name,
        description: description || null,
        workItemType,
        subtasks,
        dueDaysOffset,
        isActive,
      },
    });

    return successResponse(template, 201);
  });
}
