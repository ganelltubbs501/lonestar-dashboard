'use client';

import { useEffect, useRef, useState } from 'react';

type ScrapeRun = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  sitesChecked: number;
  resultsFound: number;
  error: string | null;
};

type ScrapeResult = {
  id: string;
  sourceUrl: string;
  pageTitle: string | null;
  authorName: string | null;
  bookTitle: string | null;
  contactInfo: string | null;
  releaseDate: string | null;
  texasConnection: string;
  snippet: string | null;
};

const CONNECTION_COLORS: Record<string, string> = {
  'Both': 'bg-purple-100 text-purple-700',
  'Texas Author': 'bg-blue-100 text-blue-700',
  'Texas Book': 'bg-green-100 text-green-700',
};

export default function ScrapeResultsPage() {
  const [runs, setRuns] = useState<ScrapeRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<ScrapeRun | null>(null);
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingRunId = useRef<string | null>(null);

  async function loadRuns(autoSelectRunId?: string) {
    setLoading(true);
    try {
      const res = await fetch('/api/scrape-results');
      const json = await res.json();
      const fetched: ScrapeRun[] = json?.data?.runs ?? [];
      setRuns(fetched);
      if (autoSelectRunId) {
        const run = fetched.find((r) => r.id === autoSelectRunId);
        if (run) openRun(run);
      }
      return fetched;
    } finally {
      setLoading(false);
    }
  }

  async function openRun(run: ScrapeRun) {
    setSelectedRun(run);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/scrape-results?runId=${run.id}`);
      const json = await res.json();
      setResults(json?.data?.results ?? []);
    } finally {
      setDetailLoading(false);
    }
  }

  function startPolling(runId: string) {
    stopPolling();
    pollingRunId.current = runId;
    pollRef.current = setInterval(async () => {
      const res = await fetch('/api/scrape-results');
      const json = await res.json();
      const fetched: ScrapeRun[] = json?.data?.runs ?? [];
      setRuns(fetched);
      const current = fetched.find((r) => r.id === runId);
      if (current) {
        setSelectedRun(current);
        if (current.status !== 'RUNNING') {
          stopPolling();
          setRunning(false);
          // reload results now that it's done
          const detail = await fetch(`/api/scrape-results?runId=${runId}`);
          const dj = await detail.json();
          setResults(dj?.data?.results ?? []);
        }
      }
    }, 4000);
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  async function triggerRun() {
    setRunning(true);
    try {
      const res = await fetch('/api/scrape-results', { method: 'POST' });
      const json = await res.json();
      const runId: string = json?.data?.runId;
      if (runId) {
        await loadRuns(runId);
        startPolling(runId);
      }
    } catch {
      setRunning(false);
    }
  }

  useEffect(() => {
    loadRuns();
    return () => stopPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredResults = filter === 'all'
    ? results
    : results.filter((r) => r.texasConnection === filter);

  return (
    <div className="flex h-[calc(100vh-48px)]">
      {/* Left panel — run list */}
      <div className="w-80 border-r bg-white p-4 overflow-auto flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Book Scraper</h1>
          <button
            onClick={triggerRun}
            disabled={running}
            className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {running && <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />}
            {running ? 'Scanning…' : 'Run Now'}
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-3">
          Runs every Friday — scans configured websites for new Texas author/book releases.
        </p>

        {loading && <p className="text-sm text-gray-400">Loading…</p>}

        <div className="space-y-2">
          {runs.map((run) => (
            <button
              key={run.id}
              onClick={() => openRun(run)}
              className={`w-full text-left rounded border p-3 text-sm transition ${
                selectedRun?.id === run.id
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {new Date(run.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                  run.status === 'SUCCESS' ? 'bg-green-100 text-green-700' :
                  run.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {run.status}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {run.sitesChecked} sites · {run.resultsFound} results
              </div>
              {run.error && (
                <div className="text-xs text-red-600 mt-1 truncate">{run.error}</div>
              )}
            </button>
          ))}
          {!loading && runs.length === 0 && (
            <p className="text-sm text-gray-400">No runs yet — click "Run Now" to start.</p>
          )}
        </div>
      </div>

      {/* Right panel — results */}
      {selectedRun ? (
        <div className="flex-1 overflow-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">
                {new Date(selectedRun.startedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h2>
              <p className="text-sm text-gray-500">
                {selectedRun.sitesChecked} sites checked · {selectedRun.resultsFound} results found
                {selectedRun.finishedAt && ` · ${Math.round((new Date(selectedRun.finishedAt).getTime() - new Date(selectedRun.startedAt).getTime()) / 1000)}s`}
              </p>
            </div>
            <a
              href={`/api/scrape-results?runId=${selectedRun.id}&format=txt`}
              download
              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Download .txt
            </a>
          </div>

          {selectedRun?.status === 'RUNNING' && (
            <div className="mb-4 rounded border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse flex-shrink-0" />
              Scraping websites… {selectedRun.sitesChecked > 0 ? `${selectedRun.sitesChecked} sites checked so far` : 'starting up'}
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex gap-2 mb-4">
            {['all', 'Both', 'Texas Author', 'Texas Book'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  filter === f
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {f === 'all' ? `All (${results.length})` : `${f} (${results.filter((r) => r.texasConnection === f).length})`}
              </button>
            ))}
          </div>

          {detailLoading && <p className="text-sm text-gray-400">Loading results…</p>}

          {!detailLoading && filteredResults.length === 0 && (
            <p className="text-gray-400 text-sm">No results for this filter.</p>
          )}

          <div className="space-y-3">
            {filteredResults.map((r) => (
              <div key={r.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    {r.bookTitle && (
                      <p className="font-semibold text-gray-900 truncate">{r.bookTitle}</p>
                    )}
                    {r.authorName && (
                      <p className="text-sm text-gray-700">by {r.authorName}</p>
                    )}
                    {r.pageTitle && !r.bookTitle && (
                      <p className="font-medium text-gray-800 truncate">{r.pageTitle}</p>
                    )}
                  </div>
                  <span className={`flex-shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${CONNECTION_COLORS[r.texasConnection] ?? 'bg-gray-100 text-gray-700'}`}>
                    {r.texasConnection}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-2">
                  {r.releaseDate && <span>Release: <span className="text-gray-700 font-medium">{r.releaseDate}</span></span>}
                  {r.contactInfo && <span>Contact: <span className="text-gray-700">{r.contactInfo}</span></span>}
                  <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate max-w-xs">
                    {r.sourceUrl}
                  </a>
                </div>

                {r.snippet && (
                  <p className="text-xs text-gray-500 italic line-clamp-2">"{r.snippet.slice(0, 200)}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Select a run to view results
        </div>
      )}
    </div>
  );
}
