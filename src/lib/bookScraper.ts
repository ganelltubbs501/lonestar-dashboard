import { prisma } from '@/lib/db';
import { fetchSheetValues, getSheetNameByGid } from '@/lib/googleSheets';
import logger from '@/lib/logger';

// ── Config ────────────────────────────────────────────────────────────────────

const SCRAPER_SPREADSHEET_ID = '1o4FbItfP6o4GD5mdSgwnwTZAxl4wQh1ovRYLfTxFWRA';
const SCRAPER_SHEET_GID = 848104630;

const FETCH_DELAY_MS = 1200;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_DETAIL_LINKS_PER_SEED = 6;
const MAX_TOTAL_DETAIL_FETCHES = 80;

// ── Texas patterns ────────────────────────────────────────────────────────────

const TEXAS_AUTHOR_PATTERNS = [
  /texas\s+author/i,
  /texan\s+author/i,
  /author[^.]{0,60}texas/i,
  /born\s+in\s+texas/i,
  /texas\s+native/i,
  /raised\s+in\s+texas/i,
  /grew\s+up\s+in\s+texas/i,
  /from\s+texas/i,
  /lives?\s+in\s+(austin|houston|dallas|san antonio|fort worth|el paso|plano|lubbock|amarillo|corpus christi|texas)/i,
  /based\s+in\s+(austin|houston|dallas|san antonio|fort worth|el paso|plano|lubbock|amarillo|corpus christi|texas)/i,
  /\b(austin|houston|dallas|san antonio|fort worth|lubbock|amarillo|corpus christi),\s*texas\b/i,
];

const TEXAS_BOOK_PATTERNS = [
  /set\s+in\s+texas/i,
  /takes?\s+place\s+in\s+texas/i,
  /texas\s+(story|novel|mystery|thriller|romance|history|memoir)/i,
  /lone\s+star\s+(state|novel|story|mystery)/i,
  /book[^.]{0,60}texas/i,
  /texas[^.]{0,60}book/i,
];

const NEW_RELEASE_SIGNALS = [
  /new\s+release/i,
  /new\s+book/i,
  /coming\s+soon/i,
  /just\s+released/i,
  /now\s+available/i,
  /on\s+sale/i,
  /pub(?:lication)?\s+date/i,
  /releases?\s+(?:on|in)\s+\w/i,
  /available\s+\w+\s+\d{1,2}/i,
  /debuts?/i,
  /pre[\s-]?order/i,
  /upcoming/i,
];

// ── HTML utilities ─────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractPageTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : '';
}

function extractHeadings(html: string): string[] {
  const headings: string[] = [];
  const re = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const text = stripHtml(m[1]).trim();
    if (text.length > 2 && text.length < 200) headings.push(text);
  }
  return headings;
}

function extractEmails(text: string): string[] {
  const found = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [];
  return [...new Set(found)].filter((e) => !e.includes('example')).slice(0, 3);
}

function extractDate(text: string): string | null {
  const patterns = [
    // "June 2026", "June 10, 2026"
    /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,\s*\d{4})?/i,
    // "2026-06-01"
    /\b\d{4}-\d{2}-\d{2}\b/,
    // "6/1/2026"
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

// ── Structured data extraction ────────────────────────────────────────────────

function parseJsonLd(html: string): Record<string, any>[] {
  const results: Record<string, any>[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const obj = JSON.parse(m[1]);
      if (Array.isArray(obj)) results.push(...obj);
      else results.push(obj);
    } catch { /* ignore malformed */ }
  }
  return results;
}

type StructuredData = {
  bookTitle?: string | null;
  authorName?: string | null;
  releaseDate?: string | null;
  authorUrl?: string | null;
};

