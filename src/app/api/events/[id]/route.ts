import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, withAuth, withAdminAuth } from '@/lib/api-utils';
import { z } from 'zod';

type RouteParams = { params: Promise<{ id: string }> };

const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  eventDate: z.string().datetime().optional(),
  venue: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  pipelineStatus: z
    .enum(['INTAKE', 'COMPILATION', 'READY_TO_UPLOAD', 'UPLOADED', 'ARCHIVED'])
    .optional(),
  batchDate: z.string().datetime().nullable().optional(),
  qcChecklist: z.record(z.boolean()).optional(),
  isWeekendEvent: z.boolean().optional(),
  weekendOwnerId: z.string().nullable().optional(),
});

// GET /api/events/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(async () => {
    const { id } = await params;

    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      return errorResponse('Event not found', 404);
    }

    return successResponse(event);
  });
}

// PATCH /api/events/[id] - Update event (including pipeline status changes)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withAuth(async (userId) => {
    const { id } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body');
    }

    const result = updateEventSchema.safeParse(body);
    if (!result.success) {
      return errorResponse('Validation failed: ' + JSON.stringify(result.error.issues));
    }

    const existing = await prisma.event.findUnique({
      where: { id },
      select: { id: true, pipelineStatus: true },
    });

    if (!existing) {
      return errorResponse('Event not found', 404);
    }

    const updateData: Record<string, unknown> = {};

    if (result.data.title !== undefined) updateData.title = result.data.title;
    if (result.data.description !== undefined) updateData.description = result.data.description;
    if (result.data.eventDate !== undefined)
      updateData.eventDate = new Date(result.data.eventDate);
    if (result.data.venue !== undefined) updateData.venue = result.data.venue;
    if (result.data.location !== undefined) updateData.location = result.data.location;
    if (result.data.pipelineStatus !== undefined) {
      updateData.pipelineStatus = result.data.pipelineStatus;

      // Auto-set uploadedAt when marked as uploaded
      if (result.data.pipelineStatus === 'UPLOADED') {
        updateData.uploadedAt = new Date();
        updateData.uploadedById = userId;
      }
    }
    if (result.data.batchDate !== undefined) {
      updateData.batchDate = result.data.batchDate ? new Date(result.data.batchDate) : null;
    }
    if (result.data.qcChecklist !== undefined) {
      updateData.qcChecklist = JSON.stringify(result.data.qcChecklist);
    }
    if (result.data.isWeekendEvent !== undefined)
      updateData.isWeekendEvent = result.data.isWeekendEvent;
    if (result.data.weekendOwnerId !== undefined)
      updateData.weekendOwnerId = result.data.weekendOwnerId;

    const event = await prisma.event.update({
      where: { id },
      data: updateData,
    });

    return successResponse(event);
  });
}

// DELETE /api/events/[id] - ADMIN only
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async () => {
    const { id } = await params;

    const existing = await prisma.event.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return errorResponse('Event not found', 404);
    }

    await prisma.event.delete({ where: { id } });

    return successResponse({ deleted: true });
  });
}
