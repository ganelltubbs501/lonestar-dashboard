import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, validationErrorResponse, withAuth, withAdminAuth } from '@/lib/api-utils';
import {
  updateWorkItemSchema,
  validateTbpMagazineForQA,
  validateQACheckpointsComplete,
  TBP_MAGAZINE_TYPES,
} from '@/lib/validations';
import logger from '@/lib/logger';
import { Prisma, WorkItemStatus } from '@prisma/client';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/work-items/[id] - Get a single work item with details
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(async () => {
    const { id } = await params;

    const item = await prisma.workItem.findUnique({
      where: { id },
      include: {
        requester: {
          select: { id: true, name: true, email: true, image: true },
        },
        owner: {
          select: { id: true, name: true, email: true, image: true },
        },
        subtasks: {
          orderBy: { order: 'asc' },
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, image: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        auditLogs: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!item) {
      return errorResponse('Work item not found', 404);
    }

    return successResponse(item);
  });
}

// PATCH /api/work-items/[id] - Update a work item
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withAuth(async (userId) => {
    const { id } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body');
    }

    const result = updateWorkItemSchema.safeParse(body);
    if (!result.success) {
      return validationErrorResponse(result.error);
    }

    const existing = await prisma.workItem.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        ownerId: true,
        title: true,
        type: true,
        tbpGraphicsLocation: true,
        tbpPublishDate: true,
        tbpArticleLink: true,
        tbpTxTie: true,
        tbpMagazineIssue: true,
        needsProofing: true,
        startedAt: true,
      },
    });

    if (!existing) {
      return errorResponse('Work item not found', 404);
    }

    // Validate status transitions to NEEDS_QA or DONE
    const newStatus = result.data.status;
    if (newStatus && (newStatus === WorkItemStatus.NEEDS_QA || newStatus === WorkItemStatus.DONE)) {
      // For TBP/Magazine types, validate required fields
      if (TBP_MAGAZINE_TYPES.includes(existing.type)) {
        const fieldValidation = validateTbpMagazineForQA({
          type: existing.type,
          tbpGraphicsLocation: result.data.tbpGraphicsLocation ?? existing.tbpGraphicsLocation,
          tbpPublishDate: result.data.tbpPublishDate ?? existing.tbpPublishDate,
          tbpArticleLink: result.data.tbpArticleLink ?? existing.tbpArticleLink,
          tbpTxTie: result.data.tbpTxTie ?? existing.tbpTxTie,
        });

        if (!fieldValidation.valid) {
          return errorResponse(
            `Cannot move to ${newStatus}: ${fieldValidation.errors.join(', ')}`,
            400
          );
        }
      }

      // For transition to DONE, verify QA is complete (if item has QC checks)
      if (newStatus === WorkItemStatus.DONE) {
        const qcChecks = await prisma.qCCheck.findMany({
          where: { workItemId: id },
          select: { status: true },
        });

        if (qcChecks.length > 0) {
          const qcValidation = validateQACheckpointsComplete(qcChecks);
          if (!qcValidation.valid) {
            return errorResponse(
              `Cannot mark as DONE: QA not complete (${qcValidation.passed}/${qcValidation.total} passed, ${qcValidation.failed} failed)`,
              400
            );
          }
        }
      }
    }

    const updateData: Record<string, unknown> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (result.data.title !== undefined) {
      updateData.title = result.data.title;
    }
    if (result.data.description !== undefined) {
      updateData.description = result.data.description;
    }
    if (result.data.status !== undefined) {
      changes.status = { from: existing.status, to: result.data.status };
      updateData.status = result.data.status;
    }
    if (result.data.priority !== undefined) {
      updateData.priority = result.data.priority;
    }
    if (result.data.dueAt !== undefined) {
      updateData.dueAt = result.data.dueAt ? new Date(result.data.dueAt) : null;
    }
    if (result.data.ownerId !== undefined) {
      if (existing.ownerId !== result.data.ownerId) {
        changes.ownerId = { from: existing.ownerId, to: result.data.ownerId };
      }
      updateData.ownerId = result.data.ownerId;
    }
    if (result.data.blockedReason !== undefined) {
      updateData.blockedReason = result.data.blockedReason;
    }
    if (result.data.tags !== undefined) {
      updateData.tags = result.data.tags;
    }
    // TBP/Magazine fields
    if (result.data.tbpGraphicsLocation !== undefined) {
      updateData.tbpGraphicsLocation = result.data.tbpGraphicsLocation;
    }
    if (result.data.tbpPublishDate !== undefined) {
      updateData.tbpPublishDate = result.data.tbpPublishDate ? new Date(result.data.tbpPublishDate) : null;
    }
    if (result.data.tbpArticleLink !== undefined) {
      updateData.tbpArticleLink = result.data.tbpArticleLink;
    }
    if (result.data.tbpTxTie !== undefined) {
      updateData.tbpTxTie = result.data.tbpTxTie;
    }
    if (result.data.tbpMagazineIssue !== undefined) {
      updateData.tbpMagazineIssue = result.data.tbpMagazineIssue;
    }

    // Audit fields — always stamp who updated, and when status/owner changed
    updateData.updatedById = userId;
    if (result.data.status !== undefined && result.data.status !== existing.status) {
      updateData.statusChangedAt = new Date();
      const ns = result.data.status;
      // Lifecycle: stamp startedAt once (first IN_PROGRESS), completedAt on DONE
      if (ns === WorkItemStatus.IN_PROGRESS && !existing.startedAt) {
        updateData.startedAt = new Date();
      }
      if (ns === WorkItemStatus.DONE) {
        updateData.completedAt = new Date();
      }
      if (existing.status === WorkItemStatus.DONE && ns !== WorkItemStatus.DONE) {
        updateData.completedAt = null; // reopened — clear completedAt
      }
    }
    if (result.data.ownerId !== undefined && result.data.ownerId !== existing.ownerId) {
      updateData.ownerChangedAt = new Date();
    }

    const item = await prisma.workItem.update({
      where: { id },
      data: updateData,
      include: {
        requester: {
          select: { id: true, name: true, email: true, image: true },
        },
        owner: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Log significant changes
    if (Object.keys(changes).length > 0) {
      const action = changes.status ? 'status_changed' : changes.ownerId ? 'owner_changed' : 'updated';
      await prisma.auditLog.create({
        data: {
          workItemId: id,
          userId,
          action,
          fromValue: changes.status?.from?.toString() || changes.ownerId?.from?.toString() || null,
          toValue: changes.status?.to?.toString() || changes.ownerId?.to?.toString() || null,
          meta: changes as unknown as Prisma.InputJsonValue,
        },
      });
    }

    logger.info({ workItemId: id, changes, userId }, 'Work item updated');

    return successResponse(item);
  });
}

// DELETE /api/work-items/[id] - Delete a work item (ADMIN only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(async (userId) => {
    const { id } = await params;

    const existing = await prisma.workItem.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!existing) {
      return errorResponse('Work item not found', 404);
    }

    await prisma.workItem.delete({ where: { id } });

    logger.info({ workItemId: id, userId }, 'Work item deleted');

    return successResponse({ deleted: true });
  });
}
