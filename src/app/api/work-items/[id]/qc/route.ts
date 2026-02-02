import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, withAuth } from '@/lib/api-utils';
import { z } from 'zod';

type RouteParams = { params: Promise<{ id: string }> };

const updateQCSchema = z.object({
  checkpoint: z.string(),
  status: z.enum(['PENDING', 'PASSED', 'FAILED', 'SKIPPED']),
  notes: z.string().nullable().optional(),
});

const addCheckpointsSchema = z.object({
  checkpoints: z.array(z.string()),
});

// GET /api/work-items/[id]/qc - Get QC checks for a work item
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(async () => {
    const { id } = await params;

    const checks = await prisma.qCCheck.findMany({
      where: { workItemId: id },
    });

    // Calculate completion stats
    const total = checks.length;
    const passed = checks.filter((c) => c.status === 'PASSED').length;
    const failed = checks.filter((c) => c.status === 'FAILED').length;
    const pending = checks.filter((c) => c.status === 'PENDING').length;

    return successResponse({
      checks,
      stats: {
        total,
        passed,
        failed,
        pending,
        completionRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      },
    });
  });
}

// POST /api/work-items/[id]/qc - Add QC checkpoints to a work item
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(async () => {
    const { id } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body');
    }

    const result = addCheckpointsSchema.safeParse(body);
    if (!result.success) {
      return errorResponse('Validation failed: ' + JSON.stringify(result.error.issues));
    }

    // Check work item exists
    const workItem = await prisma.workItem.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!workItem) {
      return errorResponse('Work item not found', 404);
    }

    // Create checkpoints
    const checks = await prisma.qCCheck.createMany({
      data: result.data.checkpoints.map((checkpoint) => ({
        workItemId: id,
        checkpoint,
        status: 'PENDING',
      })),
    });

    // Mark work item as needing proofing
    await prisma.workItem.update({
      where: { id },
      data: { needsProofing: true },
    });

    return successResponse({ created: checks.count }, 201);
  });
}

// PATCH /api/work-items/[id]/qc - Update a specific checkpoint
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withAuth(async (userId) => {
    const { id } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body');
    }

    const result = updateQCSchema.safeParse(body);
    if (!result.success) {
      return errorResponse('Validation failed: ' + JSON.stringify(result.error.issues));
    }

    // Find the checkpoint
    const check = await prisma.qCCheck.findFirst({
      where: {
        workItemId: id,
        checkpoint: result.data.checkpoint,
      },
    });

    if (!check) {
      return errorResponse('Checkpoint not found', 404);
    }

    // Update checkpoint
    const updated = await prisma.qCCheck.update({
      where: { id: check.id },
      data: {
        status: result.data.status,
        notes: result.data.notes,
        checkedAt: ['PASSED', 'FAILED'].includes(result.data.status) ? new Date() : null,
        checkedById: ['PASSED', 'FAILED'].includes(result.data.status) ? userId : null,
      },
    });

    // Check if all checkpoints are now complete
    const allChecks = await prisma.qCCheck.findMany({
      where: { workItemId: id },
    });

    const allComplete = allChecks.every((c) =>
      ['PASSED', 'SKIPPED'].includes(c.status)
    );

    if (allComplete && allChecks.length > 0) {
      await prisma.workItem.update({
        where: { id },
        data: {
          needsProofing: false,
        },
      });
    }

    return successResponse(updated);
  });
}
