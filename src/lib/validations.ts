import { z } from 'zod';
import { WorkItemType, WorkItemStatus, WorkItemPriority } from '@prisma/client';

export const createWorkItemSchema = z.object({
  type: z.nativeEnum(WorkItemType),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).default(''),
  priority: z.nativeEnum(WorkItemPriority).default(WorkItemPriority.MEDIUM),
  dueAt: z.string().datetime().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  // For triggers with dynamic fields
  customFields: z.record(z.any()).optional(),
});

export const updateWorkItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  status: z.nativeEnum(WorkItemStatus).optional(),
  priority: z.nativeEnum(WorkItemPriority).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  blockedReason: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  // TBP/Magazine required fields
  tbpGraphicsLocation: z.string().nullable().optional(),
  tbpPublishDate: z.string().datetime().nullable().optional(),
  tbpArticleLink: z.string().url().nullable().optional(),
  tbpTxTie: z.string().nullable().optional(),
  tbpMagazineIssue: z.string().nullable().optional(),
});

// TBP/Magazine work item types that require additional fields
export const TBP_MAGAZINE_TYPES: WorkItemType[] = [
  WorkItemType.TX_BOOK_PREVIEW_LEAD,
  WorkItemType.SPONSORED_EDITORIAL_REVIEW,
];

// Required fields for TBP/Magazine work items before NEEDS_QA or DONE status
export const tbpMagazineRequiredFieldsSchema = z.object({
  tbpGraphicsLocation: z.string().min(1, 'Graphics location is required'),
  tbpPublishDate: z.string().datetime('Publish date is required'),
  tbpArticleLink: z.string().url('Valid article link is required'),
  tbpTxTie: z.string().min(1, 'Texas tie/connection is required'),
});

// Validation function for TBP/Magazine status transitions
export function validateTbpMagazineForQA(workItem: {
  type: WorkItemType;
  tbpGraphicsLocation?: string | null;
  tbpPublishDate?: string | Date | null;
  tbpArticleLink?: string | null;
  tbpTxTie?: string | null;
}): { valid: boolean; errors: string[] } {
  if (!TBP_MAGAZINE_TYPES.includes(workItem.type)) {
    return { valid: true, errors: [] };
  }

  const errors: string[] = [];

  if (!workItem.tbpGraphicsLocation) {
    errors.push('Graphics location is required for TBP/Magazine items');
  }
  if (!workItem.tbpPublishDate) {
    errors.push('Publish date is required for TBP/Magazine items');
  }
  if (!workItem.tbpArticleLink) {
    errors.push('Article link is required for TBP/Magazine items');
  }
  if (!workItem.tbpTxTie) {
    errors.push('Texas tie/connection is required for TBP/Magazine items');
  }

  return { valid: errors.length === 0, errors };
}

// Check if all QC checkpoints are passed
export function validateQACheckpointsComplete(qcChecks: Array<{ status: string }>): {
  valid: boolean;
  passed: number;
  total: number;
  failed: number;
} {
  const total = qcChecks.length;
  const passed = qcChecks.filter((c) => c.status === 'PASSED').length;
  const failed = qcChecks.filter((c) => c.status === 'FAILED').length;

  return {
    valid: total > 0 && passed === total,
    passed,
    total,
    failed,
  };
}

export const createSubtaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  order: z.number().int().min(0).optional(),
});

export const updateSubtaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  order: z.number().int().min(0).optional(),
  completed: z.boolean().optional(),
});

export const createCommentSchema = z.object({
  body: z.string().min(1, 'Comment cannot be empty').max(5000),
});

export const ghlWebhookSchema = z.object({
  type: z.string(),
  locationId: z.string().optional(),
  contactId: z.string().optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  customData: z.record(z.any()).optional(),
});

export type CreateWorkItemInput = z.infer<typeof createWorkItemSchema>;
export type UpdateWorkItemInput = z.infer<typeof updateWorkItemSchema>;
export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>;
export type UpdateSubtaskInput = z.infer<typeof updateSubtaskSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type GHLWebhookPayload = z.infer<typeof ghlWebhookSchema>;
