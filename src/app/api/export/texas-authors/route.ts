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

// GET /api/export/texas-authors
// Query params: q, contacted (true|false), createdFrom, createdTo
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const contacted = searchParams.get('contacted');
  const createdFrom = searchParams.get('createdFrom');
  const createdTo = searchParams.get('createdTo');

  const where: Record<string, unknown> = {};

  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { city: { contains: q, mode: 'insensitive' } },
      { state: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (contacted === 'true') where.contacted = true;
  else if (contacted === 'false') where.contacted = false;

  if (createdFrom || createdTo) {
    where.createdAt = {
      ...(createdFrom ? { gte: new Date(createdFrom) } : {}),
      ...(createdTo ? { lte: new Date(createdTo + 'T23:59:59.999Z') } : {}),
    };
  }

  const authors = await prisma.texasAuthor.findMany({
    where,
    orderBy: [{ name: 'asc' }],
  });

  const headers = [
    'Name', 'Email', 'Phone', 'Website',
    'City', 'State', 'Contacted', 'Notes',
    'Source Ref', 'Created', 'Updated',
  ];

  const lines = [
    row(headers),
    ...authors.map(a => row([
      a.name,
      a.email ?? '',
      a.phone ?? '',
      a.website ?? '',
      a.city ?? '',
      a.state ?? '',
      a.contacted ? 'Yes' : 'No',
      a.notes ?? '',
      a.sourceRef ?? '',
      fmtDate(a.createdAt),
      fmtDate(a.updatedAt),
    ])),
  ];

  const dateStr = fmtDate(new Date());
  const csv = lines.join('\r\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="texas-authors-${dateStr}.csv"`,
    },
  });
}
