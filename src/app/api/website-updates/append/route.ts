import { NextRequest } from 'next/server';
import { successResponse, errorResponse, withAuth } from '@/lib/api-utils';
import { appendSheetRow } from '@/lib/googleSheets';
import { z } from 'zod';

const SPREADSHEET_ID = '1F4B_k6H8PKQsFdzdZBRrINX-w_tIcrEiK9gRparIcio';

const VALID_SHEETS = ['Bookstores', 'Major Events', 'Podcasts', 'Publishers', 'Editors Etc'] as const;

const appendSchema = z.object({
  sheet: z.enum(VALID_SHEETS),
  values: z.array(z.string()),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    let body;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON body');
    }

    const result = appendSchema.safeParse(body);
    if (!result.success) {
      return errorResponse('Validation failed: ' + JSON.stringify(result.error.issues));
    }

    try {
      await appendSheetRow(SPREADSHEET_ID, result.data.sheet, result.data.values);
      return successResponse({ ok: true });
    } catch (e: any) {
      return errorResponse(e?.message ?? 'Failed to append row', 500);
    }
  });
}
