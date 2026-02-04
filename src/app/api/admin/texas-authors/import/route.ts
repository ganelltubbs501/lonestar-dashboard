import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { fetchSheetValues } from "@/lib/googleSheets";
import { resolveTexasAuthorsSheetConfig } from "@/lib/texasAuthors/config";
import { errorResponse, successResponse, withAdminAuth } from "@/lib/api-utils";

function normHeader(h: string) {
  return h.trim().toLowerCase();
}

function sha(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function pick(row: Record<string, string>, keys: string[]) {
  for (const k of keys) {
    const v = row[k];
    if (v && v.trim()) return v.trim();
  }
  return "";
}

export async function POST() {
  return withAdminAuth(async () => {
    const { spreadsheetId, range } = await resolveTexasAuthorsSheetConfig();

    const run = await prisma.sheetsImportRun.create({
      data: { kind: "TEXAS_AUTHORS", spreadsheetId, range, status: "SUCCESS" },
    });

    try {
      const values = await fetchSheetValues(spreadsheetId, range);
      if (values.length < 2) {
        return successResponse({ inserted: 0, updated: 0, skipped: 0 });
      }

      const headers = values[0].map((h: any) => normHeader(String(h ?? "")));
      const rows = values.slice(1);

      // Map into objects keyed by normalized header
      const parsed: Record<string, string>[] = rows.map((r: any[]) => {
        const obj: Record<string, string> = {};
        for (let i = 0; i < headers.length; i++) {
          const key = headers[i];
          if (!key) continue;
          obj[key] = String(r?.[i] ?? "").trim();
        }
        return obj;
      });

      let inserted = 0;
      let updated = 0;
      let skipped = 0;

      for (let rowIndex = 0; rowIndex < parsed.length; rowIndex++) {
        const r = parsed[rowIndex];
        // Adjust aliases once we see your headers
        const name = pick(r, ["author", "name", "full name", "author name"]);
        if (!name) {
          skipped++;
          continue;
        }

        const email = pick(r, ["email", "email address", "contact email"]);
        const phone = pick(r, ["phone", "phone number", "cell", "mobile"]);
        const city = pick(r, ["city", "town"]);
        const state = pick(r, ["state", "st"]);
        const website = pick(r, ["website", "website url", "site", "url"]);
        const notes = pick(r, ["notes", "note", "comments", "comment", "bio", "biography"]);

        // Build a natural key: normalized name + email/website if present
        const normalizedName = name.toLowerCase().replace(/\s+/g, "_");
        const keyParts = [normalizedName];
        if (email) keyParts.push(email.toLowerCase());
        else if (website) keyParts.push(website.toLowerCase());
        const externalKey = keyParts.join("::");

        const sourceRef = `${spreadsheetId}/${range}/${rowIndex + 2}`; // +2 for 1-indexed + header

        // Upsert via externalKey
        const existing = await prisma.texasAuthor.findUnique({
          where: { externalKey },
        });

        if (!existing) {
          await prisma.texasAuthor.create({
            data: {
              externalKey,
              name,
              email: email || null,
              phone: phone || null,
              city: city || null,
              state: state || null,
              website: website || null,
              notes: notes || null,
              raw: r,
              sourceRef,
            },
          });
          inserted++;
        } else {
          // Update fields if changed
          await prisma.texasAuthor.update({
            where: { id: existing.id },
            data: {
              name,
              email: email || null,
              phone: phone || null,
              city: city || null,
              state: state || null,
              website: website || null,
              notes: notes || null,
              raw: r,
              sourceRef,
            },
          });
          updated++;
        }
      }

      await prisma.sheetsImportRun.update({
        where: { id: run.id },
        data: { inserted, updated, skipped, status: "SUCCESS" },
      });

      return successResponse({ inserted, updated, skipped });
    } catch (e: any) {
      await prisma.sheetsImportRun.update({
        where: { id: run.id },
        data: { status: "FAILED", error: e?.message ?? String(e) },
      });
      return errorResponse(e?.message ?? "Import failed", 500);
    }
  });
}
