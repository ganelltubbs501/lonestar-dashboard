'use client';

import { useFetch } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  ResponsiveContainer, LabelList,
} from 'recharts';
import {
  AlertTriangle, CheckCircle2, Clock, Loader2, ShieldAlert,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SlaRule {
  workItemType:  string;
  label:         string;
  targetDays:    number | null;
  dueDateDriven: boolean;
  activeCount:   number;
  breachCount:   number;
  dueSoonCount:  number;
  completedCount: number;
  missedCount:   number;
  missedPct:     number | null;
}

interface FlaggedItem {
  id:         string;
  title:      string;
  type:       string;
  status:     string;
  owner:      { name: string | null; email: string | null } | null;
  deadline:   string | null;
  daysOverdue: number | null;
  slaStatus:  'BREACH' | 'DUE_SOON';
}

interface RecentMiss {
  id:          string;
  title:       string;
  type:        string;
  completedAt: string;
  daysLate:    number;
}

interface SlaData {
  summary: {
    totalBreach:  number;
    totalDueSoon: number;
    worstType:    { label: string; missedPct: number } | null;
  };
  rules:        SlaRule[];
  flagged:      FlaggedItem[];
  recentMisses: RecentMiss[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  BOOK_CAMPAIGN:              'Book Campaign',
  SOCIAL_ASSET_REQUEST:       'Social Graphics',
  SPONSORED_EDITORIAL_REVIEW: 'SER',
  TX_BOOK_PREVIEW_LEAD:       'TX Book Preview',
  WEBSITE_EVENT:              'Website Event',
  ACCESS_REQUEST:             'Access Request',
  GENERAL:                    'General',
};

const STATUS_COLORS: Record<string, string> = {
  BACKLOG:     'bg-gray-100 text-gray-600',
  READY:       'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  BLOCKED:     'bg-red-100 text-red-700',
  IN_REVIEW:   'bg-purple-100 text-purple-700',
  NEEDS_QA:    'bg-yellow-100 text-yellow-700',
  DONE:        'bg-green-100 text-green-700',
};

function breachColor(pct: number | null) {
  if (pct === null) return '#9ca3af';
  if (pct >= 40) return '#ef4444';
  if (pct >= 20) return '#f59e0b';
  return '#10b981';
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function StatCard({ icon, label, value, sub, alert }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-xl border p-4 shadow-sm flex items-start gap-3',
      alert ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200',
    )}>
      <div className={cn('p-2 rounded-lg', alert ? 'bg-red-100' : 'bg-gray-50')}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className={cn('text-2xl font-bold leading-tight', alert && 'text-red-700')}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SlaPage() {
  const { data, isLoading } = useFetch<SlaData>('/api/sla');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const { summary, rules, flagged, recentMisses } = data ?? {
    summary: { totalBreach: 0, totalDueSoon: 0, worstType: null },
    rules: [],
    flagged: [],
    recentMisses: [],
  };

  const chartData = rules
    .filter((r) => r.missedPct !== null || r.breachCount > 0)
    .map((r) => ({
      label: r.label,
      missedPct: r.missedPct ?? 0,
      breachCount: r.breachCount,
    }));

  const chartHeight = Math.max(160, chartData.length * 44);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">SLA Intelligence</h1>
        <p className="text-sm text-gray-500 mt-1">
          Soft SLA targets, breach rates, and at-risk items
        </p>
      </div>

      {/* Alert banner */}
      {summary.totalBreach > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-800 font-medium">
            {summary.totalBreach} item{summary.totalBreach !== 1 ? 's' : ''} have breached their SLA.
            {summary.totalDueSoon > 0 && ` ${summary.totalDueSoon} more due within 48 hours.`}
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<ShieldAlert className="w-5 h-5 text-red-600" />}
          label="Active SLA Breaches"
          value={summary.totalBreach}
          alert={summary.totalBreach > 0}
          sub="non-DONE past deadline"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-yellow-600" />}
          label="Due in 48h"
          value={summary.totalDueSoon}
          alert={summary.totalDueSoon > 0}
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
          label="Most-missed Type"
          value={summary.worstType ? `${summary.worstType.missedPct}%` : '—'}
          sub={summary.worstType?.label ?? 'no data yet'}
          alert={summary.worstType !== null && summary.worstType.missedPct >= 40}
        />
      </div>

      {/* Missed % per type chart */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Missed SLA % by Type</h2>
        <p className="text-xs text-gray-400 mb-4">
          % of completed items that finished after their SLA deadline
        </p>
        {chartData.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
            No completed items with SLA data yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 110, right: 60, top: 4, bottom: 4 }}
            >
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 11 }}
                width={105}
              />
              <Tooltip
                formatter={(v: any) => [`${v}%`, 'Missed']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="missedPct" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={breachColor(entry.missedPct)} />
                ))}
                <LabelList
                  dataKey="missedPct"
                  position="right"
                  formatter={(v: any) => `${v}%`}
                  style={{ fontSize: 11, fill: '#6b7280' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Per-type detail table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">SLA Rules Summary</h2>
          <p className="text-xs text-gray-400 mt-0.5">all types with configured SLA targets</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Type</th>
              <th className="text-left px-4 py-2.5 font-medium">Target</th>
              <th className="text-right px-4 py-2.5 font-medium">Active</th>
              <th className="text-right px-4 py-2.5 font-medium">Breaching</th>
              <th className="text-right px-4 py-2.5 font-medium">Completed</th>
              <th className="text-right px-4 py-2.5 font-medium">Missed</th>
              <th className="text-right px-4 py-2.5 font-medium">Miss Rate</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.workItemType} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{r.label}</td>
                <td className="px-4 py-3 text-gray-500">
                  {r.dueDateDriven ? 'due date' : `${r.targetDays}d`}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{r.activeCount}</td>
                <td className="px-4 py-3 text-right">
                  {r.breachCount > 0 ? (
                    <span className="font-bold text-red-600">{r.breachCount}</span>
                  ) : (
                    <span className="text-gray-400">{r.breachCount}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">{r.completedCount}</td>
                <td className="px-4 py-3 text-right text-gray-500">{r.missedCount}</td>
                <td className="px-4 py-3 text-right">
                  {r.missedPct !== null ? (
                    <span className={cn(
                      'font-semibold',
                      r.missedPct >= 40 ? 'text-red-600' :
                      r.missedPct >= 20 ? 'text-yellow-600' : 'text-green-600',
                    )}>
                      {r.missedPct}%
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Active flagged items */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Flagged Items</h2>
            <p className="text-xs text-gray-400 mt-0.5">breaching or due within 48 hours</p>
          </div>
          <span className="text-xs text-gray-400">{flagged.length} item{flagged.length !== 1 ? 's' : ''}</span>
        </div>
        {flagged.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
            No flagged items — all within SLA!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Title</th>
                  <th className="text-left px-4 py-2.5 font-medium">Type</th>
                  <th className="text-left px-4 py-2.5 font-medium">Owner</th>
                  <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium">SLA</th>
                  <th className="text-left px-4 py-2.5 font-medium">Deadline</th>
                  <th className="text-right px-4 py-2.5 font-medium">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {flagged.map((item) => (
                  <tr
                    key={item.id}
                    className={cn(
                      'border-t border-gray-100 hover:bg-gray-50',
                      item.slaStatus === 'BREACH' && 'bg-red-50/50',
                      item.slaStatus === 'DUE_SOON' && 'bg-orange-50/40',
                    )}
                  >
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">
                      {item.title}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {TYPE_LABELS[item.type] ?? item.type}
                    </td>
                    <td className="px-4 py-3">
                      {item.owner ? (
                        <span className="text-gray-700">{item.owner.name ?? item.owner.email}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'rounded px-2 py-0.5 text-[10px] font-bold',
                        STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-600',
                      )}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.slaStatus === 'BREACH' ? (
                        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700">
                          🔴 BREACH
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-700">
                          🟡 DUE SOON
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(item.deadline)}</td>
                    <td className="px-4 py-3 text-right">
                      {item.daysOverdue != null ? (
                        <span className="font-bold text-red-600">{item.daysOverdue}d</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent SLA misses */}
      {recentMisses.length > 0 && (
        <details className="bg-white rounded-xl border border-gray-200 shadow-sm group">
          <summary className="px-5 py-4 flex items-center justify-between cursor-pointer select-none list-none">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 inline">
                Recent SLA Misses
              </h2>
              <span className="ml-2 text-xs text-gray-400">
                (last 30 days — {recentMisses.length} completed late)
              </span>
            </div>
            <span className="text-xs text-gray-400 group-open:hidden">Show ▼</span>
            <span className="text-xs text-gray-400 hidden group-open:inline">Hide ▲</span>
          </summary>
          <div className="border-t border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Title</th>
                  <th className="text-left px-4 py-2.5 font-medium">Type</th>
                  <th className="text-left px-4 py-2.5 font-medium">Completed</th>
                  <th className="text-right px-4 py-2.5 font-medium">Days Late</th>
                </tr>
              </thead>
              <tbody>
                {recentMisses.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">
                      {item.title}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {TYPE_LABELS[item.type] ?? item.type}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(item.completedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">
                      +{item.daysLate}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
