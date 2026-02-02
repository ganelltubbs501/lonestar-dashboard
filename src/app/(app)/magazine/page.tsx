'use client';

import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useFetch, api } from '@/lib/hooks';
import { Loader2, Upload, Filter, CheckCircle2, FolderCheck, Link as LinkIcon } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

type Issue = {
  id: string;
  year: number;
  month: number;
  title: string;
  dueAt: string | null;
  themeColor: string | null;
};

type Item = {
  id: string;
  section: string;
  kind: string;
  title: string;
  url: string | null;
  notes: string | null;
  proofed: boolean;
  inFolder: boolean;
  needsProofing: boolean;
  adSize: string | null;
  dueAt: string | null;
  ownerId: string | null;
  owner?: { id: string; name: string | null; email: string };
};

type IssueDetail = Issue & { items: Item[] };

const SECTION_LABELS: Record<string, string> = {
  FRONT: 'Front',
  EVENTS: 'Events',
  SPONSORED_EDITORIAL_REVIEWS: 'Sponsored Editorial Reviews',
  BOOK_CAMPAIGNS: 'Book Campaigns',
  TEXAS_BOOKS_PREVIEW: 'Texas Books Preview',
  ADS: 'Ads',
  OTHER: 'Other',
};

export default function MagazinePage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'ADMIN';

  const { data: issues, isLoading: loadingIssues } = useFetch<Issue[]>('/api/magazine/issues', {
    pollInterval: 30000,
  });

  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [filterSection, setFilterSection] = useState<string>('all');
  const [onlyNeedsProofing, setOnlyNeedsProofing] = useState(false);

  const issueId = selectedIssueId ?? issues?.[0]?.id ?? null;

  const { data: issueDetail, isLoading: loadingDetail, refetch } = useFetch<IssueDetail>(
    issueId ? `/api/magazine/issues/${issueId}` : null,
    { pollInterval: 20000 }
  );

  // Import modal state
  const [csvText, setCsvText] = useState('');
  const [importYear, setImportYear] = useState<number>(new Date().getFullYear());
  const [importMonth, setImportMonth] = useState<number>(new Date().getMonth() + 1);
  const [importing, setImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  async function toggleItem(id: string, patch: Partial<Item>) {
    await api.patch(`/api/magazine/items/${id}`, patch);
    refetch(); // refresh
  }

  async function runImport() {
    setImporting(true);
    setToast(null);
    try {
      await api.post('/api/admin/magazine/import', {
        year: importYear,
        month: importMonth,
        csvText,
        overwrite: true,
      });
      setShowImport(false);
      setCsvText('');
      setToast({ type: 'success', message: 'Imported successfully' });
      // refresh issues + detail
      window.location.reload();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Import failed';
      setToast({ type: 'error', message });
    } finally {
      setImporting(false);
    }
  }

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
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>

          {isAdmin && (
            <button
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
          )}
        </div>
      </div>

      {/* Meta */}
      {issueDetail && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full border border-gray-200"
              style={{ backgroundColor: issueDetail.themeColor ?? '#e5e7eb' }}
              title={issueDetail.themeColor ?? undefined}
            />
            <div className="text-sm text-gray-700">
              <span className="font-medium">{issueDetail.title}</span>
              {issueDetail.dueAt ? (
                <span className="text-gray-500"> • Due {formatDate(issueDetail.dueAt)}</span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                className="border border-gray-200 rounded-lg px-2 py-1 bg-white"
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
              >
                <option value="all">All sections</option>
                {Object.keys(SECTION_LABELS).map((k) => (
                  <option key={k} value={k}>
                    {SECTION_LABELS[k]}
                  </option>
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
      )}

      {/* Body */}
      {loadingDetail ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : !issueDetail ? (
        <div className="text-sm text-gray-500">No issue selected.</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([sectionKey, items]) => (
            <div key={sectionKey} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <div className="font-semibold text-gray-900">
                  {SECTION_LABELS[sectionKey] ?? sectionKey}
                </div>
                <div className="text-xs text-gray-500">{items.length} items</div>
              </div>

              <div className="divide-y divide-gray-100">
                {items.map((it) => (
                  <div key={it.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm font-medium text-gray-900', it.kind === 'SUBITEM' && 'pl-4')}>
                          {it.title}
                        </span>
                        {it.adSize ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                            {it.adSize}
                          </span>
                        ) : null}
                        {it.needsProofing ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            Needs proofing
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                        {it.dueAt ? <span>Due {formatDate(it.dueAt)}</span> : null}
                        {it.url ? (
                          <a
                            href={it.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                          >
                            <LinkIcon className="w-3 h-3" />
                            Link
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleItem(it.id, { proofed: !it.proofed, needsProofing: it.proofed })}
                        className={cn(
                          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm',
                          it.proofed
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Proofed
                      </button>

                      <button
                        onClick={() => toggleItem(it.id, { inFolder: !it.inFolder })}
                        className={cn(
                          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm',
                          it.inFolder
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        <FolderCheck className="w-4 h-4" />
                        In Folder
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Import Modal */}
      {showImport && isAdmin && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl border border-gray-200 shadow-lg">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="font-semibold text-gray-900">Import Magazine CSV</div>
              <button onClick={() => setShowImport(false)} className="text-sm text-gray-600 hover:text-gray-900">
                Close
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Error toast inside modal */}
              {toast?.type === 'error' && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {toast.message}
                </div>
              )}

              <div className="flex gap-3">
                <input
                  type="number"
                  value={importYear}
                  onChange={(e) => setImportYear(Number(e.target.value))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32"
                  placeholder="Year"
                />
                <input
                  type="number"
                  value={importMonth}
                  onChange={(e) => setImportMonth(Number(e.target.value))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32"
                  placeholder="Month"
                  min={1}
                  max={12}
                />
                <div className="text-sm text-gray-500 self-center">Due will be set to the 19th.</div>
              </div>

              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full h-64 border border-gray-200 rounded-lg p-3 text-xs font-mono"
                placeholder="Paste CSV export here..."
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowImport(false)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={runImport}
                  disabled={importing || !csvText.trim()}
                  className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {importing ? 'Importing…' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {toast?.type === 'success' && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm shadow-lg">
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}