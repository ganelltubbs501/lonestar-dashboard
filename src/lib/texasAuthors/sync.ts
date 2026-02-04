import { prisma } from "@/lib/db";
import { fetchSheetValues, getAllSheetNames } from "@/lib/googleSheets";

/**
 * Texas Authors sync (Google Sheets -> Postgres)
 * - Robust header matching (supports First Name / Last Name, URL, etc.)
 * - Stable externalKey selection (ID > External Key > Email > Name+City+State)
 * - Tracks inserted/updated/skipped
 */

type SheetRow = Record<string, string>;

function norm(s: string) {
  return (s || "").trim();
}

function lower(s: string) {
  return norm(s).toLowerCase();
}

function getAny(row: SheetRow, keys: string[]) {
  for (const k of keys) {
    // exact match
    if (row[k] != null && norm(row[k]) !== "") return norm(row[k]);

    // case-insensitive match
    const hit = Object.keys(row).find((rk) => lower(rk) === lower(k));
    if (hit && norm(row[hit]) !== "") return norm(row[hit]);
  }
  return "";
}

function buildName(row: SheetRow) {
  const name =
    getAny(row, ["Name", "Author", "Author Name", "Full Name"]) ||
    "";

  if (name) return name;

  const first = getAny(row, ["First Name", "Firstname", "First"]);
  const last = getAny(row, ["Last Name", "Lastname", "Last", "Surname"]);
  const combined = norm([first, last].filter(Boolean).join(" "));
  return combined;
}

function buildExternalKey(row: SheetRow, fallbackIndex: number) {
  const id = getAny(row, ["ID", "Id"]);
  if (id) return id;

  const ext = getAny(row, ["External Key", "ExternalKey", "External"]);
  if (ext) return ext;

  const email = getAny(row, ["Email", "Email Address", "E-mail"]);
  if (email) return email;

  const name = buildName(row);
  const city = getAny(row, ["City", "Town"]);
  const state = getAny(row, ["State", "Region"]);
  const signature = lower([name, city, state].filter(Boolean).join("|"));

  if (signature) return signature;

  // absolute last-resort fallback
  return `row:${fallbackIndex}`;
}

function rowLooksEmpty(row: SheetRow) {
  // If these are all empty, it’s probably a blank line / spacing row
  const name = buildName(row);
  const email = getAny(row, ["Email", "Email Address", "E-mail"]);
  const website = getAny(row, ["Website", "Site", "URL", "Link"]);
  return !name && !email && !website;
}

