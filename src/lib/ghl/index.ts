/**
 * Go High Level Integration Module
 *
 * This module provides two-way integration with Go High Level (GHL):
 *
 * INBOUND (Webhooks):
 * - Receives webhook events from GHL at /api/webhooks/ghl
 * - Creates WorkItems from GHL contacts/opportunities
 * - Stores raw events in integration_events table
 *
 * OUTBOUND (API Sync):
 * - Syncs WorkItem changes to GHL (feature-flagged via GHL_OUTBOUND_ENABLED)
 * - Creates/updates contacts, opportunities, or tasks in GHL
 * - Links are stored in ghl_links table for bi-directional tracking
 *
 * Configuration:
 * - GHL_API_KEY: Required for outbound API calls
 * - GHL_LOCATION_ID: Your GHL location ID
 * - GHL_WEBHOOK_SECRET: Secret for verifying inbound webhooks
 * - GHL_OUTBOUND_ENABLED: Set to "true" to enable outbound sync (default: false)
 */

export { isGHLEnabled } from './client';
export {
  createContact,
  updateContact,
  findContactByEmail,
  createOpportunity,
  updateOpportunity,
  createTask,
} from './client';

export type { GHLContact, GHLOpportunity, GHLTask } from './client';

export {
  getMappingForType,
  shouldSyncToGHL,
  mapStatusToGHL,
  mapStatusToContactTags,
  DEFAULT_MAPPINGS,
} from './mappings';

export type { GHLMapping, GHLObjectType } from './mappings';

export {
  syncWorkItemOnCreate,
  syncWorkItemOnUpdate,
  getGHLSyncStatus,
} from './sync';

export type { SyncResult } from './sync';