function extractFromJsonLd(html: string): StructuredData {
  const items = parseJsonLd(html);
  const result: StructuredData = {};

  for (const item of items) {
    const nodes: any[] = item['@graph'] ? item['@graph'] : [item];
    for (const node of nodes) {
      if (!node || !node['@type']) continue;
      const type = Array.isArray(node['@type']) ? node['@type'][0] : node['@type'];

      if (/^Book$/i.test(type)) {
        if (node.name && !result.bookTitle) result.bookTitle = String(node.name).slice(0, 200);
        const author = Array.isArray(node.author) ? node.author[0] : node.author;
        if (author?.name && !result.authorName) result.authorName = String(author.name).slice(0, 150);
        if (author?.url && !result.authorUrl) result.authorUrl = String(author.url);
        if (node.datePublished && !result.releaseDate) result.releaseDate = String(node.datePublished).slice(0, 50);
      } else if (/^Person$/i.test(type)) {
        if (node.name && !result.authorName) result.authorName = String(node.name).slice(0, 150);
        const sameAs = Array.isArray(node.sameAs) ? node.sameAs[0] : node.sameAs;
        if ((node.url || sameAs) && !result.authorUrl) result.authorUrl = String(node.url || sameAs);
      }
    }
  }
  return result;
}

function extractMetaTags(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const re = /<meta[^>]+>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const propMatch = tag.match(/(?:property|name)=["']([^"']+)["']/i);
    const contentMatch = tag.match(/content=["']([^"']+)["']/i);
    if (propMatch && contentMatch) {
      meta[propMatch[1].toLowerCase()] = contentMatch[1];
    }
  }
  return meta;
}

/** Extract labeled field: "Author: Heatherly Bell" → "Heatherly Bell" */
function extractLabeled(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(`\\b${label}[:\\s]+([^\\n\\r|]{3,120})`, 'i');
    const m = text.match(re);
    if (m) return m[1].replace(/\s+/g, ' ').trim().slice(0, 200);
  }
  return null;
}

function isGenericTitle(title: string | null): boolean {
  if (!title) return true;
  return /^(home|about|blog|news|catalog|books|authors|shop|store)$/i.test(title.trim());
}

function extractEmailsFromHtml(html: string): string[] {
  const mailtos = [...html.matchAll(/href=["']mailto:([^"'?]+)["']/gi)].map((m) => m[1]);
  return [...new Set(mailtos)];
}

/** Extract author website links from the page */
function extractAuthorWebsite(html: string, baseHostname: string): string | null {
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1].trim();
    const text = stripHtml(m[2]).toLowerCase();
    if (!href.startsWith('http')) continue;
    try {
      const u = new URL(href);
      if (u.hostname === baseHostname) continue; // skip internal links
    } catch { continue; }
    // Look for links labelled as author website
    if (/author.{0,20}website|visit.{0,20}site|author.{0,20}site|official\s+site|author\s+page/i.test(text)) {
      return href;
    }
  }
  return null;
}

// ── Link discovery ─────────────────────────────────────────────────────────────

const DETAIL_LINK_HINTS = [
  /\/book[s]?\//i,
  /\/novel/i,
  /\/title[s]?\//i,
  /\/product[s]?\//i,
  /\/author[s]?\//i,
  /\/release[s]?\//i,
  /\/excerpt/i,
  /\/isbn\//i,
  /\/p\//i,
];

const SKIP_LINK_PATTERNS = [
  /\/(about|contact|faq|help|cart|wishlist|account|login|register|search|privacy|terms|newsletter|category|genre|format|tag|series|publisher|imprint|browse|shop|home|blog)\b/i,
  /\.(css|js|jpg|jpeg|png|gif|pdf|zip|svg|webp|ico)(\?|$)/i,
  /#/,
  /^mailto:/i,
  /^tel:/i,
  /^javascript:/i,
];

function discoverDetailLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const links = new Map<string, number>(); // href → discovery order

  const re = /<a\s[^>]*href=["']([^"']+)["'][^>]*/gi;
  let m;
  let idx = 0;
  while ((m = re.exec(html)) !== null) {
    const href = m[1].trim();
    if (!href) continue;
    if (SKIP_LINK_PATTERNS.some((p) => p.test(href))) continue;

    let absolute: string;
    try {
      absolute = new URL(href, baseUrl).href;
    } catch { continue; }

    try {
      const u = new URL(absolute);
      // Must be same hostname
      if (u.hostname !== base.hostname) continue;
      // Must not be the same page
      if (u.pathname === base.pathname) continue;
      const isDetail = DETAIL_LINK_HINTS.some((p) => p.test(u.pathname));
      if (isDetail) {
        if (!links.has(absolute)) links.set(absolute, idx++);
      }
    } catch { continue; }
  }

  // Return in discovery order
  return [...links.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([href]) => href);
}

// ── Page fetch ─────────────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TexasBookBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    return { html, finalUrl: res.url };
  } catch {
    return null;
  }
}

