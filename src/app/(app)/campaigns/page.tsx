'use client';

import { useFetch } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type MilestoneType =
  | 'SIGNUP_DEADLINE'
  | 'GRAPHICS_DUE'
  | 'FOLDER_TO_REVIEWERS'
  | 'WRAP_UP';

interface MilestoneData {
  plannedAt: string | null;
  completedAt: string | null;
  note: string | null;
}

interface Campaign {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  owner: { name: string | null; email: string | null } | null;
  milestones: Record<MilestoneType, MilestoneData>;
}

interface MilestoneStats {
  type: string;
  label: string;
  totalPlanned: number;
  totalCompleted: number;
  onTime: number;
  late: number;
  onTimePct: number | null;
  avgDelayDays: number | null;
}

interface PerformanceData {
  summary: { total: number; completed: number; fullyOnTime: number };
  byMilestone: MilestoneStats[];
  delayReasons: { note: string; count: number }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MILESTONE_TYPES: MilestoneType[] = [
  'SIGNUP_DEADLINE',
  'GRAPHICS_DUE',
  'FOLDER_TO_REVIEWERS',
  'WRAP_UP',
];

const MILESTONE_LABELS: Record<MilestoneType, string> = {
  SIGNUP_DEADLINE:    'Signup Deadline',
  GRAPHICS_DUE:       'Graphics Due',
  FOLDER_TO_REVIEWERS:'Folder → Reviewers',
  WRAP_UP:            'Wrap-up',
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

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog', READY: 'Ready', IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked', IN_REVIEW: 'In Review', NEEDS_QA: 'Needs QA', DONE: 'Done',
};

const BAR_COLORS = ['#6366f1', '#f59e0b', '#ef4444', '#10b981'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function milestoneNodeState(m: MilestoneData): 'done' | 'late' | 'planned' | 'empty' {
  if (m.completedAt) {
    if (m.plannedAt && new Date(m.completedAt) > new Date(m.plannedAt)) return 'late';
    return 'done';
  }
  if (m.plannedAt) return 'planned';
  return 'empty';
}

// ─── Inline milestone editor ──────────────────────────────────────────────────

function MilestoneEditor({
  campaignId,
  type,
  data,
  onSave,
}: {
  campaignId: string;
  type: MilestoneType;
  data: MilestoneData;
  onSave: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [plannedAt, setPlannedAt] = useState(
    data.plannedAt ? data.plannedAt.slice(0, 10) : '',
  );
  const [completedAt, setCompletedAt] = useState(
    data.completedAt ? data.completedAt.slice(0, 10) : '',
  );
  const [note, setNote] = useState(data.note ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/campaigns/${campaignId}/milestones`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        plannedAt: plannedAt || null,
        completedAt: completedAt || null,
        note: note || null,
      }),
    });
    setSaving(false);
    setEditing(false);
    onSave();
  }

  if (!editing) {
    const state = milestoneNodeState(data);
    return (
      <button
        onClick={() => setEditing(true)}
        className={cn(
          'group flex flex-col items-center gap-1 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors min-w-[80px]',
        )}
      >
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors',
          state === 'done'    && 'bg-green-500 border-green-500 text-white',
          state === 'late'    && 'bg-orange-400 border-orange-400 text-white',
          state === 'planned' && 'bg-white border-indigo-400 text-indigo-600',
          state === 'empty'   && 'bg-white border-gray-300 text-gray-400',
        )}>
          {state === 'done' || state === 'late'
            ? <CheckCircle2 className="w-4 h-4" />
            : <Clock className="w-4 h-4" />
          }
        </div>
        <span className="text-[10px] font-medium text-gray-600 text-center leading-tight">
          {MILESTONE_LABELS[type]}
        </span>
        <span className="text-[9px] text-gray-400">
          {state === 'done' || state === 'late'
            ? fmtDate(data.completedAt)
            : fmtDate(data.plannedAt)
          }
        </span>
        <Pencil className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors" />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 p-2 bg-white rounded-lg border border-indigo-200 shadow-sm min-w-[140px] z-10">
      <p className="text-[10px] font-bold text-gray-700">{MILESTONE_LABELS[type]}</p>
      <label className="text-[9px] text-gray-500 font-medium">Planned</label>
      <input
        type="date"
        value={plannedAt}
        onChange={(e) => setPlannedAt(e.target.value)}
        className="text-xs border border-gray-200 rounded px-1.5 py-1"
      />
      <label className="text-[9px] text-gray-500 font-medium">Completed</label>
      <input
        type="date"
        value={completedAt}
        onChange={(e) => setCompletedAt(e.target.value)}
        className="text-xs border border-gray-200 rounded px-1.5 py-1"
      />
      <label className="text-[9px] text-gray-500 font-medium">Note (if late)</label>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. graphics delayed"
        className="text-xs border border-gray-200 rounded px-1.5 py-1"
      />
      <div className="flex gap-1 mt-0.5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-1 text-[10px] bg-indigo-600 text-white rounded px-2 py-1 hover:bg-indigo-700 disabled:opacity-50"
        >
          <Check className="w-3 h-3" />Save
        </button>
        <button
          onClick={() => setEditing(false)}
          className="flex items-center justify-center text-[10px] border border-gray-200 rounded px-2 py-1 hover:bg-gray-50"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Campaign row with timeline ───────────────────────────────────────────────

function CampaignRow({ campaign, onRefresh }: { campaign: Campaign; onRefresh: () => void }) {
  const isDone = campaign.status === 'DONE';
  return (
    <div className={cn(
      'bg-white rounded-xl border shadow-sm p-4',
      isDone ? 'border-gray-200 opacity-75' : 'border-gray-200',
    )}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{campaign.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-bold',
              STATUS_COLORS[campaign.status] ?? 'bg-gray-100 text-gray-600',
            )}>
              {STATUS_LABELS[campaign.status] ?? campaign.status}
            </span>
            {campaign.owner && (
              <span className="text-[11px] text-gray-400">
                {campaign.owner.name ?? campaign.owner.email}
              </span>
            )}
            {campaign.dueAt && (
              <span className="text-[11px] text-gray-400">
                Due {fmtDate(campaign.dueAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-0.5 overflow-x-auto py-1">
        {/* Start node */}
        <div className="flex flex-col items-center gap-1 min-w-[60px]">
          <div className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center border-2',
            campaign.startedAt
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'bg-white border-gray-300 text-gray-400',
          )}>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <span className="text-[9px] text-gray-500 text-center">Start</span>
          <span className="text-[9px] text-gray-400">{fmtDate(campaign.startedAt)}</span>
        </div>

        {/* Connectors + milestone nodes */}
        {MILESTONE_TYPES.map((type) => (
          <div key={type} className="flex items-center">
            <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />
            <MilestoneEditor
              campaignId={campaign.id}
              type={type}
              data={campaign.milestones[type]}
              onSave={onRefresh}
            />
          </div>
        ))}

        {/* Done node */}
        <div className="flex items-center">
          <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />
          <div className="flex flex-col items-center gap-1 min-w-[60px]">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center border-2',
              campaign.completedAt
                ? 'bg-green-500 border-green-500 text-white'
                : 'bg-white border-gray-300 text-gray-400',
            )}>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-[9px] text-gray-500 text-center">Done</span>
            <span className="text-[9px] text-gray-400">{fmtDate(campaign.completedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const {
    data: campaigns,
    isLoading: campaignsLoading,
    refetch: refetchCampaigns,
  } = useFetch<Campaign[]>('/api/campaigns');

  const {
    data: perf,
    isLoading: perfLoading,
    refetch: refetchPerf,
  } = useFetch<PerformanceData>('/api/metrics/campaign-performance');

  const [tab, setTab] = useState<'timeline' | 'analytics'>('timeline');

  function handleRefresh() {
    refetchCampaigns();
    refetchPerf();
  }

  const isLoading = campaignsLoading || perfLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const campaignList = campaigns ?? [];
  const perfData = perf ?? {
    summary: { total: 0, completed: 0, fullyOnTime: 0 },
    byMilestone: [],
    delayReasons: [],
  };

  const active = campaignList.filter((c) => c.status !== 'DONE');
  const done = campaignList.filter((c) => c.status === 'DONE');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">
            Book campaign timelines and milestone tracking
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('timeline')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg font-medium transition-colors',
              tab === 'timeline'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            Timeline
          </button>
          <button
            onClick={() => setTab('analytics')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg font-medium transition-colors',
              tab === 'analytics'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* ── Timeline tab ── */}
      {tab === 'timeline' && (
        <div className="space-y-4">
          {active.length === 0 && done.length === 0 && (
            <div className="py-16 text-center text-sm text-gray-400">
              No campaigns found. Create a work item with type BOOK_CAMPAIGN to get started.
            </div>
          )}
          {active.map((c) => (
            <CampaignRow key={c.id} campaign={c} onRefresh={handleRefresh} />
          ))}
          {done.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none text-sm text-gray-500 font-medium flex items-center gap-1 select-none">
                <span className="group-open:hidden">▶</span>
                <span className="hidden group-open:inline">▼</span>
                {done.length} completed campaign{done.length !== 1 ? 's' : ''}
              </summary>
              <div className="mt-3 space-y-3">
                {done.map((c) => (
                  <CampaignRow key={c.id} campaign={c} onRefresh={handleRefresh} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* ── Analytics tab ── */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          {/* Summary stat cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 font-medium">Total Campaigns</p>
              <p className="text-3xl font-bold text-gray-900 leading-tight">{perfData.summary.total}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 font-medium">Completed</p>
              <p className="text-3xl font-bold text-green-700 leading-tight">{perfData.summary.completed}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 font-medium">Fully On-time</p>
              <p className="text-3xl font-bold text-indigo-700 leading-tight">{perfData.summary.fullyOnTime}</p>
              <p className="text-xs text-gray-400 mt-0.5">no late milestones</p>
            </div>
          </div>

          {/* Per-milestone on-time % bar chart */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">On-time % by Milestone</h2>
            <p className="text-xs text-gray-400 mb-4">completed before or on planned date</p>
            {perfData.byMilestone.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No milestone data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={perfData.byMilestone}
                  layout="vertical"
                  margin={{ left: 100, right: 40, top: 0, bottom: 0 }}
                >
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    width={95}
                  />
                  <Tooltip formatter={(v) => [`${v}%`, 'On-time']} />
                  <Bar dataKey="onTimePct" radius={[0, 4, 4, 0]}>
                    {perfData.byMilestone.map((_entry, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                    <LabelList dataKey="onTimePct" position="right" formatter={(v: any) => v != null ? `${v}%` : '—'} style={{ fontSize: 11, fill: '#6b7280' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Avg delay per milestone */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Avg Delay per Milestone</h2>
              <p className="text-xs text-gray-400 mt-0.5">positive = late, negative = early</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Milestone</th>
                  <th className="text-right px-4 py-2.5 font-medium">Planned</th>
                  <th className="text-right px-4 py-2.5 font-medium">Completed</th>
                  <th className="text-right px-4 py-2.5 font-medium">On-time</th>
                  <th className="text-right px-4 py-2.5 font-medium">Avg Delay</th>
                </tr>
              </thead>
              <tbody>
                {perfData.byMilestone.map((m) => (
                  <tr key={m.type} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{m.label}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{m.totalPlanned}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{m.totalCompleted}</td>
                    <td className="px-4 py-3 text-right">
                      {m.onTimePct != null ? (
                        <span className={cn(
                          'font-semibold',
                          m.onTimePct >= 80 ? 'text-green-600' :
                          m.onTimePct >= 50 ? 'text-yellow-600' : 'text-red-600',
                        )}>
                          {m.onTimePct}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {m.avgDelayDays != null ? (
                        <span className={cn(
                          'font-semibold',
                          m.avgDelayDays <= 0 ? 'text-green-600' :
                          m.avgDelayDays <= 3 ? 'text-yellow-600' : 'text-red-600',
                        )}>
                          {m.avgDelayDays > 0 ? '+' : ''}{m.avgDelayDays}d
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top delay reasons */}
          {perfData.delayReasons.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <h2 className="text-sm font-semibold text-gray-900">Common Delay Reasons</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {perfData.delayReasons.map((r, i) => (
                  <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-700">{r.note}</span>
                    <span className="text-xs font-bold text-orange-600 shrink-0">
                      {r.count}×
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
