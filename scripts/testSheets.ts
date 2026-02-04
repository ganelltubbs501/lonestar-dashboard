import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import fs from "node:fs";
import { google } from "googleapis";

async function main() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const range = process.env.GOOGLE_SHEETS_RANGE!;

  if (!spreadsheetId || !range) {
    throw new Error("Missing env vars: GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SHEETS_RANGE");
  }

  const raw = fs.readFileSync("lonestar-dashboard-4221473b5846.json", "utf8");
  const creds = JSON.parse(raw);

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });

  console.log("Rows:", res.data.values?.length ?? 0);
  console.log("Headers:", res.data.values?.[0]);
  console.log("Sample row:", res.data.values?.[1]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
