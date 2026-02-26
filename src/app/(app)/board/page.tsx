'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useFetch, api } from '@/lib/hooks';
import { WorkItemTypeLabel, StatusLabel, formatDate, cn, isOverdue, parseTags } from '@/lib/utils';
import { Calendar, Loader2, ClipboardCheck, AlertTriangle, Filter, X, User } from 'lucide-react';
import { WorkItemStatus, WorkItemPriority, WorkItemType } from '@prisma/client';
import { WorkItemModal } from '@/components/WorkItemModal';
import { TBP_MAGAZINE_TYPES } from '@/lib/validations';

interface WorkItem {
  id: string;
  type: WorkItemType;
  title: string;
  description: string;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  dueAt: string | null;
  blockedReason: string | null;
  tags: string[];
  needsProofing: boolean;
  requester: { id: string; name: string | null; email: string; image: string | null };
  owner: { id: string; name: string | null; email: string; image: string | null } | null;
  _count: { subtasks: number; comments: number };
}

const POLL_INTERVAL = 15000; // 15 seconds

const PriorityLabel: Record<WorkItemPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

const TYPE_BADGE_COLORS: Record<WorkItemType, string> = {
  BOOK_CAMPAIGN:             'bg-purple-100 text-purple-700',
  SOCIAL_ASSET_REQUEST:      'bg-pink-100 text-pink-700',
  SPONSORED_EDITORIAL_REVIEW:'bg-yellow-100 text-yellow-700',
  TX_BOOK_PREVIEW_LEAD:      'bg-blue-100 text-blue-700',
  WEBSITE_EVENT:             'bg-teal-100 text-teal-700',
  ACCESS_REQUEST:            'bg-orange-100 text-orange-700',
  GENERAL:                   'bg-gray-100 text-gray-600',
};

function dueCountdown(dueAt: string | null, status: WorkItemStatus): { text: string; cls: string } | null {
  if (!dueAt) return null;
  const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86400000);
  if (status === 'DONE') return { text: `${days >= 0 ? days + 'd left' : 'past'}`, cls: 'text-gray-400 line-through' };
  if (days < 0)  return { text: 'Overdue',      cls: 'text-red-600 font-bold' };
  if (days === 0) return { text: 'Due today',   cls: 'text-orange-600 font-semibold' };
  if (days <= 3)  return { text: `${days}d left`, cls: 'text-orange-500' };
  if (days <= 7)  return { text: `${days}d left`, cls: 'text-yellow-700' };
  return { text: `${days}d left`, cls: 'text-gray-500' };
}

