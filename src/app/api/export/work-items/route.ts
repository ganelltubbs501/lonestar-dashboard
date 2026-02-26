import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// ── CSV helpers ──────────────────────────────────────────────────────────────

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (cols: unknown[]) => cols.map(esc).join(',');

function fmtDate(d: Date | null | undefined) {
  if (!d) return '';
  return d.toISOString().split('T')[0];
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// ── Route ────────────────────────────────────────────────────────────────────

// GET /api/export/work-items
// Query params: type, status, ownerId (or "unassigned"), createdFrom, createdTo, dueFrom, dueTo
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const status = searchParams.get('status');
  const ownerId = searchParams.get('ownerId');
  const createdFrom = searchParams.get('createdFrom');
  const createdTo = searchParams.get('createdTo');
  const dueFrom = searchParams.get('dueFrom');
  const dueTo = searchParams.get('dueTo');

  const where: Record<string, unknown> = {};

  if (type) where.type = type;
  if (status) where.status = status;
  if (ownerId === 'unassigned') where.ownerId = null;
  else if (ownerId) where.ownerId = ownerId;

  if (createdFrom || createdTo) {
    where.createdAt = {
      ...(createdFrom ? { gte: new Date(createdFrom) } : {}),
      ...(createdTo ? { lte: new Date(createdTo + 'T23:59:59.999Z') } : {}),
    };
  }

  if (dueFrom || dueTo) {
    where.dueAt = {
      ...(dueFrom ? { gte: new Date(dueFrom) } : {}),
      ...(dueTo ? { lte: new Date(dueTo + 'T23:59:59.999Z') } : {}),
    };
  }

  const items: any[] = await (prisma as any).workItem.findMany({
    where,
    include: {
      owner: { select: { name: true, email: true } },
      requester: { select: { name: true, email: true } },
      waitingOnUser: { select: { email: true } },
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  const headers = [
    'ID', 'Type', 'Title', 'Status', 'Priority',
    'Owner Name', 'Owner Email',
    'Requester Name', 'Requester Email',
    'Created', 'Due Date', 'Completed',
    'Tags', 'Blocked Reason', 'Deliverable Type', 'Needs Proofing',
    'Waiting On (Email)', 'Waiting Reason',
    'TBP Publish Date', 'TBP Article Link',
  ];

  const now = new Date();
  const lines = [
    row(headers),
    ...items.map(w => row([
      w.id,
      w.type,
      w.title,
      w.status,
      w.priority,
      w.owner?.name ?? '',
      w.owner?.email ?? '',
      w.requester?.name ?? '',
      w.requester?.email ?? '',
      fmtDate(w.createdAt),
      fmtDate(w.dueAt),
      fmtDate(w.completedAt),
      (w.tags ?? []).join('; '),
      w.blockedReason ?? '',
      w.deliverableType ?? '',
      w.needsProofing ? 'Yes' : 'No',
      (w as any).waitingOnUser?.email ?? '',
      w.waitingReason ?? '',
      fmtDate((w as any).tbpPublishDate),
      (w as any).tbpArticleLink ?? '',
    ])),
  ];

  const dateStr = fmtDate(now);
  const csv = lines.join('\r\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="work-items-${dateStr}.csv"`,
    },
  });
}
