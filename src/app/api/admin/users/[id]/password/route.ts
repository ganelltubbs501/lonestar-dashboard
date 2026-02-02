import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

type RouteContext<T extends string> = {
  params: Promise<Record<string, string>>;
};

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<'/api/admin/users/[id]/password'>
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const newPassword = body?.password as string | undefined;

  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters' },
      { status: 400 }
    );
  }

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });

  // Write audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'password_reset_admin',
      meta: {
        targetUserId: id,
        targetUserEmail: user.email,
        timestamp: new Date().toISOString(),
      },
    },
  });

  return NextResponse.json({ ok: true });
}
