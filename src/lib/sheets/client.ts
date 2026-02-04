import { google } from "googleapis";
import fs from "node:fs";

function loadServiceAccount() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

  if (b64) {
    try {
      const raw = b64.trim().startsWith("{") ? b64 : Buffer.from(b64, "base64").toString("utf8");
      const parsed = JSON.parse(raw);
      if (!parsed?.client_email || !parsed?.private_key) {
        throw new Error("Service account JSON missing client_email/private_key");
      }
      return parsed;
    } catch (e) {
      if (!file) {
        throw new Error(
          "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 is not valid JSON. Provide a valid JSON service account or set GOOGLE_SERVICE_ACCOUNT_FILE."
        );
      }
    }
  }
  if (file) {
    try {
      const json = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(json);
      if (!parsed?.client_email || !parsed?.private_key) {
        throw new Error("Service account JSON missing client_email/private_key");
      }
      return parsed;
    } catch (e) {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_FILE is not valid JSON. Ensure it points to a service account .json file."
      );
    }
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
