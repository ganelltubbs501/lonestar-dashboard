/**
 * Go High Level (GHL) API Client
 *
 * This module provides outbound API calls to GHL.
 * All outbound actions are feature-flagged via GHL_OUTBOUND_ENABLED env var.
 *
 * Required env vars:
 * - GHL_API_KEY: API key for GHL
 * - GHL_LOCATION_ID: Location ID for your GHL account
 * - GHL_OUTBOUND_ENABLED: Set to "true" to enable outbound calls (defaults to "false")
 */

import logger from '@/lib/logger';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

interface GHLConfig {
  apiKey: string;
  locationId: string;
  enabled: boolean;
}

function getConfig(): GHLConfig {
  return {
    apiKey: process.env.GHL_API_KEY || '',
    locationId: process.env.GHL_LOCATION_ID || '',
    enabled: process.env.GHL_OUTBOUND_ENABLED === 'true',
  };
}

export function isGHLEnabled(): boolean {
  const config = getConfig();
  return config.enabled && !!config.apiKey && !!config.locationId;
}

async function ghlFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const config = getConfig();

  if (!config.enabled) {
    throw new Error('GHL outbound is disabled');
  }

  if (!config.apiKey) {
    throw new Error('GHL_API_KEY is not configured');
  }

  const url = `${GHL_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28',
      ...options.headers,
    },
  });

  return response;
}

// ============================================================================
// Contact Operations
// ============================================================================

export interface GHLContact {
  id?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  tags?: string[];
  source?: string;
  customFields?: Record<string, string>;
}

export interface GHLContactResponse {
  contact: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    [key: string]: unknown;
  };
}

/**
 * Create a new contact in GHL
 */
export async function createContact(contact: GHLContact): Promise<GHLContactResponse | null> {
  if (!isGHLEnabled()) {
    logger.info({ contact }, 'GHL outbound disabled - would create contact');
    return null;
  }

  const config = getConfig();

  try {
    const response = await ghlFetch('/contacts/', {
      method: 'POST',
      body: JSON.stringify({
        locationId: config.locationId,
        ...contact,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, error }, 'Failed to create GHL contact');
      throw new Error(`GHL API error: ${response.status}`);
    }

    const data = await response.json();
    logger.info({ contactId: data.contact?.id }, 'Created GHL contact');
    return data;
  } catch (error) {
    logger.error({ error }, 'Error creating GHL contact');
    throw error;
  }
}

/**
 * Update an existing contact in GHL
 */
export async function updateContact(
  contactId: string,
  updates: Partial<GHLContact>
): Promise<GHLContactResponse | null> {
  if (!isGHLEnabled()) {
    logger.info({ contactId, updates }, 'GHL outbound disabled - would update contact');
    return null;
  }

  try {
    const response = await ghlFetch(`/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, error }, 'Failed to update GHL contact');
      throw new Error(`GHL API error: ${response.status}`);
    }

    const data = await response.json();
    logger.info({ contactId }, 'Updated GHL contact');
    return data;
  } catch (error) {
    logger.error({ error }, 'Error updating GHL contact');
    throw error;
  }
}

/**
 * Look up a contact by email
 */
export async function findContactByEmail(email: string): Promise<GHLContactResponse | null> {
  if (!isGHLEnabled()) {
    logger.info({ email }, 'GHL outbound disabled - would search contact');
    return null;
  }

  const config = getConfig();

  try {
    const response = await ghlFetch(
      `/contacts/lookup?locationId=${config.locationId}&email=${encodeURIComponent(email)}`
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, error }, 'Failed to lookup GHL contact');
      throw new Error(`GHL API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    logger.error({ error }, 'Error looking up GHL contact');
    throw error;
  }
}

// ============================================================================
// Opportunity Operations
// ============================================================================

export interface GHLOpportunity {
  id?: string;
  name: string;
  contactId?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  status?: 'open' | 'won' | 'lost' | 'abandoned';
  monetaryValue?: number;
  source?: string;
  customFields?: Record<string, string>;
}

export interface GHLOpportunityResponse {
  opportunity: {
    id: string;
    name: string;
    [key: string]: unknown;
  };
}

/**
 * Create a new opportunity in GHL
 */
export async function createOpportunity(
  opportunity: GHLOpportunity
): Promise<GHLOpportunityResponse | null> {
  if (!isGHLEnabled()) {
    logger.info({ opportunity }, 'GHL outbound disabled - would create opportunity');
    return null;
  }

  const config = getConfig();

  try {
    const response = await ghlFetch('/opportunities/', {
      method: 'POST',
      body: JSON.stringify({
        locationId: config.locationId,
        ...opportunity,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, error }, 'Failed to create GHL opportunity');
      throw new Error(`GHL API error: ${response.status}`);
    }

    const data = await response.json();
    logger.info({ opportunityId: data.opportunity?.id }, 'Created GHL opportunity');
    return data;
  } catch (error) {
    logger.error({ error }, 'Error creating GHL opportunity');
    throw error;
  }
}

/**
 * Update an existing opportunity in GHL
 */
export async function updateOpportunity(
  opportunityId: string,
  updates: Partial<GHLOpportunity>
): Promise<GHLOpportunityResponse | null> {
  if (!isGHLEnabled()) {
    logger.info({ opportunityId, updates }, 'GHL outbound disabled - would update opportunity');
    return null;
  }

  try {
    const response = await ghlFetch(`/opportunities/${opportunityId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, error }, 'Failed to update GHL opportunity');
      throw new Error(`GHL API error: ${response.status}`);
    }

    const data = await response.json();
    logger.info({ opportunityId }, 'Updated GHL opportunity');
    return data;
  } catch (error) {
    logger.error({ error }, 'Error updating GHL opportunity');
    throw error;
  }
}

// ============================================================================
// Task Operations
// ============================================================================

export interface GHLTask {
  id?: string;
  title: string;
  body?: string;
  contactId?: string;
  dueDate?: string;
  completed?: boolean;
  assignedTo?: string;
}

export interface GHLTaskResponse {
  task: {
    id: string;
    title: string;
    [key: string]: unknown;
  };
}

/**
 * Create a task in GHL
 */
export async function createTask(task: GHLTask): Promise<GHLTaskResponse | null> {
  if (!isGHLEnabled()) {
    logger.info({ task }, 'GHL outbound disabled - would create task');
    return null;
  }

  try {
    const response = await ghlFetch('/contacts/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, error }, 'Failed to create GHL task');
      throw new Error(`GHL API error: ${response.status}`);
    }

    const data = await response.json();
    logger.info({ taskId: data.task?.id }, 'Created GHL task');
    return data;
  } catch (error) {
    logger.error({ error }, 'Error creating GHL task');
    throw error;
  }
}
