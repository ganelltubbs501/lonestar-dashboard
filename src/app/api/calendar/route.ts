import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, withAuth } from '@/lib/api-utils';
import { z } from 'zod';

const createDeadlineSchema = z.object({
  type: z.enum([
    'CAMPAIGN',
    'SER',
    'MAGAZINE',
    'TBP',
    'EVENTS',
    'NEWSLETTER',
  ]),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  dueAt: z.string().datetime(),
  isRecurring: z.boolean().default(false),
  recurrence: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY']).nullable().optional(),
  ownerId: z.string().nullable().optional(),
});

// GET /api/calendar - Get editorial deadlines for date range
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);

    // Default to next 14 days
    const startDate = searchParams.get('start')
      ? new Date(searchParams.get('start')!)
      : new Date();
    const endDate = searchParams.get('end')
      ? new Date(searchParams.get('end')!)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const type = searchParams.get('type');
    const ownerId = searchParams.get('ownerId');
    const needsProofing = searchParams.get('needsProofing') === 'true';

    // Get editorial deadlines
    const deadlines = await prisma.editorialDeadline.findMany({
      where: {
        dueAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(type ? { type: type as any } : {}),
        ...(ownerId ? { ownerId } : {}),
      },
      orderBy: { dueAt: 'asc' },
    });

    // Also get work items with due dates in range
    const workItems = await prisma.workItem.findMany({
      where: {
        dueAt: {
          gte: startDate,
          lte: endDate,
        },
        status: { not: 'DONE' },
        ...(ownerId ? { ownerId } : {}),
        ...(needsProofing ? { needsProofing: true } : {}),
      },
      include: {
        owner: { select: { id: true, name: true, image: true } },
      },
      orderBy: { dueAt: 'asc' },
    });

    // Combine and sort by date
    const combined = [
      ...deadlines.map((d) => ({
        id: d.id,
        type: 'deadline' as const,
        deliverableType: d.type,
        title: d.title,
        description: d.description,
        dueAt: d.dueAt,
        status: d.status,
        ownerId: d.ownerId,
        isRecurring: d.isRecurring,
      })),
      ...workItems.map((w) => ({
        id: w.id,
        type: 'workItem' as const,
        deliverableType: w.type,
        title: w.title,
        description: w.description,
        dueAt: w.dueAt,
        status: w.status,
        ownerId: w.ownerId,
        owner: w.owner,
        needsProofing: w.needsProofing,
        priority: w.priority,
      })),
    ].sort((a, b) => {
      const dateA = a.dueAt ? new Date(a.dueAt).getTime() : 0;
      const dateB = b.dueAt ? new Date(b.dueAt).getTime() : 0;
      return dateA - dateB;
    });

    return successResponse({
      deadlines,
      workItems,
      combined,
      dateRange: { start: startDate, end: endDate },
    });
  });
}

// POST /api/calendar - Create a new editorial deadline
export async function POST(request: NextRequest) {
  return withAuth(async () => {
    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body');
    }

    const result = createDeadlineSchema.safeParse(body);
    if (!result.success) {
      return errorResponse('Validation failed: ' + JSON.stringify(result.error.issues));
    }

    const deadline = await prisma.editorialDeadline.create({
      data: {
        type: result.data.type,
        title: result.data.title,
        description: result.data.description,
        dueAt: new Date(result.data.dueAt),
        isRecurring: result.data.isRecurring,
        recurrence: result.data.recurrence || null,
        ownerId: result.data.ownerId || null,
      },
    });

    return successResponse(deadline, 201);
  });
}
