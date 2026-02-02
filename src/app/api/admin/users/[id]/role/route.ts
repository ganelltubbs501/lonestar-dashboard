import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { Role } from '@prisma/client';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const body = await req.json().catch(() => null);
  const newRole = body?.role as string | undefined;

  if (!newRole || !['ADMIN', 'STAFF'].includes(newRole)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Prevent removing the last admin
  if (user.role === 'ADMIN' && newRole === 'STAFF') {
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN' },
    });

    if (adminCount <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove the last admin' },
        { status: 400 }
      );
    }
  }

  // Prevent demoting yourself
  if (user.id === session.user.id && newRole === 'STAFF') {
    return NextResponse.json(
      { error: 'Cannot demote yourself' },
      { status: 400 }
    );
  }

  const oldRole = user.role;

  await prisma.user.update({
    where: { id },
    data: { role: newRole as Role },
  });

  // Write audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'role_changed',
      fromValue: oldRole,
      toValue: newRole,
      meta: {
        targetUserId: id,
        targetUserEmail: user.email,
        timestamp: new Date().toISOString(),
      },
    },
  });

  return NextResponse.json({ ok: true, role: newRole });
}
