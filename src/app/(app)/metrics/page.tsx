'use client';

import { useFetch } from '@/lib/hooks';
import { WorkItemTypeLabel, cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { TrendingUp, Clock, AlertTriangle, Users, Loader2 } from 'lucide-react';
import { WorkItemType } from '@prisma/client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface VelocityWeek {
  week: string;
  label: string;
  total: number;
  byType: Record<string, number>;
}
interface VelocityData {
  weeks: VelocityWeek[];
  totalCompleted: number;
}

interface CycleTypeRow {
  type: string;
  label: string;
  avgDays: number;
  medianDays: number;
  count: number;
}
interface BottleneckItem {
  id: string;
  title: string;
  type: WorkItemType;
  daysStuck: number;
  owner: { name: string | null } | null;
}
interface CycleData {
  overall: { avgDays: number | null; count: number };
  byType: CycleTypeRow[];
  bottlenecks: { blocked: BottleneckItem[]; needsQa: BottleneckItem[] };
}

interface OwnerRow {
  id: string;
  name: string | null;
  email: string;
  active: number;
  onTime: number;
  dueThisWeek: number;
  overdue: number;
}
interface OwnerData {
  owners: OwnerRow[];
}

// ─── Color map (matches board TYPE_BADGE_COLORS hues) ────────────────────────

const TYPE_FILL: Record<string, string> = {
  BOOK_CAMPAIGN:             '#9333ea',
  SOCIAL_ASSET_REQUEST:      '#ec4899',
  SPONSORED_EDITORIAL_REVIEW:'#ca8a04',
  TX_BOOK_PREVIEW_LEAD:      '#3b82f6',
  WEBSITE_EVENT:             '#0d9488',
  ACCESS_REQUEST:            '#f97316',
  GENERAL:                   '#6b7280',
};

// ─── Small shared components ──────────────────────────────────────────────────

function Section({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-start gap-3">
      <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-40 text-sm text-gray-400 text-center px-6">
      {message}
    </div>
  );
}

function BottleneckTable({ items, status }: { items: BottleneckItem[]; status: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-100">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Title</th>
            <th className="text-left px-3 py-2 font-medium">Type</th>
            <th className="text-left px-3 py-2 font-medium">Owner</th>
            <th className="text-right px-3 py-2 font-medium">Days in {status}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-2 font-medium text-gray-800 max-w-[280px] truncate">
                {item.title}
              </td>
              <td className="px-3 py-2 text-gray-500 text-xs">
                {(WorkItemTypeLabel as Record<string, string>)[item.type] ?? item.type}
              </td>
              <td className="px-3 py-2 text-gray-500">{item.owner?.name ?? '—'}</td>
              <td className="px-3 py-2 text-right">
                <span className={cn(
                  'font-semibold',
                  item.daysStuck >= 7 ? 'text-red-600' : item.daysStuck >= 3 ? 'text-orange-500' : 'text-yellow-600'
                )}>
                  {item.daysStuck}d
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MetricsPage() {
  const { data: velocity, isLoading: vl } = useFetch<VelocityData>('/api/metrics/velocity');
  const { data: cycle,    isLoading: cl } = useFetch<CycleData>('/api/metrics/cycle-time');
  const { data: load,     isLoading: ol } = useFetch<OwnerData>('/api/metrics/owner-load');

  if (vl || cl || ol) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const totalBottlenecks =
    (cycle?.bottlenecks.blocked.length ?? 0) +
    (cycle?.bottlenecks.needsQa.length ?? 0);

  const avgDaysLabel =
    cycle?.overall.avgDays != null ? `${cycle.overall.avgDays}d` : '—';

  // Build owner chart data — each bar stack = onTime + dueThisWeek + overdue
  const ownerChartData = (load?.owners ?? []).map((o) => ({
    name: (o.name ?? o.email).split('@')[0],
    'On Time': o.onTime,
    'Due This Week': o.dueThisWeek,
    Overdue: o.overdue,
  }));

  const ownerChartHeight = Math.max(200, (load?.owners.length ?? 0) * 52);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Performance Metrics</h1>
        <p className="text-sm text-gray-500 mt-1">Throughput, cycle time, and team workload</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-indigo-600" />}
          label="Completed (5 wks)"
          value={velocity?.totalCompleted ?? 0}
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-blue-600" />}
          label="Avg Cycle Time"
          value={avgDaysLabel}
          sub={cycle?.overall.count ? `across ${cycle.overall.count} items` : undefined}
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5 text-orange-600" />}
          label="Bottlenecks"
          value={totalBottlenecks}
          sub={totalBottlenecks > 0 ? 'stuck > 3 days' : 'none right now'}
        />
        <StatCard
          icon={<Users className="w-5 h-5 text-green-600" />}
          label="Active Owners"
          value={load?.owners.length ?? 0}
          sub="with open items"
        />
      </div>

      {/* Velocity trend */}
      <Section
        title="Velocity — Last 5 Weeks"
        subtitle="Items moved to DONE per week"
      >
        {velocity?.weeks && velocity.weeks.some((w) => w.total > 0) ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={velocity.weeks} margin={{ top: 4, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={{ r: 5, fill: '#6366f1' }}
                activeDot={{ r: 7 }}
                name="Completed"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="No completed items yet. Velocity data will appear here once work items reach DONE." />
        )}
      </Section>

      {/* Cycle time by type */}
      <Section
        title="Avg Cycle Time by Type"
        subtitle="Days from created → done (all-time)"
      >
        {cycle?.byType && cycle.byType.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(180, cycle.byType.length * 44)}>
            <BarChart
              data={cycle.byType}
              layout="vertical"
              margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} unit="d" />
              <YAxis
                type="category"
                dataKey="label"
                width={148}
                tick={{ fontSize: 11, fill: '#6b7280' }}
              />
              <Tooltip
                formatter={(v: number) => [`${v}d`, 'Avg cycle time']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="avgDays" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, fill: '#6b7280', formatter: (v: number) => `${v}d` }}>
                {cycle.byType.map((row) => (
                  <Cell key={row.type} fill={TYPE_FILL[row.type] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="No completed items yet. Cycle time data will appear once work items reach DONE." />
        )}
      </Section>

      {/* Owner workload */}
      <Section
        title="Owner Workload"
        subtitle="Active items per team member — stacked by urgency"
      >
        {ownerChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={ownerChartHeight}>
            <BarChart
              data={ownerChartData}
              layout="vertical"
              margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tick={{ fontSize: 11, fill: '#6b7280' }}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="On Time"      stackId="a" fill="#6366f1" />
              <Bar dataKey="Due This Week" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Overdue"       stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="No assigned open work items found." />
        )}
      </Section>

      {/* Bottleneck detail */}
      {totalBottlenecks > 0 && (
        <Section
          title="Bottlenecks"
          subtitle="Items stuck in BLOCKED or NEEDS QA for more than 3 days"
        >
          <div className="space-y-4">
            {cycle!.bottlenecks.blocked.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-orange-700 mb-2">
                  BLOCKED ({cycle!.bottlenecks.blocked.length})
                </p>
                <BottleneckTable items={cycle!.bottlenecks.blocked} status="BLOCKED" />
              </div>
            )}
            {cycle!.bottlenecks.needsQa.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-yellow-700 mb-2">
                  NEEDS QA ({cycle!.bottlenecks.needsQa.length})
                </p>
                <BottleneckTable items={cycle!.bottlenecks.needsQa} status="NEEDS QA" />
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
