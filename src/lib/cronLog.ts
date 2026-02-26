import { prisma } from '@/lib/db';
import logger from '@/lib/logger';

/**
 * Write a record to CronRunLog after a scheduled job completes.
 * Swallows DB errors so logging never interrupts the cron response.
 */
export async function logCronRun(args: {
  jobName: string;
  status: 'success' | 'error';
  result?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
}): Promise<void> {
  try {
    await (prisma as any).cronRunLog.create({
      data: {
        jobName:    args.jobName,
        status:     args.status,
        result:     args.result ?? null,
        error:      args.error ?? null,
        durationMs: args.durationMs ?? null,
      },
    });
  } catch (e) {
    logger.error({ error: e }, '[CronLog] Failed to write cron run log');
  }
}
