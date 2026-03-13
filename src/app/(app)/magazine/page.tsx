'use client';

import { useMemo, useState } from 'react';
import { useFetch, api } from '@/lib/hooks';
import {
  Loader2, Plus, Filter, CheckCircle2, FolderCheck,
  Link as LinkIcon, FolderOpen, Circle, CheckCheck,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type Issue = {
  id:         string;
  year:       number;
  month:      number;
  title:      string;
  dueAt:      string | null;
  themeColor: string | null;
  theme:      string | null;
  driveLink:  string | null;
};

type Item = {
  id:            string;
  section:       string;
  kind:          string;
  title:         string;
  url:           string | null;
  notes:         string | null;
  proofed:       boolean;
  inFolder:      boolean;
  needsProofing: boolean;
  adSize:        string | null;
  dueAt:         string | null;
  ownerId:       string | null;
  owner?:        { id: string; name: string | null; email: string };
};

type IssueDetail = Issue & { items: Item[] };

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const SECTION_LABELS: Record<string, string> = {
  FRONT:                       'Front',
  FEATURES:                    'Features',
  REGULARS:                    'Regulars',
  EVENTS:                      'Events',
  SPONSORED_EDITORIAL_REVIEWS: 'Sponsored Editorial Reviews',
  BOOK_CAMPAIGNS:              'Book Campaigns',
  TEXAS_BOOKS_PREVIEW:         'Texas Books Preview',
  ADS:                         'Ads',
  OTHER:                       'Other',
};

// ── Status helpers ────────────────────────────────────────────────────────────

type ItemStatus = 'not_started' | 'proofed' | 'in_folder' | 'done';

function itemStatus(it: Item): ItemStatus {
  if (it.proofed && it.inFolder) return 'done';
  if (it.inFolder)               return 'in_folder';
  if (it.proofed)                return 'proofed';
  return 'not_started';
}

// Advance to next state: not_started → proofed → in_folder → done → not_started
function nextPatch(status: ItemStatus): Partial<Item> {
  if (status === 'not_started') return { proofed: true, needsProofing: false };
  if (status === 'proofed')     return { inFolder: true };
  if (status === 'in_folder')   return { proofed: true, inFolder: true };
  return { proofed: false, inFolder: false, needsProofing: true };
}

const STATUS_UI: Record<ItemStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  not_started: {
    label: 'Not Started',
    cls:   'bg-gray-50 border-gray-200 text-gray-600',
    icon:  <Circle className="w-3.5 h-3.5" />,
  },
  proofed: {
    label: 'Proofed',
    cls:   'bg-green-50 border-green-200 text-green-700',
    icon:  <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  in_folder: {
    label: 'In Folder',
    cls:   'bg-blue-50 border-blue-200 text-blue-700',
    icon:  <FolderCheck className="w-3.5 h-3.5" />,
  },
  done: {
    label: 'Done',
    cls:   'bg-indigo-50 border-indigo-200 text-indigo-700',
    icon:  <CheckCheck className="w-3.5 h-3.5" />,
  },
};

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ items }: { items: Item[] }) {
  const total    = items.length;
  if (total === 0) return null;
  const done     = items.filter((i) => itemStatus(i) === 'done').length;
  const inFolder = items.filter((i) => itemStatus(i) === 'in_folder').length;
  const proofed  = items.filter((i) => itemStatus(i) === 'proofed').length;
  const pct      = Math.round((done / total) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{done} of {total} done</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden flex">
        <div className="h-full bg-indigo-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />
        <div className="h-full bg-blue-400 transition-all"   style={{ width: `${(inFolder / total) * 100}%` }} />
        <div className="h-full bg-green-400 transition-all"  style={{ width: `${(proofed / total) * 100}%` }} />
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />Done: {done}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />In Folder: {inFolder}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Proofed: {proofed}</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MagazinePage() {
  const { data: issues, isLoading: loadingIssues } = useFetch<Issue[]>('/api/magazine/issues', {
    pollInterval: 30_000,
  });

  const [selectedIssueId,   setSelectedIssueId]   = useState<string | null>(null);
  const [filterSection,     setFilterSection]     = useState<string>('all');
  const [onlyNeedsProofing, setOnlyNeedsProofing] = useState(false);

  const issueId = selectedIssueId ?? issues?.[0]?.id ?? null;

  const { data: issueDetail, isLoading: loadingDetail, refetch } = useFetch<IssueDetail>(
    issueId ? `/api/magazine/issues/${issueId}` : null,
    { pollInterval: 20_000 }
  );

  // ── New Issue modal ────────────────────────────────────────────────────────
  const now = new Date();
  const [showNew,  setShowNew]  = useState(false);
  const [newMonth, setNewMonth] = useState<number>(now.getMonth() + 1);
  const [newYear,  setNewYear]  = useState<number>(now.getFullYear());
  const [newTheme, setNewTheme] = useState('');
  const [newDrive, setNewDrive] = useState('');
  const [creating, setCreating] = useState(false);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }

  // ── Grouped items ──────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const items = issueDetail?.items ?? [];
    const filtered = items.filter((it) => {
      if (filterSection !== 'all' && it.section !== filterSection) return false;
      if (onlyNeedsProofing && !it.needsProofing) return false;
      return true;
    });
    const map: Record<string, Item[]> = {};
    for (const it of filtered) {
      if (!map[it.section]) map[it.section] = [];
      map[it.section].push(it);
    }
    return map;
  }, [issueDetail?.items, filterSection, onlyNeedsProofing]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function cycleStatus(it: Item) {
    await api.patch(`/api/magazine/items/${it.id}`, nextPatch(itemStatus(it)));
    refetch();
  }

  async function createIssue() {
    if (!newTheme.trim() || !newDrive.trim()) return;
    setCreating(true);
    try {
      const result = await api.post<{ issueId: string; title: string; importedItems: number }>(
        '/api/magazine/issues',
        { month: newMonth, year: newYear, theme: newTheme.trim(), driveLink: newDrive.trim() }
      );
      setShowNew(false);
      setNewTheme('');
      setNewDrive('');
      showToast('success', `Created "${result?.title}" with ${result?.importedItems ?? 0} items`);
      setSelectedIssueId(result?.issueId ?? null);
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to create issue');
    } finally {
      setCreating(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loadingIssues) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Magazine</h1>
          <p className="text-sm text-gray-500">Monthly content map • Due on the 19th</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            value={issueId ?? ''}
            onChange={(e) => setSelectedIssueId(e.target.value)}
          >
            {(issues ?? []).map((i) => (
              <option key={i.id} value={i.id}>{i.title}</option>
            ))}
          </select>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            New Issue
          </button>
        </div>
      </div>

      {/* Issue meta */}
      {issueDetail && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {issueDetail.themeColor && (
                <div
                  className="w-3 h-3 rounded-full border border-gray-200 shrink-0"
                  style={{ backgroundColor: issueDetail.themeColor }}
                />
              )}
              <span className="font-semibold text-gray-900">{issueDetail.title}</span>
              {issueDetail.theme && (
                <span className="text-sm text-gray-500 italic">{issueDetail.theme}</span>
              )}
              {issueDetail.dueAt && (
                <span className="text-sm text-gray-500">• Due {formatDate(issueDetail.dueAt)}</span>
              )}
              {issueDetail.driveLink && (
                <a
                  href={issueDetail.driveLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Open Drive Folder
                </a>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white"
                  value={filterSection}
                  onChange={(e) => setFilterSection(e.target.value)}
                >
                  <option value="all">All sections</option>
                  {Object.entries(SECTION_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={onlyNeedsProofing}
                  onChange={(e) => setOnlyNeedsProofing(e.target.checked)}
                />
                Needs proofing
              </label>
            </div>
          </div>
          <ProgressBar items={issueDetail.items} />
        </div>
      )}

      {/* Body */}
      {loadingDetail ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : !issueDetail ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-500">
          No issue selected. Create one with &ldquo;New Issue&rdquo;.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([sectionKey, items]) => {
            const doneCount = items.filter((i) => itemStatus(i) === 'done').length;
            return (
              <div key={sectionKey} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <div className="font-semibold text-sm text-gray-800">
                    {SECTION_LABELS[sectionKey] ?? sectionKey}
                  </div>
                  <div className="text-xs text-gray-500">{doneCount}/{items.length} done</div>
                </div>

                <div className="divide-y divide-gray-100">
                  {items.map((it) => {
                    const status = itemStatus(it);
                    const ui     = STATUS_UI[status];
                    return (
                      <div
                        key={it.id}
                        className={cn(
                          'px-4 py-3 flex flex-col md:flex-row md:items-center gap-3',
                          status === 'done' && 'opacity-50'
                        )}
                      >
                        {/* Status cycle button */}
                        <button
                          onClick={() => cycleStatus(it)}
                          title="Click to advance status"
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium shrink-0 transition-all',
                            ui.cls
                          )}
                        >
                          {ui.icon}
                          {ui.label}
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              'text-sm font-medium text-gray-900',
                              it.kind === 'SUBITEM' && 'pl-4 text-gray-500',
                              status === 'done' && 'line-through text-gray-400',
                            )}>
                              {it.title}
                            </span>
                            {it.adSize && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                                {it.adSize}
                              </span>
                            )}
                            {it.needsProofing && status === 'not_started' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                Needs proofing
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                            {it.dueAt && <span>Due {formatDate(it.dueAt)}</span>}
                            {it.url && (
                              <a
                                href={it.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-indigo-500 hover:underline"
                              >
                                <LinkIcon className="w-3 h-3" />
                                Open in Drive
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Issue Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-lg border border-gray-200 shadow-xl">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="font-semibold text-gray-900">New Magazine Issue</div>
              <button onClick={() => setShowNew(false)} className="text-sm text-gray-500 hover:text-gray-900">
                Close
              </button>
            </div>

            <div className="p-4 space-y-4">
              {toast?.type === 'error' && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {toast.message}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Month</label>
                  <select
                    value={newMonth}
                    onChange={(e) => setNewMonth(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                  <input
                    type="number"
                    value={newYear}
                    onChange={(e) => setNewYear(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    min={2024}
                    max={2035}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Theme</label>
                <input
                  type="text"
                  value={newTheme}
                  onChange={(e) => setNewTheme(e.target.value)}
                  placeholder="e.g. Romance, Wellness, Business"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Google Drive Folder URL
                </label>
                <input
                  type="url"
                  value={newDrive}
                  onChange={(e) => setNewDrive(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-xs"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Subfolders map to sections automatically. All items due the 19th.
                  Share the folder with the service account email before submitting.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowNew(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createIssue}
                  disabled={creating || !newTheme.trim() || !newDrive.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {creating ? 'Reading Drive…' : 'Create Issue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast?.type === 'success' && (
        <div className="fixed bottom-4 right-4 z-50 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm shadow-lg">
          {toast.message}
        </div>
      )}
    </div>
  );
}
