/**
 * GHL Mapping Configuration
 *
 * Defines how WorkItem types map to GHL object types.
 * This can be customized via admin settings in the future.
 */

import { WorkItemType } from '@prisma/client';

export type GHLObjectType = 'contact' | 'opportunity' | 'task' | 'none';

export interface GHLMapping {
  ghlObjectType: GHLObjectType;
  createOnNew: boolean;
  updateOnChange: boolean;
  syncFields: string[];
}

/**
 * Default mappings for WorkItem types to GHL objects
 *
 * This can be overridden by database-stored mappings in the future.
 * For now, these are sensible defaults with most types set to 'none' (no sync).
 */
export const DEFAULT_MAPPINGS: Record<WorkItemType, GHLMapping> = {
  // Book campaigns could create opportunities to track campaign value
  BOOK_CAMPAIGN: {
    ghlObjectType: 'none', // Disabled by default
    createOnNew: false,
    updateOnChange: false,
    syncFields: ['title', 'status', 'dueAt'],
  },

  // Social asset requests - no GHL mapping by default
  SOCIAL_ASSET_REQUEST: {
    ghlObjectType: 'none',
    createOnNew: false,
    updateOnChange: false,
    syncFields: [],
  },

  // Editorial reviews could track as opportunities
  SPONSORED_EDITORIAL_REVIEW: {
    ghlObjectType: 'none', // Disabled by default
    createOnNew: false,
    updateOnChange: false,
    syncFields: ['title', 'status', 'dueAt'],
  },

  // TX Book Preview leads - these come FROM GHL, so we might update them back
  TX_BOOK_PREVIEW_LEAD: {
    ghlObjectType: 'contact', // These typically have an associated contact
    createOnNew: false, // Don't create - they come from GHL
    updateOnChange: true, // Update contact when status changes
    syncFields: ['status'],
  },

  // Website events - no GHL mapping
  WEBSITE_EVENT: {
    ghlObjectType: 'none',
    createOnNew: false,
    updateOnChange: false,
    syncFields: [],
  },

  // Access requests - no GHL mapping
  ACCESS_REQUEST: {
    ghlObjectType: 'none',
    createOnNew: false,
    updateOnChange: false,
    syncFields: [],
  },

  // General items - no GHL mapping
  GENERAL: {
    ghlObjectType: 'none',
    createOnNew: false,
    updateOnChange: false,
    syncFields: [],
  },
};

/**
 * Get the mapping configuration for a WorkItem type
 */
export function getMappingForType(type: WorkItemType): GHLMapping {
  return DEFAULT_MAPPINGS[type] || DEFAULT_MAPPINGS.GENERAL;
}

/**
 * Check if a WorkItem type should sync to GHL
 */
export function shouldSyncToGHL(type: WorkItemType): boolean {
  const mapping = getMappingForType(type);
  return mapping.ghlObjectType !== 'none' && (mapping.createOnNew || mapping.updateOnChange);
}

/**
 * Map WorkItem status to GHL opportunity status
 */
export function mapStatusToGHL(status: string): 'open' | 'won' | 'lost' | 'abandoned' {
  switch (status) {
    case 'DONE':
      return 'won';
    case 'BLOCKED':
      return 'abandoned';
    default:
      return 'open';
  }
}

/**
 * Map WorkItem status to GHL contact tags
 */
export function mapStatusToContactTags(type: WorkItemType, status: string): string[] {
  const tags: string[] = ['ops-desktop-synced'];

  // Add type-specific tag
  const typeTag = type.toLowerCase().replace(/_/g, '-');
  tags.push(`type-${typeTag}`);

  // Add status tag
  const statusTag = status.toLowerCase().replace(/_/g, '-');
  tags.push(`status-${statusTag}`);

  return tags;
}
