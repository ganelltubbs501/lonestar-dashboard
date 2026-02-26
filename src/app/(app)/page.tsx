'use client';

import { useFetch } from '@/lib/hooks';
import { formatDate, cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  AlertTriangle, Clock, CheckSquare, Loader2, BookOpen,
  Calendar, RefreshCw, Users, ChevronRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { WorkItemPriority } from '@prisma/client';

interface SpineItem {
  id: string;
  kind: 'deadline' | 'workItem';
  title: string;
  deliverableType: string;
  dueAt: string;
  status: string;
  isRecurring?: boolean;
  priority?: WorkItemPriority;
  ownerName?: string | null;
}

interface Stats {
  totalItems: number;
  activeItems: number;
  overdueItems: number;
  blockedItems: number;
  waitingItems: number;
  dueSoonItems: number;
  doneThisWeek: number;
  serUnassigned: number;
  serDueSoon: number;
  eventsUploadThisWeek: { id: string; title: string; dueAt: string; status: string } | null;
  spine14Days: SpineItem[];
  workloadByOwner: { name: string; count: number }[];
}

const DELIVERABLE_COLORS: Record<string, string> = {
  NEWSLETTER:                 'bg-blue-100 text-blue-700',
  MAGAZINE:                   'bg-purple-100 text-purple-700',
  EVENTS:                     'bg-cyan-100 text-cyan-700',
  SER:                        'bg-orange-100 text-orange-700',
  TBP:                        'bg-pink-100 text-pink-700',
  CAMPAIGN:                   'bg-green-100 text-green-700',
  BOOK_CAMPAIGN:              'bg-green-100 text-green-700',
  SOCIAL_ASSET_REQUEST:       'bg-yellow-100 text-yellow-800',
  SPONSORED_EDITORIAL_REVIEW: 'bg-orange-100 text-orange-700',
  TX_BOOK_PREVIEW_LEAD:       'bg-pink-100 text-pink-700',
  WEBSITE_EVENT:              'bg-cyan-100 text-cyan-700',
  ACCESS_REQUEST:             'bg-gray-100 text-gray-700',
  GENERAL:                    'bg-indigo-100 text-indigo-700',
};

const DELIVERABLE_LABEL: Record<string, string> = {
  NEWSLETTER: 'Newsletter', MAGAZINE: 'Magazine', EVENTS: 'Events',
  SER: 'SER', TBP: 'TBP', CAMPAIGN: 'Campaign',
  BOOK_CAMPAIGN: 'Book Campaign', SOCIAL_ASSET_REQUEST: 'Social Asset',
  SPONSORED_EDITORIAL_REVIEW: 'Editorial Review', TX_BOOK_PREVIEW_LEAD: 'TBP Lead',
  WEBSITE_EVENT: 'Event', ACCESS_REQUEST: 'Access', GENERAL: 'General',
};

const DEADLINE_STATUS_DOT: Record<string, string> = {
  UPCOMING:     'text-gray-300',
  IN_PROGRESS:  'text-blue-500',
  NEEDS_REVIEW: 'text-yellow-500',
  COMPLETED:    'text-green-500',
  MISSED:       'text-red-500',
};

function isOverdueFn(dueAt: string) {
  return new Date(dueAt) < new Date();
}

interface TileProps {
  label: string;
  value: number | string;
  sub?: string;
  valueColor: string;
  bgColor: string;
  icon: React.ReactNode;
  href?: string;
  pulse?: boolean;
}

function Tile({ label, value, sub, valueColor, bgColor, icon, href, pulse }: TileProps) {
  const router = useRouter();
  const clickable = !!href;
  return (
    <div
      className={cn(
        'card p-4 flex items-center justify-between',
        clickable && 'cursor-pointer hover:ring-2 hover:ring-indigo-300 transition'
      )}
      onClick={href ? () => router.push(href) : undefined}
    >
      <div>
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{label}</p>
        <p className={cn('text-3xl font-bold mt-0.5', valueColor, pulse && Number(value) > 0 && 'text-red-600')}>
          {value}
        </p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className={cn('p-3 rounded-lg flex items-center gap-1', bgColor)}>
        {icon}
        {clickable && <ChevronRight className="w-3 h-3 opacity-50" />}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useFetch<Stats>('/api/stats', {
    pollInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-center text-red-600 py-8">
        Failed to load dashboard data. Please try again.
      </div>
    );
  }

  const eventsStatus = stats.eventsUploadThisWeek?.status ?? null;
  const eventsLabel =
    eventsStatus === 'COMPLETED'    ? 'Done ✓'
    : eventsStatus === 'IN_PROGRESS' ? 'In progress'
    : eventsStatus                   ? 'Pending'
    : 'Not set';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-400 text-sm">What's on fire right now</p>
      </div>

      {/* Alert row — the "on fire" tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Tile
          label="Overdue"
          value={stats.overdueItems}
          valueColor="text-red-600"
          bgColor="bg-red-50"
          icon={<Clock className="w-5 h-5 text-red-500" />}
          href="/board?overdue=1"
          pulse
        />
        <Tile
          label="Due Next 7d"
          value={stats.dueSoonItems}
          valueColor="text-orange-500"
          bgColor="bg-orange-50"
          icon={<Calendar className="w-5 h-5 text-orange-500" />}
          href="/board?due7=1"
        />
        <Tile
          label="Blocked"
          value={stats.blockedItems}
          valueColor="text-yellow-600"
          bgColor="bg-yellow-50"
          icon={<AlertTriangle className="w-5 h-5 text-yellow-500" />}
          href="/board?blocked=1"
          pulse
        />
        <Tile
          label="Waiting On"
          value={stats.waitingItems}
          valueColor="text-purple-600"
          bgColor="bg-purple-50"
          icon={<Users className="w-5 h-5 text-purple-500" />}
          href="/board?waiting=1"
        />
        <Tile
          label="SER Queue"
          value={stats.serUnassigned + stats.serDueSoon}
          sub={`${stats.serUnassigned} unassigned · ${stats.serDueSoon} due soon`}
          valueColor="text-indigo-600"
          bgColor="bg-indigo-50"
          icon={<BookOpen className="w-5 h-5 text-indigo-500" />}
          href="/board?type=SPONSORED_EDITORIAL_REVIEW"
          pulse={stats.serUnassigned > 0}
        />
        <Tile
          label="Events Upload"
          value={eventsLabel}
          valueColor={eventsStatus === 'COMPLETED' ? 'text-green-600' : eventsStatus ? 'text-cyan-600' : 'text-gray-400'}
          bgColor="bg-cyan-50"
          icon={<RefreshCw className="w-5 h-5 text-cyan-500" />}
          href="/board?type=WEBSITE_EVENT"
        />
      </div>

      {/* Scoreboard row */}
      <div className="grid grid-cols-3 gap-3">
        <Tile
          label="Active Items"
          value={stats.activeItems}
          valueColor="text-indigo-600"
          bgColor="bg-indigo-50"
          icon={<CheckSquare className="w-5 h-5 text-indigo-500" />}
          href="/board"
        />
        <Tile
          label="Done This Week"
          value={stats.doneThisWeek}
          valueColor="text-green-600"
          bgColor="bg-green-50"
          icon={<CheckSquare className="w-5 h-5 text-green-500" />}
        />
        <Tile
          label="Total Items"
          value={stats.totalItems}
          valueColor="text-gray-700"
          bgColor="bg-gray-50"
          icon={<CheckSquare className="w-5 h-5 text-gray-400" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* 14-day spine */}
        <div className="lg:col-span-3 card p-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            Next 14 Days
          </h3>
          {stats.spine14Days.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No upcoming items.</p>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
              {stats.spine14Days.map((item) => {
                const typeColor = DELIVERABLE_COLORS[item.deliverableType] ?? 'bg-gray-100 text-gray-700';
                const typeLabel = DELIVERABLE_LABEL[item.deliverableType] ?? item.deliverableType;
                const overdue = isOverdueFn(item.dueAt);
                return (
                  <div
                    key={`${item.kind}-${item.id}`}
                    className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0"
                  >
                    <span className={cn('text-xs px-1.5 py-0.5 rounded font-semibold shrink-0 min-w-[56px] text-center', typeColor)}>
                      {typeLabel}
                    </span>
                    <span className="text-sm text-gray-800 flex-1 truncate min-w-0" title={item.title}>
                      {item.title}
                    </span>
                    {item.ownerName && (
                      <span className="text-xs text-gray-400 shrink-0 hidden sm:block">{item.ownerName}</span>
                    )}
                    <span className={cn('text-xs font-mono shrink-0', overdue ? 'text-red-500 font-bold' : 'text-gray-400')}>
                      {formatDate(item.dueAt)}
                    </span>
                    {item.kind === 'deadline' && (
                      <span className={cn('text-xs shrink-0', DEADLINE_STATUS_DOT[item.status] ?? 'text-gray-300')}>
                        ●
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Workload chart */}
        <div className="lg:col-span-2 card p-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            Workload by Owner
          </h3>
          <div className="h-[280px]">
            {stats.workloadByOwner.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.workloadByOwner} layout="vertical">
                  <XAxis type="number" stroke="#aaa" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#aaa"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={72}
                  />
                  <Tooltip
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {stats.workloadByOwner.map((_, i) => (
                      <Cell key={i} fill={i % 2 === 0 ? '#4f46e5' : '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No active work items
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
