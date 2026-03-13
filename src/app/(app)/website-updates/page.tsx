'use client';

import { useState, useMemo } from 'react';
import { useFetch } from '@/lib/hooks';
import { Globe, Loader2, Search, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SheetData {
  name: string;
  headers: string[];
  rows: string[][];
}

interface WebsiteUpdatesData {
  sheets: SheetData[];
}

function isUrl(val: string) {
  return val.startsWith('http://') || val.startsWith('https://');
}

function statusColor(val: string) {
  const v = val.toLowerCase();
  if (v === 'done' || v === 'complete' || v === 'completed') return 'bg-green-100 text-green-700';
  if (v === 'in progress' || v === 'in-progress') return 'bg-blue-100 text-blue-700';
  if (v === 'blocked' || v === 'on hold') return 'bg-red-100 text-red-700';
  if (v === 'pending' || v === 'not started' || v === 'todo' || v === 'to do') return 'bg-gray-100 text-gray-600';
  return null;
}

function SheetTable({ sheet, search }: { sheet: SheetData; search: string }) {
  const filtered = useMemo(() => {
    if (!search.trim()) return sheet.rows;
    const q = search.toLowerCase();
    return sheet.rows.filter((row) => row.some((cell) => cell.toLowerCase().includes(q)));
  }, [sheet.rows, search]);

  if (!sheet.headers.length) {
    return <p className="px-4 py-8 text-center text-gray-400 text-sm">No data in this sheet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {sheet.headers.map((h, i) => (
              <th
                key={i}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={sheet.headers.length} className="px-4 py-8 text-center text-gray-400">
                No results match your search.
              </td>
            </tr>
          ) : (
            filtered.map((row, ri) => (
              <tr key={ri} className="hover:bg-gray-50 transition-colors">
                {row.map((cell, ci) => {
                  const badge = statusColor(cell);
                  return (
                    <td key={ci} className="px-4 py-3 text-gray-700 align-top">
                      {isUrl(cell) ? (
                        <a
                          href={cell}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate max-w-[220px]">{cell}</span>
                        </a>
                      ) : badge ? (
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', badge)}>
                          {cell}
                        </span>
                      ) : (
                        <span className="whitespace-pre-wrap">{cell}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
        {filtered.length} of {sheet.rows.length} row{sheet.rows.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

export default function WebsiteUpdatesPage() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  const { data, isLoading, error } = useFetch<WebsiteUpdatesData>('/api/website-updates', {
    pollInterval: 60000,
  });

  const sheets = data?.sheets ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Globe className="w-6 h-6 text-indigo-600" />
          Website Updates
        </h1>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 text-sm">
          Failed to load spreadsheet data. Make sure the service account has access to this sheet.
        </div>
      ) : sheets.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          No data found in spreadsheet.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {sheets.map((sheet, i) => (
              <button
                key={sheet.name}
                onClick={() => setActiveTab(i)}
                className={cn(
                  'px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  activeTab === i
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                {sheet.name}
              </button>
            ))}
          </div>

          {/* Active sheet */}
          {sheets[activeTab] && (
            <SheetTable sheet={sheets[activeTab]} search={search} />
          )}
        </div>
      )}
    </div>
  );
}