// ── Finding type ──────────────────────────────────────────────────────────────

type FindingRaw = {
  sourceUrl: string;
  pageTitle: string;
  authorName: string | null;
  bookTitle: string | null;
  contactInfo: string | null;
  releaseDate: string | null;
  texasConnection: string;
  snippet: string;
};

// ── Analyse a detail page ─────────────────────────────────────────────────────

function analyseDetailPage(url: string, html: string): FindingRaw | null {
  const pageTitle = extractPageTitle(html);
  const text = stripHtml(html);
  const headings = extractHeadings(html);
  const emails = extractEmails(text);

  const isTexasAuthor = TEXAS_AUTHOR_PATTERNS.some((re) => re.test(text));
  const isTexasBook = TEXAS_BOOK_PATTERNS.some((re) => re.test(text));
  const hasTexas = isTexasAuthor || isTexasBook;

  if (!hasTexas) return null;

  const isNewRelease = NEW_RELEASE_SIGNALS.some((re) => re.test(text));
  if (!isNewRelease) return null;

  const texasConnection = isTexasAuthor && isTexasBook ? 'Both' : isTexasAuthor ? 'Texas Author' : 'Texas Book';

  // ── Extract structured data (best sources first) ──
  const ld = extractFromJsonLd(html);
  const meta = extractMetaTags(html);

  // Book title: JSON-LD → og:title → h1 → page title
  let bookTitle: string | null =
    ld.bookTitle ??
    meta['og:title'] ??
    headings.find((h) => h.length > 3 && h.length < 120) ??
    (pageTitle.length < 120 ? pageTitle : null) ??
    null;
  // Strip site-name suffixes like "| Harlequin"
  if (bookTitle) {
    bookTitle = bookTitle.replace(/\s*[\|–—]\s*[^|–—]{0,50}$/, '').trim();
    if (bookTitle.length < 2) bookTitle = null;
  }

  // Author name: JSON-LD → labeled field → "by Author" pattern → heading
  let authorName: string | null =
    ld.authorName ??
    extractLabeled(text, ['author', 'written by', 'by']) ??
    text.match(/\bby\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/)?.[1] ??
    null;
  // Avoid false positives like "by Publisher"
  if (authorName && /published|press|house|publisher|books|media|inc\./i.test(authorName)) {
    authorName = null;
  }

  // Release date: JSON-LD → labeled field → date pattern in text
  let releaseDate: string | null =
    ld.releaseDate ??
    extractLabeled(text, ['publication date', 'pub date', 'release date', 'on sale', 'release']) ??
    extractDate(text);
  if (releaseDate) releaseDate = releaseDate.slice(0, 60);

  // Contact info: author website link → JSON-LD author URL → mailto links → text emails
  const mailtoEmails = extractEmailsFromHtml(html);
  const allEmails = [...new Set([...mailtoEmails, ...emails])].slice(0, 3);
  let contactInfo: string | null = null;
  try {
    const hostname = new URL(url).hostname;
    contactInfo =
      extractAuthorWebsite(html, hostname) ??
      ld.authorUrl ??
      (allEmails.length > 0 ? allEmails.join(', ') : null);
  } catch {
    contactInfo = allEmails.length > 0 ? allEmails.join(', ') : null;
  }

  // Require at least 2 of the 4 core fields (strong evidence)
  const strongEnough =
    [authorName, bookTitle, releaseDate, contactInfo].filter(Boolean).length >= 2;
  if (!strongEnough) return null;

  // Reject generic page titles masquerading as book titles
  if (isGenericTitle(bookTitle) && !authorName) return null;

  // Snippet: find a sentence containing the Texas keyword
  const snippetMatch = text.match(
    /[^.!?]{0,100}(?:texas|texan|lone star|austin|houston|dallas|san antonio)[^.!?]{0,200}/i
  );
  const snippet = (snippetMatch?.[0] ?? text.slice(0, 400)).trim().slice(0, 500);

  return {
    sourceUrl: url,
    pageTitle: pageTitle.slice(0, 300),
    authorName,
    bookTitle,
    contactInfo,
    releaseDate,
    texasConnection,
    snippet,
  };
}

// ── Analyse a listing / seed page for direct findings ────────────────────────
// Used as fallback when the page itself contains enough info
// (e.g. the seed URL IS a detail page, or has inline author/book info)