export async function syncTexasAuthorsFromSheet(args: {
  spreadsheetId: string;
  range: string;
  sourceRef?: string;
}) {
  const { spreadsheetId, range, sourceRef } = args;

  const startedAt = new Date();

  // 1) Pull raw grid
  const values = await fetchSheetValues(spreadsheetId, range);

  if (!values || values.length < 2) {
    return {
      ok: true,
      message: "Sheet returned no data rows",
      inserted: 0,
      updated: 0,
      skipped: 0,
      rows: values?.length ?? 0,
    };
  }

  // 2) Normalize headers
  const headers = values[0].map((h) => norm(String(h)));

  // Debug: this is the fastest way to confirm header mismatch
  console.log("[TexasAuthors Sync] headers:", headers);

  const dataRows = values.slice(1);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  // 3) Iterate rows
  for (let i = 0; i < dataRows.length; i++) {
    const raw = dataRows[i] || [];
    const rowIndexInSheet = i + 2; // +2 (header row + 1-based)

    const row: SheetRow = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c] || `col_${c}`;
      row[key] = norm(String(raw[c] ?? ""));
    }

    if (rowLooksEmpty(row)) {
      skipped++;
      continue;
    }

    const name = buildName(row);
    const email = getAny(row, ["Email", "Email Address", "E-mail"]);
    const phone = getAny(row, ["Phone", "Phone Number", "Mobile"]);
    const website = getAny(row, ["Website", "Site", "URL", "Link"]);
    const city = getAny(row, ["City", "Town"]);
    const state = getAny(row, ["State", "Region"]);
    const notes = getAny(row, ["Notes", "Note", "Comments", "Comment"]);

    // First column is contacted status (checkbox)
    const contactedValue = raw[0];
    const contacted =
      contactedValue === true ||
      contactedValue === "TRUE" ||
      contactedValue === "true" ||
      contactedValue === "✓" ||
      contactedValue === "☑" ||
      contactedValue === "✔" ||
      contactedValue === "x" ||
      contactedValue === "X" ||
      contactedValue === "Yes" ||
      contactedValue === "YES" ||
      contactedValue === "yes";

    const externalKey = buildExternalKey(row, rowIndexInSheet);

    // If we STILL have no usable identity, skip
    if (!externalKey || (!name && !email)) {
      skipped++;
      continue;
    }

    const existing = await prisma.texasAuthor.findUnique({
      where: { externalKey },
      select: { id: true },
    });

    await prisma.texasAuthor.upsert({
      where: { externalKey },
      create: {
        externalKey,
        name: name || email || externalKey,
        email: email || null,
        phone: phone || null,
        website: website || null,
        city: city || null,
        state: state || null,
        notes: notes || null,
        contacted: contacted,
        sourceRef: sourceRef || null,
      },
      update: {
        name: name || email || externalKey,
        email: email || null,
        phone: phone || null,
        website: website || null,
        city: city || null,
        state: state || null,
        notes: notes || null,
        contacted: contacted,
        sourceRef: sourceRef || null,
        updatedAt: new Date(),
      },
    });

    if (existing) updated++;
    else inserted++;
  }

  const finishedAt = new Date();

  // 4) Record the run (so your UI can show history)
  // If this model exists in your schema (it does, based on your logs), this will work.
  // If you renamed it, comment this block out.
  await prisma.sheetsImportRun.create({
    data: {
      kind: "TEXAS_AUTHORS",
      spreadsheetId,
      range,
      status: "SUCCESS",
      inserted,
      updated,
      skipped,
      error: null,
      createdAt: startedAt,
    },
  });

  console.log("[TexasAuthors Sync] done:", { inserted, updated, skipped });

  return {
    ok: true,
    inserted,
    updated,
    skipped,
    rows: dataRows.length,
    startedAt,
    finishedAt,
  };
}

/**
 * Wrapper function that syncs from ALL tabs in the spreadsheet
 * This is the function that the API route imports
 */
export async function syncTexasAuthors() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("Missing required env var: GOOGLE_SHEETS_SPREADSHEET_ID");
  }

  // Get all sheet names from the spreadsheet
  const sheetNames = await getAllSheetNames(spreadsheetId);
  console.log(`[TexasAuthors Sync] Found ${sheetNames.length} tabs:`, sheetNames);

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalRows = 0;
  const startedAt = new Date();
  const sheetResults = [];

  // Sync each sheet
  for (const sheetName of sheetNames) {
    try {
      console.log(`[TexasAuthors Sync] Processing tab: ${sheetName}`);
      const result = await syncTexasAuthorsFromSheet({
        spreadsheetId,
        range: `'${sheetName}'!A:Z`,
        sourceRef: sheetName,
      });

      totalInserted += result.inserted;
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      totalRows += result.rows;

      sheetResults.push({
        sheetName,
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
        rows: result.rows,
      });
    } catch (error) {
      console.error(`[TexasAuthors Sync] Error processing tab ${sheetName}:`, error);
      sheetResults.push({
        sheetName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const finishedAt = new Date();

  return {
    ok: true,
    inserted: totalInserted,
    updated: totalUpdated,
    skipped: totalSkipped,
    rows: totalRows,
    sheets: sheetResults,
    startedAt,
    finishedAt,
  };
}
