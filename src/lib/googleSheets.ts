import { google } from "googleapis";
import fs from "node:fs";

type ServiceAccountJson = {
  client_email: string;
  private_key: string;
};

function getServiceAccount(): ServiceAccountJson {
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;

  // Plain JSON string (e.g., from GCP Secret Manager)
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (!parsed?.client_email || !parsed?.private_key) {
        throw new Error("Service account JSON missing client_email/private_key");
      }
      return parsed;
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
    }
  }

  // Base64-encoded JSON
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

  // File path
  if (file) {
    try {
      const raw = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(raw);
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

  throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_FILE, GOOGLE_SERVICE_ACCOUNT_JSON, or GOOGLE_SERVICE_ACCOUNT_JSON_BASE64");
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

export async function getSpreadsheetFirstSheetName(spreadsheetId: string) {
  const creds = getServiceAccount();

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  return res.data.sheets?.[0]?.properties?.title || null;
}

export async function getAllSheetNames(spreadsheetId: string): Promise<string[]> {
  const creds = getServiceAccount();

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.get({ spreadsheetId });

  return (res.data.sheets || [])
    .map(sheet => sheet.properties?.title)
    .filter((title): title is string => !!title);
}
