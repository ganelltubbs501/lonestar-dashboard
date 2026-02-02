'use client';

import { useFetch } from '@/lib/hooks';
import { WorkItemTypeLabel, formatDate, PriorityColors, cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, AlertTriangle, CheckSquare, Clock, Loader2 } from 'lucide-react';
import { WorkItemPriority, WorkItemType } from '@prisma/client';

interface Stats {
  totalItems: number;
  activeItems: number;
  overdueItems: number;
  blockedItems: number;
  doneThisWeek: number;
  workloadByOwner: { name: string; count: number }[];
  workloadByType: { type: WorkItemType; count: number }[];
  upcomingItems: {
    id: string;
    title: string;
    type: WorkItemType;
    priority: WorkItemPriority;
    dueAt: string;
    owner: { name: string } | null;
  }[];
}

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useFetch<Stats>('/api/stats', {
    pollInterval: 30000, // Refresh every 30 seconds
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

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Overview of operational health</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Active Items</p>
            <p className="text-3xl font-bold text-indigo-600">{stats.activeItems}</p>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg">
            <CheckSquare className="w-6 h-6 text-indigo-600" />
          </div>
        </div>
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Overdue</p>
            <p className="text-3xl font-bold text-red-600">{stats.overdueItems}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-lg">
            <Clock className="w-6 h-6 text-red-600" />
          </div>
        </div>
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Blocked</p>
            <p className="text-3xl font-bold text-orange-600">{stats.blockedItems}</p>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
          </div>
        </div>
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Completed (7d)</p>
            <p className="text-3xl font-bold text-green-600">{stats.doneThisWeek}</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <Users className="w-6 h-6 text-green-600" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workload Chart */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Workload by Owner</h3>
          <div className="h-64">
            {stats.workloadByOwner.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.workloadByOwner}>
                  <XAxis
                    dataKey="name"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]}>
                    {stats.workloadByOwner.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#4f46e5' : '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No active work items
              </div>
            )}
          </div>
        </div>

        {/* Due Soon */}
        <div className="card p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Due Next 7 Days</h3>
          <div className="space-y-4">
            {stats.upcomingItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col pb-3 border-b border-gray-100 last:border-0 last:pb-0"
              >
                <span className="text-xs font-semibold text-blue-600 uppercase mb-1">
                  {WorkItemTypeLabel[item.type]}
                </span>
                <span className="text-sm font-medium text-gray-800 truncate">{item.title}</span>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-gray-500">Due: {formatDate(item.dueAt)}</span>
                  {item.priority === 'URGENT' && (
                    <span
                      className={cn(
                        'badge',
                        PriorityColors.URGENT.bg,
                        PriorityColors.URGENT.text
                      )}
                    >
                      Urgent
                    </span>
                  )}
                </div>
              </div>
            ))}
            {stats.upcomingItems.length === 0 && (
              <p className="text-sm text-gray-500 italic">No upcoming deadlines.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