function analyseSeedPage(url: string, html: string): FindingRaw[] {
  const pageTitle = extractPageTitle(html);
  const text = stripHtml(html);
  const headings = extractHeadings(html);
  const emails = extractEmails(text);

  const findings: FindingRaw[] = [];
  const seen = new Set<string>();

  // Slide a window through the text looking for Texas + new release co-occurrence
  const CHUNK = 600;
  for (let i = 0; i < text.length; i += 400) {
    const chunk = text.slice(Math.max(0, i - 50), i + CHUNK);
    const isTexasAuthor = TEXAS_AUTHOR_PATTERNS.some((re) => re.test(chunk));
    const isTexasBook = TEXAS_BOOK_PATTERNS.some((re) => re.test(chunk));
    const isNewRelease = NEW_RELEASE_SIGNALS.some((re) => re.test(chunk));

    if (!(isTexasAuthor || isTexasBook)) continue;
    if (!isNewRelease) continue;

    const key = chunk.slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);

    const texasConnection = isTexasAuthor && isTexasBook ? 'Both' : isTexasAuthor ? 'Texas Author' : 'Texas Book';
    const authorName =
      extractLabeled(chunk, ['author', 'written by']) ??
      chunk.match(/\bby\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/)?.[1] ??
      null;
    const releaseDate = extractDate(chunk);
    const bookTitle = headings.find((h) => /texas|book|novel|memoir|thriller|mystery|romance/i.test(h)) ?? headings[0] ?? null;
    const contactInfo = emails.length > 0 ? emails.join(', ') : null;

    findings.push({
      sourceUrl: url,
      pageTitle: pageTitle.slice(0, 300),
      authorName,
      bookTitle: bookTitle?.slice(0, 200) ?? null,
      contactInfo,
      releaseDate,
      texasConnection,
      snippet: chunk.slice(0, 500).trim(),
    });

    if (findings.length >= 10) break;
  }

  return findings;
}

// ── Read URLs from Google Sheet ────────────────────────────────────────────────

async function readScraperUrls(): Promise<string[]> {
  const sheetName = await getSheetNameByGid(SCRAPER_SPREADSHEET_ID, SCRAPER_SHEET_GID);
  if (!sheetName) throw new Error(`Sheet with gid ${SCRAPER_SHEET_GID} not found`);

  const values = await fetchSheetValues(SCRAPER_SPREADSHEET_ID, `'${sheetName}'!A:Z`);

  logger.info(
    {
      sheetName,
      rowCount: values.length,
      firstRows: values.slice(0, 5),
    },
    '[BookScraper] raw sheet values'
  );

  const urls: string[] = [];

  for (const row of values) {
    for (const cell of row) {
      const val = String(cell ?? '').trim();
      if (val.startsWith('http://') || val.startsWith('https://')) {
        urls.push(val);
      }
    }
  }

  logger.info({ urls }, '[BookScraper] extracted seed urls');

  return [...new Set(urls)];
}

// ── Main scraper ───────────────────────────────────────────────────────────────

