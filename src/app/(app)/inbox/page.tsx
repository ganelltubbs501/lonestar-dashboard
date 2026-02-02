'use client';

import { useState } from 'react';
import { useFetch } from '@/lib/hooks';
import { formatDate, formatRelativeTime, cn } from '@/lib/utils';
import {
  Inbox,
  Clock,
  AlertTriangle,
  MessageSquare,
  Mail,
  ChevronRight,
  Loader2,
  Filter,
} from 'lucide-react';
import Link from 'next/link';

interface AwaitingItem {
  id: string;
  title: string;
  type: string;
  status: string;
  waitingSince: string | null;
  lastContactedAt: string | null;
  dueAt: string | null;
  waitingDays: number;
  owner: { id: string; name: string | null; image: string | null } | null;
  requester: { id: string; name: string | null } | null;
  messages: { id: string; body: string; direction: string; createdAt: string }[];
}

interface BlockedItem {
  id: string;
  title: string;
  type: string;
  blockedReason: string | null;
  updatedAt: string;
  owner: { id: string; name: string | null; image: string | null } | null;
}

interface UnreadMessage {
  id: string;
  body: string;
  direction: string;
  createdAt: string;
  workItem: {
    id: string;
    title: string;
    owner: { id: string; name: string | null; image: string | null } | null;
  };
}

interface InboxData {
  awaitingReply: AwaitingItem[];
  blocked: BlockedItem[];
  unreadMessages: UnreadMessage[];
  counts: {
    awaiting: number;
    blocked: number;
    unread: number;
  };
}

export default function InboxPage() {
  const [activeTab, setActiveTab] = useState<'awaiting' | 'blocked' | 'unread'>('awaiting');
  const [showMineOnly, setShowMineOnly] = useState(false);

  const queryParams = new URLSearchParams({
    ...(showMineOnly ? { mine: 'true' } : {}),
  });

  const { data, isLoading } = useFetch<InboxData>(`/api/inbox?${queryParams}`, {
    pollInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const counts = data?.counts || { awaiting: 0, blocked: 0, unread: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Inbox className="w-6 h-6 text-indigo-600" />
            Communications Inbox
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Items waiting on replies or blocked
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showMineOnly}
            onChange={(e) => setShowMineOnly(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600"
          />
          My items only
        </label>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setActiveTab('awaiting')}
          className={cn(
            'card p-4 text-left transition',
            activeTab === 'awaiting' ? 'ring-2 ring-indigo-500' : 'hover:border-gray-300'
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Awaiting Reply</p>
              <p className="text-2xl font-bold text-orange-600">{counts.awaiting}</p>
            </div>
            <Clock className="w-8 h-8 text-orange-200" />
          </div>
        </button>

        <button
          onClick={() => setActiveTab('blocked')}
          className={cn(
            'card p-4 text-left transition',
            activeTab === 'blocked' ? 'ring-2 ring-indigo-500' : 'hover:border-gray-300'
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Blocked</p>
              <p className="text-2xl font-bold text-red-600">{counts.blocked}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-200" />
          </div>
        </button>

        <button
          onClick={() => setActiveTab('unread')}
          className={cn(
            'card p-4 text-left transition',
            activeTab === 'unread' ? 'ring-2 ring-indigo-500' : 'hover:border-gray-300'
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Unread Messages</p>
              <p className="text-2xl font-bold text-blue-600">{counts.unread}</p>
            </div>
            <MessageSquare className="w-8 h-8 text-blue-200" />
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="card">
        {activeTab === 'awaiting' && (
          <div className="divide-y divide-gray-100">
            {data?.awaitingReply?.map((item) => (
              <Link
                key={item.id}
                href={`/board?item=${item.id}`}
                className="p-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900 truncate">{item.title}</h4>
                    {item.waitingDays > 3 && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                        {item.waitingDays}d waiting
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Waiting since {item.waitingSince ? formatDate(item.waitingSince) : 'unknown'}
                    </span>
                    {item.lastContactedAt && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        Last contact {formatRelativeTime(item.lastContactedAt)}
                      </span>
                    )}
                  </div>
                  {item.messages?.[0] && (
                    <p className="mt-2 text-sm text-gray-600 truncate">
                      Last: &quot;{item.messages[0].body.substring(0, 100)}...&quot;
                    </p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
              </Link>
            ))}

            {(!data?.awaitingReply || data.awaitingReply.length === 0) && (
              <div className="p-8 text-center text-gray-400">
                No items awaiting reply
              </div>
            )}
          </div>
        )}

        {activeTab === 'blocked' && (
          <div className="divide-y divide-gray-100">
            {data?.blocked?.map((item) => (
              <Link
                key={item.id}
                href={`/board?item=${item.id}`}
                className="p-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 truncate">{item.title}</h4>
                  {item.blockedReason && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {item.blockedReason}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    Blocked {formatRelativeTime(item.updatedAt)}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
              </Link>
            ))}

            {(!data?.blocked || data.blocked.length === 0) && (
              <div className="p-8 text-center text-gray-400">
                No blocked items
              </div>
            )}
          </div>
        )}

        {activeTab === 'unread' && (
          <div className="divide-y divide-gray-100">
            {data?.unreadMessages?.map((msg) => (
              <Link
                key={msg.id}
                href={`/board?item=${msg.workItem.id}`}
                className="p-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                    <h4 className="font-medium text-gray-900 truncate">
                      {msg.workItem.title}
                    </h4>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 truncate">
                    &quot;{msg.body.substring(0, 150)}...&quot;
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Received {formatRelativeTime(msg.createdAt)}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
              </Link>
            ))}

            {(!data?.unreadMessages || data.unreadMessages.length === 0) && (
              <div className="p-8 text-center text-gray-400">
                No unread messages
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
