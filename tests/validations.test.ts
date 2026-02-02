import { describe, it, expect } from 'vitest';
import {
  createWorkItemSchema,
  updateWorkItemSchema,
  createSubtaskSchema,
  createCommentSchema,
  ghlWebhookSchema,
} from '../src/lib/validations';

describe('createWorkItemSchema', () => {
  it('validates a valid work item', () => {
    const result = createWorkItemSchema.safeParse({
      type: 'BOOK_CAMPAIGN',
      title: 'Test Campaign',
      description: 'A test description',
      priority: 'HIGH',
      tags: ['tag1'],
    });
    expect(result.success).toBe(true);
  });

  it('requires type field', () => {
    const result = createWorkItemSchema.safeParse({
      title: 'Test Campaign',
    });
    expect(result.success).toBe(false);
  });

  it('requires title field', () => {
    const result = createWorkItemSchema.safeParse({
      type: 'BOOK_CAMPAIGN',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty title', () => {
    const result = createWorkItemSchema.safeParse({
      type: 'BOOK_CAMPAIGN',
      title: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid date', () => {
    const result = createWorkItemSchema.safeParse({
      type: 'BOOK_CAMPAIGN',
      title: 'Test',
      dueAt: '2024-06-15T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('updateWorkItemSchema', () => {
  it('accepts partial updates', () => {
    const result = updateWorkItemSchema.safeParse({
      status: 'IN_PROGRESS',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object', () => {
    const result = updateWorkItemSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('validates status enum', () => {
    const result = updateWorkItemSchema.safeParse({
      status: 'INVALID_STATUS',
    });
    expect(result.success).toBe(false);
  });
});

describe('createSubtaskSchema', () => {
  it('validates a valid subtask', () => {
    const result = createSubtaskSchema.safeParse({
      title: 'Test subtask',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional order', () => {
    const result = createSubtaskSchema.safeParse({
      title: 'Test subtask',
      order: 5,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = createSubtaskSchema.safeParse({
      title: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('createCommentSchema', () => {
  it('validates a valid comment', () => {
    const result = createCommentSchema.safeParse({
      body: 'This is a comment',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty comment', () => {
    const result = createCommentSchema.safeParse({
      body: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('ghlWebhookSchema', () => {
  it('validates a valid webhook payload', () => {
    const result = ghlWebhookSchema.safeParse({
      type: 'ContactCreate',
      email: 'test@example.com',
      name: 'Test User',
    });
    expect(result.success).toBe(true);
  });

  it('requires type field', () => {
    const result = ghlWebhookSchema.safeParse({
      email: 'test@example.com',
    });
    expect(result.success).toBe(false);
  });

  it('validates email format', () => {
    const result = ghlWebhookSchema.safeParse({
      type: 'ContactCreate',
      email: 'invalid-email',
    });
    expect(result.success).toBe(false);
  });
});
