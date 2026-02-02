import { google } from "googleapis";
import fs from "node:fs";

function loadServiceAccount() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

  if (b64) {
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json);
  }
  if (file) {
    const json = fs.readFileSync(file, "utf8");
    return JSON.parse(json);
  }
  throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 or GOOGLE_SERVICE_ACCOUNT_FILE");
}

export async function getSheetsClient() {
  const creds = loadServiceAccount();

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth });
}
