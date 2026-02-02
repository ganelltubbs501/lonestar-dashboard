import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { WorkItemType, WorkItemStatus, WorkItemPriority } from '@prisma/client';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: Date | string | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d);
}

export const WorkItemTypeLabel: Record<WorkItemType, string> = {
  BOOK_CAMPAIGN: 'Book Campaign',
  SOCIAL_ASSET_REQUEST: 'Social Asset',
  SPONSORED_EDITORIAL_REVIEW: 'Editorial Review',
  TX_BOOK_PREVIEW_LEAD: 'TX Preview Lead',
  WEBSITE_EVENT: 'Website Event',
  ACCESS_REQUEST: 'Access Request',
  GENERAL: 'General',
};

export const StatusLabel: Record<WorkItemStatus, string> = {
  BACKLOG: 'Backlog',
  READY: 'Ready',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  IN_REVIEW: 'In Review',
  NEEDS_QA: 'Needs QA',
  DONE: 'Done',
};

export const PriorityLabel: Record<WorkItemPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const StatusColors: Record<WorkItemStatus, { bg: string; text: string }> = {
  BACKLOG: { bg: 'bg-gray-100', text: 'text-gray-700' },
  READY: { bg: 'bg-blue-100', text: 'text-blue-700' },
  IN_PROGRESS: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  BLOCKED: { bg: 'bg-red-100', text: 'text-red-700' },
  IN_REVIEW: { bg: 'bg-purple-100', text: 'text-purple-700' },
  NEEDS_QA: { bg: 'bg-orange-100', text: 'text-orange-700' },
  DONE: { bg: 'bg-green-100', text: 'text-green-700' },
};

export const PriorityColors: Record<WorkItemPriority, { bg: string; text: string }> = {
  LOW: { bg: 'bg-gray-100', text: 'text-gray-600' },
  MEDIUM: { bg: 'bg-blue-100', text: 'text-blue-700' },
  HIGH: { bg: 'bg-orange-100', text: 'text-orange-700' },
  URGENT: { bg: 'bg-red-100', text: 'text-red-700' },
};

export function isOverdue(dueAt: Date | string | null): boolean {
  if (!dueAt) return false;
  const d = typeof dueAt === 'string' ? new Date(dueAt) : dueAt;
  return d < new Date();
}

// Tags are now native Postgres arrays - no JSON parsing needed
export function parseTags(tags: string[]): string[] {
  return tags || [];
}
