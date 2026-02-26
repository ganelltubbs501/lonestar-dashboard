/**
 * Quick test script: verifies Google Sheets access
 * Run with: npx tsx scripts/test-sheets.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local first, then .env as fallback
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { getAllSheetNames, fetchSheetValues } from "../src/lib/googleSheets";

async function main() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!spreadsheetId) {
    console.error("❌ GOOGLE_SHEETS_SPREADSHEET_ID is not set");
    process.exit(1);
  }

  console.log("Spreadsheet ID:", spreadsheetId);
  console.log("");

  // 1) List all tabs
  console.log("Fetching sheet tabs...");
  const tabs = await getAllSheetNames(spreadsheetId);
  console.log(`✅ Found ${tabs.length} tabs:`);
  tabs.forEach((t, i) => console.log(`   ${i + 1}. ${t}`));
  console.log("");

  // 2) Fetch from each tab and print row count + first 2 rows
  for (const tab of tabs) {
    const range = `'${tab}'!A:Z`;
    console.log(`--- Tab: "${tab}" (${range}) ---`);
    const values = await fetchSheetValues(spreadsheetId, range);

    if (!values || values.length === 0) {
      console.log("  (empty)");
      continue;
    }

    console.log(`  Rows returned: ${values.length} (including header)`);
    console.log(`  Headers: ${values[0].join(" | ")}`);

    if (values.length > 1) {
      console.log(`  Row 2:  ${values[1].join(" | ")}`);
    }
    if (values.length > 2) {
      console.log(`  Row 3:  ${values[2].join(" | ")}`);
    }
    console.log("");
  }

  console.log("✅ Day 2 done: Google Sheets access confirmed.");
}

main().catch((err) => {
  console.error("❌ Error:", err.message ?? err);
  process.exit(1);
});