export default function BoardPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  // Pre-populate filters from dashboard tile clicks
  const [filterSearch, setFilterSearch] = useState('');
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>(searchParams.get('type') ?? 'all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterDueRange, setFilterDueRange] = useState<string>(searchParams.get('due7') ? '7days' : 'all');
  const [filterOverdue, setFilterOverdue] = useState(searchParams.get('overdue') === '1');
  const [filterBlocked, setFilterBlocked] = useState(searchParams.get('blocked') === '1');
  const [filterWaiting, setFilterWaiting] = useState(searchParams.get('waiting') === '1');
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const {
    data: items,
    isLoading,
    refetch,
  } = useFetch<WorkItem[]>('/api/work-items', {
    pollInterval: POLL_INTERVAL,
  });

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItemId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent, status: WorkItemStatus) => {
      e.preventDefault();
      if (!draggedItemId) return;

      setDropError(null);
      try {
        await api.workItems.update(draggedItemId, { status });
        refetch();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update status';
        setDropError(message);
        // Auto-clear error after 5 seconds
        setTimeout(() => setDropError(null), 5000);
      }
      setDraggedItemId(null);
    },
    [draggedItemId, refetch]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const clearAllFilters = () => {
    setFilterSearch('');
    setFilterOwner('all');
    setFilterType('all');
    setFilterPriority('all');
    setFilterDueRange('all');
    setFilterOverdue(false);
    setFilterBlocked(false);
    setFilterWaiting(false);
  };

  const hasActiveFilters = filterSearch !== '' || filterOwner !== 'all' || filterType !== 'all' ||
    filterPriority !== 'all' || filterDueRange !== 'all' || filterOverdue || filterBlocked || filterWaiting;

  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => {
      // Text search
      if (filterSearch && !item.title.toLowerCase().includes(filterSearch.toLowerCase())) return false;
      // Owner filter
      if (filterOwner !== 'all') {
        if (filterOwner === 'me' && item.owner?.id !== session?.user?.id) return false;
        if (filterOwner === 'unassigned' && item.owner !== null) return false;
      }
      // Type filter
      if (filterType !== 'all' && item.type !== filterType) return false;
      // Priority filter
      if (filterPriority !== 'all' && item.priority !== filterPriority) return false;
      // Overdue filter
      if (filterOverdue && (!item.dueAt || !isOverdue(item.dueAt) || item.status === 'DONE')) return false;
      // Blocked filter
      if (filterBlocked && item.status !== 'BLOCKED') return false;
      // Waiting filter (items that have a waitingOnUserId — we show all statuses)
      // Since WorkItem in the board list doesn't include waitingOnUserId, fall back to BLOCKED as proxy
      if (filterWaiting && item.status !== 'BLOCKED') return false;
      // Due date range filter
      if (filterDueRange !== 'all' && item.dueAt) {
        const dueDate = new Date(item.dueAt);
        const now = new Date();
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (filterDueRange === '7days' && daysUntilDue > 7) return false;
        if (filterDueRange === '14days' && daysUntilDue > 14) return false;
        if (filterDueRange === '30days' && daysUntilDue > 30) return false;
        if (filterDueRange === 'thisWeek') {
          const endOfWeek = new Date(now);
          endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
          if (dueDate > endOfWeek) return false;
        }
      } else if (filterDueRange !== 'all' && !item.dueAt) {
        return false; // Exclude items without due date when filtering by date
      }
      return true;
    });
  }, [items, filterSearch, filterOwner, filterType, filterPriority, filterDueRange, filterOverdue, filterBlocked, filterWaiting, session?.user?.id]);

  const columns = Object.values(WorkItemStatus);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      {/* Drop Error Toast */}
      {dropError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Status Change Failed</p>
            <p className="text-sm text-red-700">{dropError}</p>
          </div>
          <button
            onClick={() => setDropError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <span className="sr-only">Dismiss</span>
            &times;
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="mb-4 space-y-3">
        <div className="flex gap-3 items-center flex-wrap">
          <input
            type="text"
            placeholder="Search title…"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="input max-w-[200px]"
          />
          <button
            onClick={() => setFilterOwner(filterOwner === 'me' ? 'all' : 'me')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition",
              filterOwner === 'me'
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
            )}
          >
            <User className="w-4 h-4" />
            My Items
          </button>
          <select
            className="select max-w-[160px]"
            value={filterOwner}
            onChange={(e) => setFilterOwner(e.target.value)}
          >
            <option value="all">All Owners</option>
            <option value="me">Assigned to Me</option>
            <option value="unassigned">Unassigned</option>
          </select>
          <select
            className="select max-w-[160px]"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Types</option>
            {Object.entries(WorkItemTypeLabel).map(([key, val]) => (
              <option key={key} value={key}>
                {val}
              </option>
            ))}
          </select>
          <select
            className="select max-w-[140px]"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="all">All Priorities</option>
            {Object.entries(PriorityLabel).map(([key, val]) => (
              <option key={key} value={key}>
                {val}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={cn(
              "flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border transition",
              showAdvancedFilters
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
            )}
          >
            <Filter className="w-4 h-4" />
            More Filters
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
            >
              <X className="w-4 h-4" />
              Clear All
            </button>
          )}

          <span className="text-sm text-gray-500 ml-auto">
            {filteredItems.length} items
          </span>
        </div>

        {/* Advanced Filters Row */}
        {showAdvancedFilters && (
          <div className="flex gap-3 items-center flex-wrap p-3 bg-gray-50 rounded-lg border border-gray-200">
            <select
              className="select max-w-[160px]"
              value={filterDueRange}
              onChange={(e) => setFilterDueRange(e.target.value)}
            >
              <option value="all">Any Due Date</option>
              <option value="thisWeek">Due This Week</option>
              <option value="7days">Due in 7 Days</option>
              <option value="14days">Due in 14 Days</option>
              <option value="30days">Due in 30 Days</option>
            </select>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterOverdue}
                onChange={(e) => setFilterOverdue(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className={cn(
                "text-sm font-medium",
                filterOverdue ? "text-red-600" : "text-gray-600"
              )}>
                Overdue Only
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterBlocked}
                onChange={(e) => setFilterBlocked(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <span className={cn(
                "text-sm font-medium",
                filterBlocked ? "text-orange-600" : "text-gray-600"
              )}>
                Blocked Only
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex h-full gap-4 min-w-[1200px]">
          {columns.map((status) => (
            <div
              key={status}
              className={cn(
                "flex-1 flex flex-col rounded-xl min-w-[240px]",
                status === WorkItemStatus.NEEDS_QA ? 'bg-orange-50' : 'bg-gray-100'
              )}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, status)}
            >
              {/* Header */}
              <div className={cn(
                "p-3 font-semibold text-sm flex justify-between items-center border-b rounded-t-xl sticky top-0",
                status === WorkItemStatus.NEEDS_QA
                  ? 'bg-orange-100 border-orange-200 text-orange-700'
                  : 'bg-gray-50 border-gray-200 text-gray-700'
              )}>
                <span className="flex items-center gap-1.5">
                  {status === WorkItemStatus.NEEDS_QA && <ClipboardCheck className="w-4 h-4" />}
                  {StatusLabel[status]}
                </span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs",
                  status === WorkItemStatus.NEEDS_QA
                    ? 'bg-orange-200 text-orange-700'
                    : 'bg-gray-200 text-gray-600'
                )}>
                  {filteredItems.filter((i) => i.status === status).length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-hide">
                {filteredItems
                  .filter((i) => i.status === status)
                  .map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onClick={() => setSelectedItem(item)}
                      className={cn(
                        'bg-white p-3 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition group relative',
                        item.priority === 'URGENT' && 'border-l-4 border-l-red-500',
                        isOverdue(item.dueAt) && item.status !== 'DONE' && 'bg-red-50',
                        draggedItemId === item.id && 'opacity-50'
                      )}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                            TYPE_BADGE_COLORS[item.type]
                          )}>
                            {WorkItemTypeLabel[item.type]}
                          </span>
                          {/* QA indicator for TBP/Magazine items */}
                          {TBP_MAGAZINE_TYPES.includes(item.type) && (
                            <span
                              className={cn(
                                "text-[9px] px-1 py-0.5 rounded font-medium",
                                item.needsProofing
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-green-100 text-green-700"
                              )}
                              title={item.needsProofing ? "QA Required" : "QA Complete"}
                            >
                              {item.needsProofing ? "QA" : "OK"}
                            </span>
                          )}
                        </div>
                        {item.owner?.id === session?.user?.id && (
                          <div
                            className="w-2 h-2 rounded-full bg-indigo-500"
                            title="Assigned to you"
                          />
                        )}
                      </div>
                      <h4 className="text-sm font-medium text-gray-900 mb-3 leading-snug line-clamp-2">
                        {item.title}
                      </h4>

                      {/* Tags */}
                      {parseTags(item.tags).length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {parseTags(item.tags).slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-between items-center text-xs text-gray-500">
                        {(() => {
                          const cd = dueCountdown(item.dueAt, item.status);
                          if (!cd) return <div />;
                          return (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span className={cd.cls}>{cd.text}</span>
                            </div>
                          );
                        })()}
                        {item.owner && (
                          <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[9px] font-bold text-gray-600">
                            {item.owner.name?.substring(0, 2) || '??'}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedItem && (
        <WorkItemModal
          itemId={selectedItem.id}
          onClose={() => setSelectedItem(null)}
          onUpdate={refetch}
        />
      )}
    </div>
  );
}
