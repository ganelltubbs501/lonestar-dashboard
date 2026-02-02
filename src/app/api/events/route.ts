import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, withAuth } from '@/lib/api-utils';
import { z } from 'zod';

const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  eventDate: z.string().datetime(),
  venue: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  sourceSheet: z.string().nullable().optional(),
  isWeekendEvent: z.boolean().default(false),
  weekendOwnerId: z.string().nullable().optional(),
});

// GET /api/events - Get events pipeline
export async function GET(request: NextRequest) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const isWeekend = searchParams.get('weekend') === 'true';
    const batchDate = searchParams.get('batchDate');

    const where: Record<string, unknown> = {};
    if (status) where.pipelineStatus = status;
    if (isWeekend) where.isWeekendEvent = true;
    if (batchDate) where.batchDate = new Date(batchDate);

    const events = await prisma.event.findMany({
      where,
      orderBy: [{ pipelineStatus: 'asc' }, { eventDate: 'asc' }],
    });

    // Group by pipeline status for queue view
    const queues = {
      intake: events.filter((e) => e.pipelineStatus === 'INTAKE'),
      compilation: events.filter((e) => e.pipelineStatus === 'COMPILATION'),
      readyToUpload: events.filter((e) => e.pipelineStatus === 'READY_TO_UPLOAD'),
      uploaded: events.filter((e) => e.pipelineStatus === 'UPLOADED'),
    };

    // Get weekend events separately
    const weekendEvents = events.filter((e) => e.isWeekendEvent);

    // Calculate next Friday for batch
    const today = new Date();
    const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + daysUntilFriday);
    nextFriday.setHours(0, 0, 0, 0);

    return successResponse({
      events,
      queues,
      weekendEvents,
      nextBatchDate: nextFriday,
    });
  });
}

// POST /api/events - Create a new event
export async function POST(request: NextRequest) {
  return withAuth(async () => {
    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body');
    }

    const result = createEventSchema.safeParse(body);
    if (!result.success) {
      return errorResponse('Validation failed: ' + JSON.stringify(result.error.issues));
    }

    const event = await prisma.event.create({
      data: {
        title: result.data.title,
        description: result.data.description,
        eventDate: new Date(result.data.eventDate),
        venue: result.data.venue || null,
        location: result.data.location || null,
        sourceSheet: result.data.sourceSheet || null,
        isWeekendEvent: result.data.isWeekendEvent,
        weekendOwnerId: result.data.weekendOwnerId || null,
        pipelineStatus: 'INTAKE',
      },
    });

    return successResponse(event, 201);
  });
}
