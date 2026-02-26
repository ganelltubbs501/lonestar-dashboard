import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

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

function daysBetween(a: Date | null | undefined, b: Date | null | undefined) {
  if (!a || !b) return '';
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// GET /api/export/ser
// Query params: status (specific status | "active" | "all"), ownerId, createdFrom, createdTo
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');   // specific status, "active", "all", or null
  const ownerId = searchParams.get('ownerId');
  const createdFrom = searchParams.get('createdFrom');
  const createdTo = searchParams.get('createdTo');

  const where: Record<string, unknown> = {
    type: 'SPONSORED_EDITORIAL_REVIEW',
  };

  if (status === 'active') {
    where.status = { not: 'DONE' };
  } else if (status && status !== 'all') {
    where.status = status;
  }
  // if status === 'all' or null, no status filter

  if (ownerId) where.ownerId = ownerId;

  if (createdFrom || createdTo) {
    where.createdAt = {
      ...(createdFrom ? { gte: new Date(createdFrom) } : {}),
      ...(createdTo ? { lte: new Date(createdTo + 'T23:59:59.999Z') } : {}),
    };
  }

  const items: any[] = await (prisma as any).workItem.findMany({
    where,
    include: {
      owner: { select: { name: true, email: true } },
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  const now = new Date();

  const headers = [
    'ID', 'Title', 'Status',
    'Owner Name', 'Owner Email',
    'Due Date', 'Created', 'Started', 'Completed',
    'Age (days)', 'Cycle Time (days)',
  ];

  const lines = [
    row(headers),
    ...items.map(w => row([
      w.id,
      w.title,
      w.status,
      w.owner?.name ?? '',
      w.owner?.email ?? '',
      fmtDate(w.dueAt),
      fmtDate(w.createdAt),
      fmtDate((w as any).startedAt),
      fmtDate(w.completedAt),
      daysBetween(w.createdAt, w.completedAt ?? now),
      daysBetween(w.createdAt, w.completedAt),
    ])),
  ];

  const dateStr = fmtDate(now);
  const csv = lines.join('\r\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ser-export-${dateStr}.csv"`,
    },
  });
}
