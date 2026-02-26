'use client';

import { useFetch } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Clock,
  Users,
  CheckCircle2,
  Loader2,
  CalendarClock,
  Bell,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SERSummary {
  totalActive: number;
  unassigned: number;
  overdue: number;
  dueSoon: number;
  avgAssignmentDays: number | null;
  avgReviewDays: number | null;
  completedCount: number;
}

interface SERActiveItem {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
  createdAt: string;
  owner: { name: string | null; email: string } | null;
  daysUntilDue: number | null;
  daysSinceCreated: number;
}

interface SERCompleted {
  id: string;
  title: string;
  completedAt: string;
  cycleDays: number;
}

interface ReminderLogEntry {
  type: string;
  sentAt: string;
  itemTitle: string;
}

interface SerHealthData {
  summary: SERSummary;
  active: SERActiveItem[];
  recentCompleted: SERCompleted[];
  reminderLog: ReminderLogEntry[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  BACKLOG:     'bg-gray-100 text-gray-600',
  READY:       'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  BLOCKED:     'bg-red-100 text-red-700',
  IN_REVIEW:   'bg-purple-100 text-purple-700',
  NEEDS_QA:    'bg-yellow-100 text-yellow-700',
  DONE:        'bg-green-100 text-green-700',
};

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog', READY: 'Ready', IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked', IN_REVIEW: 'In Review', NEEDS_QA: 'Needs QA', DONE: 'Done',
};

const REMINDER_LABELS: Record<string, { label: string; cls: string }> = {
  DUE_7DAY: { label: '7-day notice', cls: 'bg-yellow-100 text-yellow-700' },
  DUE_2DAY: { label: '2-day notice', cls: 'bg-orange-100 text-orange-700' },
  OVERDUE:  { label: 'Overdue escalation', cls: 'bg-red-100 text-red-700' },
};

function riskBadge(item: SERActiveItem) {
  if (item.daysUntilDue === null) return null;
  if (item.daysUntilDue < 0) return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700">
      🔴 OVERDUE {Math.abs(item.daysUntilDue)}d
    </span>
  );
  if (item.daysUntilDue <= 2) return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-700">
      🟠 {item.daysUntilDue}d left
    </span>
  );
  if (item.daysUntilDue <= 7) return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-yellow-100 text-yellow-700">
      🟡 {item.daysUntilDue}d left
    </span>
  );
  return (
    <span className="text-xs text-gray-400">{item.daysUntilDue}d left</span>
  );
}

function StatCard({
  icon, label, value, sub, alert,
}: {
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
        <p className={cn('text-2xl font-bold leading-tight', alert && 'text-red-700')}>
          {value}
        </p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SERPage() {
  const { data, isLoading } = useFetch<SerHealthData>('/api/metrics/ser-health');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const { summary, active, recentCompleted, reminderLog } = data ?? {
    summary: {
      totalActive: 0, unassigned: 0, overdue: 0, dueSoon: 0,
      avgAssignmentDays: null, avgReviewDays: null, completedCount: 0,
    },
    active: [],
    recentCompleted: [],
    reminderLog: [],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">SER Intelligence</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sponsored Editorial Review pipeline health
        </p>
      </div>

      {/* Overdue alert banner */}
      {summary.overdue > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-800 font-medium">
            {summary.overdue} SER {summary.overdue === 1 ? 'item is' : 'items are'} overdue.
            {summary.unassigned > 0 && ` ${summary.unassigned} unassigned.`}
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={<CalendarClock className="w-5 h-5 text-indigo-600" />}
          label="Active SERs"
          value={summary.totalActive}
        />
        <StatCard
          icon={<Users className="w-5 h-5 text-orange-500" />}
          label="Unassigned"
          value={summary.unassigned}
          alert={summary.unassigned > 0}
          sub={summary.unassigned > 0 ? 'need an owner' : undefined}
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
          label="Overdue"
          value={summary.overdue}
          alert={summary.overdue > 0}
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-yellow-600" />}
          label="Due in 7 days"
          value={summary.dueSoon}
          alert={summary.dueSoon > 0}
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-blue-600" />}
          label="Avg Assignment"
          value={summary.avgAssignmentDays != null ? `${summary.avgAssignmentDays}d` : '—'}
          sub="created → started"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
          label="Avg Review Time"
          value={summary.avgReviewDays != null ? `${summary.avgReviewDays}d` : '—'}
          sub={`across ${summary.completedCount} completed`}
        />
      </div>

      {/* Active SER table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Active SER Items</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Sorted by urgency — overdue first
            </p>
          </div>
          <span className="text-xs text-gray-400">{active.length} item{active.length !== 1 ? 's' : ''}</span>
        </div>
        {active.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No active SER items. All caught up!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Title</th>
                  <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium">Owner</th>
                  <th className="text-left px-4 py-2.5 font-medium">Risk</th>
                  <th className="text-right px-4 py-2.5 font-medium">Age</th>
                </tr>
              </thead>
              <tbody>
                {active.map((item) => (
                  <tr
                    key={item.id}
                    className={cn(
                      'border-t border-gray-100 hover:bg-gray-50',
                      item.daysUntilDue !== null && item.daysUntilDue < 0 && 'bg-red-50/50',
                      item.daysUntilDue !== null && item.daysUntilDue >= 0 && item.daysUntilDue <= 2 && 'bg-orange-50/40',
                    )}
                  >
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">
                      {item.title}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'rounded px-2 py-0.5 text-[10px] font-bold',
                        STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-600',
                      )}>
                        {STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.owner ? (
                        <span className="text-gray-700">{item.owner.name ?? item.owner.email}</span>
                      ) : (
                        <span className="text-red-600 font-semibold text-xs">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{riskBadge(item)}</td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {item.daysSinceCreated}d old
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent completions */}
      {recentCompleted.length > 0 && (
        <details className="bg-white rounded-xl border border-gray-200 shadow-sm group">
          <summary className="px-5 py-4 flex items-center justify-between cursor-pointer select-none list-none">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 inline">
                Recent Completions
              </h2>
              <span className="ml-2 text-xs text-gray-400">
                ({recentCompleted.length} shown)
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
                  <th className="text-left px-4 py-2.5 font-medium">Completed</th>
                  <th className="text-right px-4 py-2.5 font-medium">Cycle Time</th>
                </tr>
              </thead>
              <tbody>
                {recentCompleted.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">
                      {item.title}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(item.completedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700">
                      {item.cycleDays}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Reminder log */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Recent Reminders Sent</h2>
        </div>
        {reminderLog.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            No reminders sent yet.
            {' '}Reminders fire automatically when SERs approach or pass their due date.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {reminderLog.map((r, i) => {
              const meta = REMINDER_LABELS[r.type] ?? { label: r.type, cls: 'bg-gray-100 text-gray-600' };
              return (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <span className={cn('rounded px-2 py-0.5 text-[10px] font-bold shrink-0', meta.cls)}>
                    {meta.label}
                  </span>
                  <span className="text-sm text-gray-700 truncate flex-1">{r.itemTitle}</span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(r.sentAt).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
