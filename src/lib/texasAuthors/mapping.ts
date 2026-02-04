/**
 * Maps a Google Sheets row to a TexasAuthor record
 */

type TexasAuthorInput = {
  externalKey: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  city?: string | null;
  state?: string | null;
  notes?: string | null;
  raw?: any;
  sourceRef?: string | null;
};

/**
 * Helper to get cell value by column name (case-insensitive)
 */
function getCellValue(headers: string[], row: any[], columnName: string): string | null {
  const idx = headers.findIndex(
    (h) => h.toLowerCase() === columnName.toLowerCase()
  );
  if (idx === -1) return null;
  const val = row[idx];
  return val != null && String(val).trim() !== "" ? String(val).trim() : null;
}

/**
 * Generate a stable external key from the row data
 * Uses name as the primary identifier, or a combination of available fields
 */
function generateExternalKey(name: string | null, email: string | null): string | null {
  if (!name || name.trim() === "") return null;

  // Create a stable key from name, optionally with email for uniqueness
  const baseName = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  if (email) {
    const emailPart = email.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return `${baseName}-${emailPart}`;
  }

  return baseName;
}

/**
 * Maps a Google Sheets row to TexasAuthor fields
 *
 * Expected columns (case-insensitive):
 * - Name (required)
 * - Email
 * - Phone
 * - Website
 * - City
 * - State
 * - Notes
 */
export function mapTexasAuthorsSheetRow(
  headers: string[],
  row: any[]
): TexasAuthorInput | null {
  const name = getCellValue(headers, row, "name");
  const email = getCellValue(headers, row, "email");
  const phone = getCellValue(headers, row, "phone");
  const website = getCellValue(headers, row, "website");
  const city = getCellValue(headers, row, "city");
  const state = getCellValue(headers, row, "state");
  const notes = getCellValue(headers, row, "notes");

  // Name is required
  if (!name) {
    return null;
  }

  // Generate external key for upsert
  const externalKey = generateExternalKey(name, email);
  if (!externalKey) {
    return null;
  }

  return {
    externalKey,
    name,
    email,
    phone,
    website,
    city,
    state,
    notes,
    raw: row, // Store full row for debugging
    sourceRef: null,
  };
}
