import { withAdminAuth, successResponse, errorResponse } from '@/lib/api-utils';
import { runDigest } from '@/lib/digest';

// POST /api/admin/digest — trigger digest on demand (admin only)
export async function POST() {
  return withAdminAuth(async () => {
    try {
      const result = await runDigest();
      return successResponse({ ok: true, ...result });
    } catch (err: any) {
      return errorResponse(err?.message ?? 'Digest failed', 500);
    }
  });
}