export async function runBookScraper(existingRunId?: string): Promise<{
  runId: string;
  sitesChecked: number;
  resultsFound: number;
}> {
  const runId: string = existingRunId ?? (await (prisma as any).bookScrapeRun.create({
    data: { status: 'RUNNING' },
  })).id;

  let sitesChecked = 0;
  let resultsFound = 0;
  let totalDetailFetches = 0;

  try {
    const urls = await readScraperUrls();
    logger.info({ urls: urls.length }, '[BookScraper] URLs loaded');

    const allFindings: FindingRaw[] = [];

    for (const seedUrl of urls) {
      // ── Fetch seed (listing) page ──
      const seedPage = await fetchPage(seedUrl);
      sitesChecked++;
      if (!seedPage) {
        logger.warn({ seedUrl }, '[BookScraper] failed to fetch seed');
        await new Promise((r) => setTimeout(r, FETCH_DELAY_MS));
        continue;
      }

      // Update DB so the UI polling shows progress
      await (prisma as any).bookScrapeRun.update({
        where: { id: runId },
        data: { sitesChecked },
      });

      // ── Discover detail links ──
      const detailLinks = discoverDetailLinks(seedPage.html, seedPage.finalUrl);
      logger.info({ seedUrl, detailLinks: detailLinks.length }, '[BookScraper] detail links found');

      let foundOnThisSeed = 0;

      if (detailLinks.length > 0 && totalDetailFetches < MAX_TOTAL_DETAIL_FETCHES) {
        // Two-tier: fetch each detail page
        const linksToFetch = detailLinks.slice(0, MAX_DETAIL_LINKS_PER_SEED);
        for (const detailUrl of linksToFetch) {
          if (totalDetailFetches >= MAX_TOTAL_DETAIL_FETCHES) break;
          await new Promise((r) => setTimeout(r, FETCH_DELAY_MS));

          const detailPage = await fetchPage(detailUrl);
          totalDetailFetches++;
          sitesChecked++;
          if (!detailPage) continue;

          const finding = analyseDetailPage(detailPage.finalUrl, detailPage.html);
          if (finding) {
            allFindings.push(finding);
            foundOnThisSeed++;
            logger.info({ url: detailUrl, author: finding.authorName, book: finding.bookTitle }, '[BookScraper] detail hit');
          }
        }
      }

      // Fallback: also analyse the seed page directly (catches single-page sites)
      const seedFindings = analyseSeedPage(seedPage.finalUrl, seedPage.html);
      if (seedFindings.length > 0 && foundOnThisSeed === 0) {
        // Only use seed findings if we didn't get detail-page results
        allFindings.push(...seedFindings);
        logger.info({ seedUrl, found: seedFindings.length }, '[BookScraper] seed-level hits');
      }

      await new Promise((r) => setTimeout(r, FETCH_DELAY_MS));
    }

    // Deduplicate by (authorName, bookTitle) — keep first occurrence
    const dedupKey = (f: FindingRaw) =>
      `${(f.authorName ?? '').toLowerCase()}|${(f.bookTitle ?? '').toLowerCase()}`;
    const seen = new Set<string>();
    const unique = allFindings.filter((f) => {
      const k = dedupKey(f);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    if (unique.length > 0) {
      await (prisma as any).bookScrapeResult.createMany({
        data: unique.map((f) => ({ ...f, runId })),
      });
      resultsFound = unique.length;
    }

    await (prisma as any).bookScrapeRun.update({
      where: { id: runId },
      data: { status: 'SUCCESS', finishedAt: new Date(), sitesChecked, resultsFound },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ error: msg }, '[BookScraper] run failed');
    await (prisma as any).bookScrapeRun.update({
      where: { id: runId },
      data: { status: 'FAILED', finishedAt: new Date(), sitesChecked, resultsFound, error: msg },
    });
    throw err;
  }

  return { runId, sitesChecked, resultsFound };
}

// ── Text report ────────────────────────────────────────────────────────────────

export function formatResultsAsTxt(run: any, results: any[]): string {
  const lines: string[] = [];
  lines.push('='.repeat(70));
  lines.push('TEXAS BOOKS WEEKLY SCRAPE REPORT');
  lines.push(`Generated: ${new Date(run.startedAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT`);
  lines.push(`Sites checked: ${run.sitesChecked}  |  Results found: ${run.resultsFound}`);
  lines.push('='.repeat(70));
  lines.push('');

  if (results.length === 0) {
    lines.push('No new Texas book releases found this week.');
    return lines.join('\n');
  }

  const groups: Record<string, any[]> = { 'Both': [], 'Texas Author': [], 'Texas Book': [] };
  for (const r of results) (groups[r.texasConnection] ?? groups['Texas Book']).push(r);

  for (const [label, items] of Object.entries(groups)) {
    if (items.length === 0) continue;
    lines.push(`── ${label.toUpperCase()} ──────────────────────────────────────`);
    lines.push('');
    for (const r of items) {
      if (r.bookTitle)   lines.push(`Title:   ${r.bookTitle}`);
      if (r.authorName)  lines.push(`Author:  ${r.authorName}`);
      if (r.releaseDate) lines.push(`Release: ${r.releaseDate}`);
      if (r.contactInfo) lines.push(`Contact: ${r.contactInfo}`);
      lines.push(`Source:  ${r.sourceUrl}`);
      if (r.snippet) lines.push(`Snippet: ${r.snippet.slice(0, 300).replace(/\n/g, ' ')}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}
