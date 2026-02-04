import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ghlWebhookSchema } from '@/lib/validations';
import logger from '@/lib/logger';
import { Prisma, WorkItemType, WorkItemStatus, WorkItemPriority } from '@prisma/client';
import crypto from 'crypto';
import { webhookRateLimiter, getClientIP } from '@/lib/rate-limit';

// Verify webhook signature if secret is configured
function verifySignature(payload: string, signature: string | null): boolean {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (!secret) return true; // Skip verification if no secret configured

  if (!signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// POST /api/webhooks/ghl - Handle inbound GHL webhooks
export async function POST(request: NextRequest) {
  // Rate limiting: 30 requests per minute per IP
  const clientIP = getClientIP(request);
  const rateLimit = webhookRateLimiter.check(clientIP);

  if (!rateLimit.success) {
    logger.warn({ ip: clientIP, reset: rateLimit.reset }, 'Webhook rate limit exceeded');
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimit.reset),
        },
      }
    );
  }

  let payloadText: string;
  let payload: Record<string, unknown>;

  try {
    payloadText = await request.text();
    payload = JSON.parse(payloadText);
  } catch {
    logger.error('Invalid JSON in GHL webhook');
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Verify signature
  const signature = request.headers.get('x-ghl-signature');
  if (!verifySignature(payloadText, signature)) {
    logger.warn('Invalid GHL webhook signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Validate payload structure
  const result = ghlWebhookSchema.safeParse(payload);
  if (!result.success) {
    logger.warn({ errors: result.error.issues }, 'Invalid GHL webhook payload');
    // Still log the event even if validation fails
    await prisma.integrationEvent.create({
      data: {
        source: 'ghl',
        eventType: 'validation_failed',
        payload: payload as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { type, email, name, contactId } = result.data;

  logger.info({ type, email, contactId }, 'Processing GHL webhook');

  let workItem = null;
  let processed = false;

  try {
    // Handle contact creation - create a lead work item
    if (type === 'ContactCreate' || type === 'contact_created') {
      if (email) {
        // Find a system user to be the requester
        const systemUser = await prisma.user.findFirst({
          where: { role: 'ADMIN' },
        });

        if (systemUser) {
          workItem = await prisma.workItem.create({
            data: {
              type: WorkItemType.TX_BOOK_PREVIEW_LEAD,
              title: `GHL Lead: ${name || email}`,
              description: `New lead from Go High Level\n\nEmail: ${email}\nName: ${name || 'N/A'}\nContact ID: ${contactId || 'N/A'}`,
              status: WorkItemStatus.READY,
              priority: WorkItemPriority.MEDIUM,
              requesterId: systemUser.id,
              dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
              tags: ['GHL', 'Auto-Created'],
            },
          });

          // Create GHL link to associate contact with work item
          if (contactId) {
            await prisma.ghlLink.create({
              data: {
                workItemId: workItem.id,
                ghlObjectType: 'contact',
                ghlObjectId: contactId,
              },
            });
          }

          // Create default subtasks for leads
          await prisma.subtask.createMany({
            data: [
              { workItemId: workItem.id, title: 'Verify contact info', order: 0 },
              { workItemId: workItem.id, title: 'Send preview PDF', order: 1 },
              { workItemId: workItem.id, title: 'Add to newsletter', order: 2 },
              { workItemId: workItem.id, title: 'Follow up', order: 3 },
            ],
          });

          logger.info({ workItemId: workItem.id, email }, 'Created work item from GHL contact');
          processed = true;
        }
      }
    }
  } catch (error) {
    logger.error({ error }, 'Failed to process GHL webhook');
  }

  // Log the integration event
  await prisma.integrationEvent.create({
    data: {
      source: 'ghl',
      eventType: type,
      payload: payload as Prisma.InputJsonValue,
      processedAt: processed ? new Date() : null,
      workItemId: workItem?.id || null,
    },
  });

  return NextResponse.json({
    success: processed,
    workItemId: workItem?.id || null,
  });
}
