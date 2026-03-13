'use client';

import { Briefcase, RefreshCw, ArrowRight } from 'lucide-react';
import { useFetch } from '@/lib/hooks';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExecData {
  generatedAt: string;
  workItems: { active: number; overdue: number; blocked: number; dueSoon: number };
  ser: { active: number; unassigned: number; overdue: number; avgReviewDays: number | null };
  campaigns: { active: number; onTimePct: number | null; avgDelayDays: number | null; graphicsLatePct: number | null };
  events: { intake: number; compilation: number; readyToUpload: number; uploaded: number; nextBatchDate: string | null };
  velocity: Array<{ weekLabel: string; total: number }>;
}

// ── RAG helpers ───────────────────────────────────────────────────────────────

type Rag = 'green' | 'yellow' | 'red' | 'neutral';

const ragCls: Record<Rag, string> = {
  green:   'text-green-700 bg-green-50 border-green-200',
  yellow:  'text-yellow-700 bg-yellow-50 border-yellow-200',
  red:     'text-red-700 bg-red-50 border-red-200',
  neutral: 'text-gray-700 bg-gray-50 border-gray-200',
};

const ragDot: Record<Rag, string> = {
  green:   'bg-green-500',
  yellow:  'bg-yellow-400',
  red:     'bg-red-500',
  neutral: 'bg-gray-300',
};

function dot(rag: Rag) {
  return <span className={cn('inline-block w-2 h-2 rounded-full mr-1.5', ragDot[rag])} />;
}

function overdueBand(n: number): Rag { return n === 0 ? 'green' : n < 5 ? 'yellow' : 'red'; }
function blockedBand(n: number): Rag { return n === 0 ? 'green' : n < 3 ? 'yellow' : 'red'; }
function pctBand(pct: number | null, good = 80, warn = 60): Rag {
  if (pct == null) return 'neutral';
  return pct >= good ? 'green' : pct >= warn ? 'yellow' : 'red';
}
function intakeBand(n: number): Rag { return n < 5 ? 'green' : n < 10 ? 'yellow' : 'red'; }

// ── Big stat card ─────────────────────────────────────────────────────────────

