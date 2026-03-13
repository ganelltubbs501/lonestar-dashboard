import { google } from 'googleapis';
import fs from 'node:fs';
import { MagazineSection } from '@prisma/client';

// ── Service account (same pattern as googleSheets.ts) ─────────────────────────

type ServiceAccountJson = { client_email: string; private_key: string };

function getServiceAccount(): ServiceAccountJson {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const b64  = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

  if (json) {
    const parsed = JSON.parse(json);
    if (!parsed?.client_email || !parsed?.private_key)
      throw new Error('Service account JSON missing client_email/private_key');
    return parsed;
  }
  if (b64) {
    const raw    = b64.trim().startsWith('{') ? b64 : Buffer.from(b64, 'base64').toString('utf8');
    const parsed = JSON.parse(raw);
    if (!parsed?.client_email || !parsed?.private_key)
      throw new Error('Service account JSON missing client_email/private_key');
    return parsed;
  }
  if (file) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed?.client_email || !parsed?.private_key)
      throw new Error('Service account JSON missing client_email/private_key');
    return parsed;
  }
  throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_SERVICE_ACCOUNT_JSON_BASE64, or GOOGLE_SERVICE_ACCOUNT_FILE');
}

function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Drive API timed out after ${ms}ms`)), ms);
    fn().then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((r) => setTimeout(r, 2000));
    return fn();
  }
}

// ── Public types ──────────────────────────────────────────────────────────────

export type DriveFile = {
  id:          string;
  name:        string;
  mimeType:    string;
  webViewLink: string | null;
  isFolder:    boolean;
};

// ── URL parsing ───────────────────────────────────────────────────────────────

export function parseFolderIdFromUrl(url: string): string | null {
  // /folders/FOLDER_ID
  const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];

  // ?id=FOLDER_ID or &id=FOLDER_ID
  try {
    const idParam = new URL(url).searchParams.get('id');
    if (idParam) return idParam;
  } catch {
    // not a valid URL
  }

  return null;
}

// ── Section mapping ───────────────────────────────────────────────────────────

export function folderNameToSection(name: string): MagazineSection {
  const lc = name.toLowerCase();
  if (lc.includes('front'))                                                      return MagazineSection.FRONT;
  if (lc.includes('feature'))                                                    return MagazineSection.FEATURES;
  if (lc.includes('regular'))                                                    return MagazineSection.REGULARS;
  if (lc.includes('event'))                                                      return MagazineSection.EVENTS;
  if (lc.includes('ser') || lc.includes('sponsored') || lc.includes('editorial')) return MagazineSection.SPONSORED_EDITORIAL_REVIEWS;
  if (lc.includes('campaign') || lc.includes('book camp'))                      return MagazineSection.BOOK_CAMPAIGNS;
  if (lc.includes('texas') || lc.includes('preview'))                           return MagazineSection.TEXAS_BOOKS_PREVIEW;
  if (lc.includes('ad'))                                                         return MagazineSection.ADS;
  return MagazineSection.OTHER;
}

// ── Drive API ─────────────────────────────────────────────────────────────────

function makeDriveClient() {
  const creds = getServiceAccount();
  const auth  = new google.auth.JWT({
    email:  creds.client_email,
    key:    creds.private_key,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

/**
 * List all immediate children of a Drive folder (files + subfolders).
 * Handles pagination automatically.
 */
export async function listDriveFolder(folderId: string): Promise<DriveFile[]> {
  return withRetry(() =>
    withTimeout(async () => {
      const drive  = makeDriveClient();
      const items: DriveFile[] = [];
      let   pageToken: string | undefined;

      do {
        const res = await drive.files.list({
          q:         `'${folderId}' in parents and trashed = false`,
          fields:    'nextPageToken, files(id, name, mimeType, webViewLink)',
          pageSize:  1000,
          pageToken,
        });

        for (const f of res.data.files ?? []) {
          if (!f.id || !f.name) continue;
          items.push({
            id:          f.id,
            name:        f.name,
            mimeType:    f.mimeType ?? '',
            webViewLink: f.webViewLink ?? null,
            isFolder:    f.mimeType === 'application/vnd.google-apps.folder',
          });
        }

        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);

      // Sort: folders first, then files, alphabetically within each group
      items.sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return items;
    }, 30_000)
  );
}
