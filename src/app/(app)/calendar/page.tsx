'use client';

import { useState, useMemo } from 'react';
import { useFetch } from '@/lib/hooks';
import { formatDate, cn } from '@/lib/utils';
import { Calendar, Clock, AlertCircle, ChevronLeft, ChevronRight, Filter, Loader2 } from 'lucide-react';

interface CalendarItem {
  id: string;
  type: 'deadline' | 'workItem';
  deliverableType: string;
  title: string;
  description: string;
  dueAt: string;
  status: string;
  ownerId: string | null;
  owner?: { id: string; name: string | null; image: string | null };
  needsProofing?: boolean;
  priority?: string;
  isRecurring?: boolean;
}

interface CalendarData {
  combined: CalendarItem[];
  dateRange: { start: string; end: string };
}

const DELIVERABLE_COLORS: Record<string, string> = {
  NEWSLETTER: 'bg-blue-100 text-blue-700 border-blue-200',
  MAGAZINE_CONTENT: 'bg-purple-100 text-purple-700 border-purple-200',
  CAMPAIGN_MILESTONE: 'bg-green-100 text-green-700 border-green-200',
  SER_DUE: 'bg-orange-100 text-orange-700 border-orange-200',
  TBP_DEADLINE: 'bg-pink-100 text-pink-700 border-pink-200',
  EVENTS_UPLOAD: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  WEEKEND_EVENTS: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  BOOK_CAMPAIGN: 'bg-green-100 text-green-700 border-green-200',
  SOCIAL_ASSET_REQUEST: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  SPONSORED_EDITORIAL_REVIEW: 'bg-orange-100 text-orange-700 border-orange-200',
  TX_BOOK_PREVIEW_LEAD: 'bg-pink-100 text-pink-700 border-pink-200',
  DEFAULT: 'bg-gray-100 text-gray-700 border-gray-200',
};

const DELIVERABLE_LABELS: Record<string, string> = {
  NEWSLETTER: 'Newsletter',
  MAGAZINE_CONTENT: 'Magazine',
  CAMPAIGN_MILESTONE: 'Campaign',
  SER_DUE: 'SER Due',
  TBP_DEADLINE: 'TBP',
  EVENTS_UPLOAD: 'Events Upload',
  WEEKEND_EVENTS: 'Weekend Events',
  BOOK_CAMPAIGN: 'Campaign',
  SOCIAL_ASSET_REQUEST: 'Social Asset',
  SPONSORED_EDITORIAL_REVIEW: 'Editorial Review',
  TX_BOOK_PREVIEW_LEAD: 'TBP Lead',
  WEBSITE_EVENT: 'Website Event',
  CUSTOM: 'Custom',
};

export default function CalendarPage() {
  const [startOffset, setStartOffset] = useState(0);
  const [filterType, setFilterType] = useState<string>('all');
  const [showNeedsProofing, setShowNeedsProofing] = useState(false);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + startOffset);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 14);

  const queryParams = new URLSearchParams({
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    ...(showNeedsProofing ? { needsProofing: 'true' } : {}),
  });

  const { data, isLoading } = useFetch<CalendarData>(`/api/calendar?${queryParams}`, {
    pollInterval: 30000,
  });

  // Generate 14 days
  const days = useMemo(() => {
    const result = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      result.push(date);
    }
    return result;
  }, [startDate.getTime()]);

  // Group items by date
  const itemsByDate = useMemo(() => {
    if (!data?.combined) return {};

    const grouped: Record<string, CalendarItem[]> = {};

    data.combined
      .filter((item) => filterType === 'all' || item.deliverableType === filterType)
      .forEach((item) => {
        if (!item.dueAt) return;
        const dateKey = new Date(item.dueAt).toDateString();
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(item);
      });

    return grouped;
  }, [data?.combined, filterType]);

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();
  const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            Editorial Calendar
          </h1>
          <p className="text-gray-500 text-sm mt-1">Next 14 days of deadlines and deliverables</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setStartOffset(startOffset - 7)}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setStartOffset(0)}
            className="px-3 py-1 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded"
          >
            Today
          </button>
          <button
            onClick={() => setStartOffset(startOffset + 7)}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="select max-w-[200px]"
          >
            <option value="all">All Types</option>
            <optgroup label="Recurring">
              <option value="NEWSLETTER">Newsletter</option>
              <option value="MAGAZINE_CONTENT">Magazine</option>
              <option value="EVENTS_UPLOAD">Events Upload</option>
              <option value="WEEKEND_EVENTS">Weekend Events</option>
            </optgroup>
            <optgroup label="Work Items">
              <option value="BOOK_CAMPAIGN">Campaigns</option>
              <option value="SPONSORED_EDITORIAL_REVIEW">SER</option>
              <option value="TX_BOOK_PREVIEW_LEAD">TBP Leads</option>
            </optgroup>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showNeedsProofing}
            onChange={(e) => setShowNeedsProofing(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          Needs Proofing Only
        </label>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="px-2 py-2 text-xs font-medium text-gray-500 text-center">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((date, idx) => {
            const dateKey = date.toDateString();
            const items = itemsByDate[dateKey] || [];

            return (
              <div
                key={idx}
                className={cn(
                  'min-h-[120px] p-2 border-b border-r border-gray-100',
                  isWeekend(date) && 'bg-gray-50',
                  isToday(date) && 'bg-indigo-50'
                )}
              >
                <div
                  className={cn(
                    'text-sm font-medium mb-2',
                    isToday(date) ? 'text-indigo-600' : 'text-gray-700'
                  )}
                >
                  {date.getDate()}
                  {isToday(date) && (
                    <span className="ml-1 text-xs font-normal">Today</span>
                  )}
                </div>

                <div className="space-y-1">
                  {items.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'text-xs p-1.5 rounded border truncate cursor-pointer hover:opacity-80',
                        DELIVERABLE_COLORS[item.deliverableType] || DELIVERABLE_COLORS.DEFAULT
                      )}
                      title={item.title}
                    >
                      <div className="flex items-center gap-1">
                        {item.needsProofing && (
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        )}
                        <span className="truncate">{item.title}</span>
                      </div>
                    </div>
                  ))}
                  {items.length > 3 && (
                    <div className="text-xs text-gray-500 pl-1">
                      +{items.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(DELIVERABLE_LABELS).slice(0, 8).map(([key, label]) => (
          <span
            key={key}
            className={cn(
              'text-xs px-2 py-1 rounded border',
              DELIVERABLE_COLORS[key] || DELIVERABLE_COLORS.DEFAULT
            )}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
