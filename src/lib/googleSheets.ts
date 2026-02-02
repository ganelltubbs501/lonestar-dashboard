import { google } from "googleapis";
import fs from "node:fs";

type ServiceAccountJson = {
  client_email: string;
  private_key: string;
};

function getServiceAccount(): ServiceAccountJson {
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;

  if (file) {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw);
  }
  if (b64) {
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json);
  }
  throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_FILE or GOOGLE_SERVICE_ACCOUNT_JSON_BASE64");
}

export async function fetchSheetValues(spreadsheetId: string, range: string) {
  const creds = getServiceAccount();

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return res.data.values ?? [];
}
