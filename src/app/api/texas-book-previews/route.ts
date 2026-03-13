import { successResponse, errorResponse, withAuth } from '@/lib/api-utils';
import { fetchSheetValues, getAllSheetNames } from '@/lib/googleSheets';

const SPREADSHEET_ID = '1o4FbItfP6o4GD5mdSgwnwTZAxl4wQh1ovRYLfTxFWRA';

export async function GET() {
  return withAuth(async () => {
    try {
      const sheetNames = await getAllSheetNames(SPREADSHEET_ID);
      if (!sheetNames.length) {
        return errorResponse('No sheets found in spreadsheet', 500);
      }

      const sheets = await Promise.all(
        sheetNames.map(async (name) => {
          const values = await fetchSheetValues(SPREADSHEET_ID, `'${name}'!A:Z`);
          if (!values || values.length === 0) {
            return { name, headers: [], rows: [] };
          }
          const headers = (values[0] as string[]).map((h) => String(h ?? '').trim());
          const rows = values.slice(1).map((row) =>
            headers.map((_, i) => String((row as string[])[i] ?? '').trim())
          );
          return { name, headers, rows };
        })
      );

      return successResponse({ sheets });
    } catch (e: any) {
      return errorResponse(e?.message ?? 'Failed to load spreadsheet', 500);
    }
  });
}
