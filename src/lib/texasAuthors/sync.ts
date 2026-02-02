import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { getSheetsClient } from "@/lib/sheets/client";

function norm(s: unknown) {
  return String(s ?? "").trim();
}

function makeExternalKey(row: Record<string, string>) {
  const name = norm(row["Name"] || row["AUTHOR"] || row["Author"] || row["name"]);
  const email = norm(row["Email"] || row["EMAIL"] || row["email"]);
  const website = norm(row["Website"] || row["WEBSITE"] || row["website"]);

  const base = (email || website || name).toLowerCase();
  return crypto.createHash("sha256").update(base).digest("hex");
}

function rowsToHash(rows: any[][]) {
  const normalized = rows
    .map((r) => r.map((c) => norm(c).toLowerCase()).join("|"))
    .join("\n");

  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function toObjects(values: any[][]) {
  const headers = (values[0] ?? []).map((h) => norm(h));
  const data = values.slice(1).filter((r) => r.some((c) => norm(c)));

  return data.map((row, idx) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = norm(row[i])));
    obj["__rowIndex"] = String(idx + 2); // +2 to account for header row (1) and 1-based indexing
    return obj;
  });
}

export async function syncTexasAuthors() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_TEXAS_AUTHORS_SPREADSHEET_ID!;
  const range = process.env.GOOGLE_SHEETS_TEXAS_AUTHORS_RANGE_A1!;
  const sheetName = process.env.GOOGLE_SHEETS_TEXAS_AUTHORS_SHEET_NAME!;

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const values = res.data.values ?? [];

  if (values.length < 1) throw new Error("Sheet returned no data");

  const hash = rowsToHash(values);

  const state = await prisma.sheetSyncState.upsert({
    where: { key: "TEXAS_AUTHORS" },
    update: {},
    create: {
      key: "TEXAS_AUTHORS",
      spreadsheetId,
      sheetName,
      rangeA1: range,
    },
  });

  // If unchanged, just bump lastSyncedAt and return
  if (state.lastHash && state.lastHash === hash) {
    await prisma.sheetSyncState.update({
      where: { id: state.id },
      data: { lastSyncedAt: new Date(), lastRowCount: values.length - 1, lastError: null },
    });
    return { changed: false, upserted: 0, rowCount: values.length - 1 };
  }

  const objects = toObjects(values);

  let upserted = 0;

  for (const r of objects) {
    const name = r["Name"] || r["AUTHOR"] || r["Author"] || r["name"] || "";
    if (!name.trim()) continue;

    const externalKey = makeExternalKey(r);

    await prisma.texasAuthor.upsert({
      where: { externalKey },
      update: {
        name: name.trim(),
        email: r["Email"] || r["EMAIL"] || null,
        phone: r["Phone"] || r["PHONE"] || null,
        website: r["Website"] || r["WEBSITE"] || null,
        city: r["City"] || null,
        state: r["State"] || null,
        notes: r["Notes"] || r["NOTES"] || null,
        raw: r,
        sourceRef: `${spreadsheetId}:${sheetName}:row=${r["__rowIndex"]}`,
      },
      create: {
        externalKey,
        name: name.trim(),
        email: r["Email"] || r["EMAIL"] || null,
        phone: r["Phone"] || r["PHONE"] || null,
        website: r["Website"] || r["WEBSITE"] || null,
        city: r["City"] || null,
        state: r["State"] || null,
        notes: r["Notes"] || r["NOTES"] || null,
        raw: r,
        sourceRef: `${spreadsheetId}:${sheetName}:row=${r["__rowIndex"]}`,
      },
    });

    upserted++;
  }

  await prisma.sheetSyncState.update({
    where: { id: state.id },
    data: {
      lastSyncedAt: new Date(),
      lastRowCount: values.length - 1,
      lastHash: hash,
      lastError: null,
    },
  });

  return { changed: true, upserted, rowCount: values.length - 1 };
}
