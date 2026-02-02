/**
 * GHL Sync Service
 *
 * Handles outbound synchronization of WorkItems to GHL.
 * All sync operations are feature-flagged and gracefully handle failures.
 */

import { prisma } from '@/lib/db';
import logger from '@/lib/logger';
import { WorkItem } from '@prisma/client';
import {
  isGHLEnabled,
  createContact,
  updateContact,
  createOpportunity,
  updateOpportunity,
  GHLContact,
  GHLOpportunity,
} from './client';
import {
  getMappingForType,
  mapStatusToGHL,
  mapStatusToContactTags,
} from './mappings';

export interface SyncResult {
  success: boolean;
  ghlObjectType?: string;
  ghlObjectId?: string;
  error?: string;
}

/**
 * Sync a WorkItem to GHL on creation
 */
export async function syncWorkItemOnCreate(workItem: WorkItem): Promise<SyncResult> {
  if (!isGHLEnabled()) {
    return { success: true }; // Silent success when disabled
  }

  const mapping = getMappingForType(workItem.type);

  if (!mapping.createOnNew || mapping.ghlObjectType === 'none') {
    return { success: true }; // No sync configured
  }

  try {
    let ghlObjectId: string | undefined;

    if (mapping.ghlObjectType === 'contact') {
      // Check if there's already a linked contact
      const existingLink = await prisma.ghlLink.findFirst({
        where: { workItemId: workItem.id, ghlObjectType: 'contact' },
      });

      if (!existingLink) {
        // Create new contact
        const contact: GHLContact = {
          name: workItem.title,
          tags: mapStatusToContactTags(workItem.type, workItem.status),
          source: 'ops-desktop',
        };

        const result = await createContact(contact);
        ghlObjectId = result?.contact.id;

        if (ghlObjectId) {
          await prisma.ghlLink.create({
            data: {
              workItemId: workItem.id,
              ghlObjectType: 'contact',
              ghlObjectId,
            },
          });
        }
      }
    } else if (mapping.ghlObjectType === 'opportunity') {
      const opportunity: GHLOpportunity = {
        name: workItem.title,
        status: mapStatusToGHL(workItem.status),
        source: 'ops-desktop',
      };

      const result = await createOpportunity(opportunity);
      ghlObjectId = result?.opportunity.id;

      if (ghlObjectId) {
        await prisma.ghlLink.create({
          data: {
            workItemId: workItem.id,
            ghlObjectType: 'opportunity',
            ghlObjectId,
          },
        });
      }
    }

    logger.info(
      { workItemId: workItem.id, ghlObjectType: mapping.ghlObjectType, ghlObjectId },
      'Synced WorkItem to GHL on create'
    );

    return {
      success: true,
      ghlObjectType: mapping.ghlObjectType,
      ghlObjectId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      { workItemId: workItem.id, error: errorMessage },
      'Failed to sync WorkItem to GHL on create'
    );

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Sync a WorkItem to GHL on update
 */
export async function syncWorkItemOnUpdate(
  workItem: WorkItem,
  changedFields: string[]
): Promise<SyncResult> {
  if (!isGHLEnabled()) {
    return { success: true }; // Silent success when disabled
  }

  const mapping = getMappingForType(workItem.type);

  if (!mapping.updateOnChange || mapping.ghlObjectType === 'none') {
    return { success: true }; // No sync configured
  }

  // Check if any synced fields changed
  const relevantChanges = changedFields.filter((f) => mapping.syncFields.includes(f));
  if (relevantChanges.length === 0) {
    return { success: true }; // No relevant changes
  }

  try {
    // Find linked GHL object
    const link = await prisma.ghlLink.findFirst({
      where: {
        workItemId: workItem.id,
        ghlObjectType: mapping.ghlObjectType,
      },
    });

    if (!link) {
      // No linked object to update
      return { success: true };
    }

    if (mapping.ghlObjectType === 'contact') {
      await updateContact(link.ghlObjectId, {
        tags: mapStatusToContactTags(workItem.type, workItem.status),
      });
    } else if (mapping.ghlObjectType === 'opportunity') {
      await updateOpportunity(link.ghlObjectId, {
        status: mapStatusToGHL(workItem.status),
      });
    }

    logger.info(
      { workItemId: workItem.id, ghlObjectId: link.ghlObjectId, changedFields: relevantChanges },
      'Synced WorkItem to GHL on update'
    );

    return {
      success: true,
      ghlObjectType: mapping.ghlObjectType,
      ghlObjectId: link.ghlObjectId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      { workItemId: workItem.id, error: errorMessage },
      'Failed to sync WorkItem to GHL on update'
    );

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get GHL sync status for a WorkItem
 */
export async function getGHLSyncStatus(workItemId: string) {
  const links = await prisma.ghlLink.findMany({
    where: { workItemId },
  });

  return {
    isLinked: links.length > 0,
    links: links.map((l) => ({
      objectType: l.ghlObjectType,
      objectId: l.ghlObjectId,
      createdAt: l.createdAt,
    })),
  };
}