function StatCard({ label, value, rag, sub }: {
  label: string; value: string | number; rag: Rag; sub?: string;
}) {
  return (
    <div className={cn('rounded-xl border p-5', ragCls[rag])}>
      <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">{label}</p>
      <p className="text-4xl font-bold">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Metric({ label, value, rag }: { label: string; value: string | number; rag: Rag }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={cn('text-sm font-semibold flex items-center', rag !== 'neutral' && ragCls[rag].split(' ')[0])}>
        {rag !== 'neutral' && dot(rag)}
        {value}
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExecutivePage() {
  const { data, isLoading, refetch } = useFetch<ExecData>('/api/metrics/executive');

  const generatedAt = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : null;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-indigo-600" /> Executive Overview
          </h1>
          {generatedAt && (
            <p className="text-xs text-gray-400 mt-0.5">Last updated {generatedAt}</p>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {isLoading && !data && (
        <div className="card p-10 text-center text-sm text-gray-400">Loading…</div>
      )}

      {data && (
        <>
          {/* ── Top-line numbers ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Active Items"
              value={data.workItems.active}
              rag="neutral"
              sub="non-DONE work items"
            />
            <StatCard
              label="Overdue"
              value={data.workItems.overdue}
              rag={overdueBand(data.workItems.overdue)}
              sub={data.workItems.dueSoon > 0 ? `+${data.workItems.dueSoon} due this week` : 'none due this week'}
            />
            <StatCard
              label="Blocked"
              value={data.workItems.blocked}
              rag={blockedBand(data.workItems.blocked)}
              sub="status = BLOCKED"
            />
            <StatCard
              label="Due This Week"
              value={data.workItems.dueSoon}
              rag={data.workItems.dueSoon > 5 ? 'yellow' : 'neutral'}
              sub="next 7 days"
            />
          </div>

          {/* ── Detail cards ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            {/* SPED Health */}
            <SectionCard title="SPED Health">
              <Metric label="Active SPEDs" value={data.ser.active} rag="neutral" />
              <Metric
                label="Unassigned"
                value={data.ser.unassigned}
                rag={data.ser.unassigned === 0 ? 'green' : data.ser.unassigned === 1 ? 'yellow' : 'red'}
              />
              <Metric
                label="Overdue"
                value={data.ser.overdue}
                rag={overdueBand(data.ser.overdue)}
              />
              <Metric
                label="Avg review time"
                value={data.ser.avgReviewDays != null ? `${data.ser.avgReviewDays}d` : '—'}
                rag="neutral"
              />
            </SectionCard>

            {/* Events Pipeline */}
            <SectionCard title="Events Pipeline">
              {/* Flow visualization */}
              <div className="flex items-center gap-1 text-sm mb-4 flex-wrap">
                {[
                  { label: 'Intake', value: data.events.intake, rag: intakeBand(data.events.intake) },
                  { label: 'Compiling', value: data.events.compilation, rag: 'neutral' as Rag },
                  { label: 'Ready', value: data.events.readyToUpload, rag: 'neutral' as Rag },
                ].map((stage, i) => (
                  <span key={stage.label} className="flex items-center gap-1">
                    <span className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-semibold border',
                      ragCls[stage.rag]
                    )}>
                      {stage.label}: {stage.value}
                    </span>
                    {i < 2 && <ArrowRight className="w-3 h-3 text-gray-300" />}
                  </span>
                ))}
              </div>
              <Metric label="Uploaded" value={data.events.uploaded} rag="neutral" />
              {data.events.nextBatchDate && (
                <Metric
                  label="Next batch date"
                  value={new Date(data.events.nextBatchDate + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  rag="neutral"
                />
              )}
            </SectionCard>

            {/* Campaign Health */}
            <SectionCard title="Campaign Health">
              <Metric label="Active campaigns" value={data.campaigns.active} rag="neutral" />
              <Metric
                label="Milestones on-time"
                value={data.campaigns.onTimePct != null ? `${data.campaigns.onTimePct}%` : '—'}
                rag={pctBand(data.campaigns.onTimePct)}
              />
              <Metric
                label="Graphics on-time"
                value={data.campaigns.graphicsLatePct != null
                  ? `${100 - data.campaigns.graphicsLatePct}%`
                  : '—'}
                rag={pctBand(
                  data.campaigns.graphicsLatePct != null ? 100 - data.campaigns.graphicsLatePct : null,
                  80, 60
                )}
              />
              <Metric
                label="Avg delay when late"
                value={data.campaigns.avgDelayDays != null ? `${data.campaigns.avgDelayDays}d` : '—'}
                rag="neutral"
              />
            </SectionCard>

            {/* Velocity */}
            <SectionCard title="Velocity — Last 4 Weeks">
              {data.velocity.length === 0 ? (
                <p className="text-sm text-gray-400">No completed items in the last 4 weeks.</p>
              ) : (() => {
                const max = Math.max(...data.velocity.map(v => v.total), 1);
                return (
                  <div className="space-y-3">
                    {data.velocity.map(w => (
                      <div key={w.weekLabel} className="flex items-center gap-3">
                        <span className="w-14 shrink-0 text-xs text-gray-500 text-right">{w.weekLabel}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-indigo-500 h-2 rounded-full transition-all"
                            style={{ width: `${Math.round((w.total / max) * 100)}%` }}
                          />
                        </div>
                        <span className="w-6 shrink-0 text-right text-sm font-semibold text-gray-700">
                          {w.total}
                        </span>
                      </div>
                    ))}
                    <p className="text-xs text-gray-400 pt-1">
                      Items moved to DONE · current week excluded
                    </p>
                  </div>
                );
              })()}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
