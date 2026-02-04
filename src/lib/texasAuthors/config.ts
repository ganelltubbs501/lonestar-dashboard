import { getSpreadsheetFirstSheetName } from "@/lib/googleSheets";

export const DEFAULT_TEXAS_AUTHORS_SPREADSHEET_ID =
  "1eLiGVuv62WLopb8XZqibgB0FgBKSoj6_2R2-tLIL6sc";

function sheetNameFromRange(range?: string | null) {
  if (!range) return null;
  const idx = range.indexOf("!");
  if (idx === -1) return null;
  return range.slice(0, idx).trim() || null;
}

export async function resolveTexasAuthorsSheetConfig() {
  const spreadsheetId =
    process.env.GOOGLE_SHEETS_TEXAS_AUTHORS_SPREADSHEET_ID ||
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||
    DEFAULT_TEXAS_AUTHORS_SPREADSHEET_ID;

  let range =
    process.env.GOOGLE_SHEETS_TEXAS_AUTHORS_RANGE_A1 ||
    process.env.GOOGLE_SHEETS_RANGE ||
    null;

  let sheetName =
    process.env.GOOGLE_SHEETS_TEXAS_AUTHORS_SHEET_NAME ||
    sheetNameFromRange(range);

  if (!sheetName || !range) {
    const firstSheetName = await getSpreadsheetFirstSheetName(spreadsheetId);
    const resolvedSheetName = sheetName || firstSheetName || "Sheet1";
    sheetName = resolvedSheetName;
    if (!range) {
      range = `${resolvedSheetName}!A:Z`;
    }
  }

  if (!sheetName || !range) {
    throw new Error(
      "Missing sheet configuration for Texas Authors (sheet name or range)."
    );
  }

  return { spreadsheetId, range, sheetName };
}
