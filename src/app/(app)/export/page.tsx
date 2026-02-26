'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useFetch } from '@/lib/hooks';

interface User {
  id: string;
  name: string | null;
  email: string;
}

const WORK_ITEM_TYPES = [
  { value: 'SOCIAL_ASSET_REQUEST', label: 'Social Graphics' },
  { value: 'SPONSORED_EDITORIAL_REVIEW', label: 'SER' },
  { value: 'BOOK_CAMPAIGN', label: 'Book Campaign' },
  { value: 'WEBSITE_EVENT', label: 'Website Event' },
  { value: 'TX_BOOK_PREVIEW_LEAD', label: 'TX Book Preview' },
  { value: 'ACCESS_REQUEST', label: 'Access Request' },
  { value: 'GENERAL', label: 'General' },
];

const WORK_ITEM_STATUSES = [
  'BACKLOG', 'READY', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'NEEDS_QA', 'DONE',
];

function buildQuery(params: Record<string, string>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  return q.toString();
}

const selectCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500';
const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500';
const labelCls = 'text-xs font-medium text-gray-500 uppercase tracking-wide';

export default function ExportPage() {
  const { data: users } = useFetch<User[]>('/api/users');

  // ── Work Items filters ──
  const [wiType, setWiType] = useState('');
  const [wiStatus, setWiStatus] = useState('');
  const [wiOwner, setWiOwner] = useState('');
  const [wiCreatedFrom, setWiCreatedFrom] = useState('');
  const [wiCreatedTo, setWiCreatedTo] = useState('');
  const [wiDueFrom, setWiDueFrom] = useState('');
  const [wiDueTo, setWiDueTo] = useState('');

  // ── Texas Authors filters ──
  const [taQ, setTaQ] = useState('');
  const [taContacted, setTaContacted] = useState('');
  const [taCreatedFrom, setTaCreatedFrom] = useState('');
  const [taCreatedTo, setTaCreatedTo] = useState('');

  // ── SER filters ──
  const [serStatus, setSerStatus] = useState('active');
  const [serOwner, setSerOwner] = useState('');
  const [serCreatedFrom, setSerCreatedFrom] = useState('');
  const [serCreatedTo, setSerCreatedTo] = useState('');

  const exportWorkItems = () => {
    const qs = buildQuery({
      type: wiType, status: wiStatus, ownerId: wiOwner,
      createdFrom: wiCreatedFrom, createdTo: wiCreatedTo,
      dueFrom: wiDueFrom, dueTo: wiDueTo,
    });
    window.open(`/api/export/work-items${qs ? '?' + qs : ''}`);
  };

  const exportTexasAuthors = () => {
    const qs = buildQuery({
      q: taQ, contacted: taContacted,
      createdFrom: taCreatedFrom, createdTo: taCreatedTo,
    });
    window.open(`/api/export/texas-authors${qs ? '?' + qs : ''}`);
  };

  const exportSer = () => {
    const qs = buildQuery({
      status: serStatus, ownerId: serOwner,
      createdFrom: serCreatedFrom, createdTo: serCreatedTo,
    });
    window.open(`/api/export/ser${qs ? '?' + qs : ''}`);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Download className="w-6 h-6 text-indigo-600" /> Export & Reporting
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Download filtered CSV exports for stakeholder sharing, Sheets analysis, or manual backups.
        </p>
      </div>

      {/* ── Work Items ─────────────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
          <h2 className="text-lg font-semibold">Work Items</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Type</label>
            <select className={selectCls} value={wiType} onChange={e => setWiType(e.target.value)}>
              <option value="">All Types</option>
              {WORK_ITEM_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>Status</label>
            <select className={selectCls} value={wiStatus} onChange={e => setWiStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {WORK_ITEM_STATUSES.map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>Owner</label>
            <select className={selectCls} value={wiOwner} onChange={e => setWiOwner(e.target.value)}>
              <option value="">All Owners</option>
              <option value="unassigned">Unassigned</option>
              {users?.map(u => (
                <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>Created From</label>
            <input type="date" className={inputCls} value={wiCreatedFrom} onChange={e => setWiCreatedFrom(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>Created To</label>
            <input type="date" className={inputCls} value={wiCreatedTo} onChange={e => setWiCreatedTo(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>Due From</label>
            <input type="date" className={inputCls} value={wiDueFrom} onChange={e => setWiDueFrom(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>Due To</label>
            <input type="date" className={inputCls} value={wiDueTo} onChange={e => setWiDueTo(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={exportWorkItems} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <p className="text-xs text-gray-400">
            Columns: ID, Type, Title, Status, Priority, Owner, Requester, Created, Due, Completed, Tags, Blocked Reason, TBP fields
          </p>
        </div>
      </div>

      {/* ── Texas Authors ──────────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <FileSpreadsheet className="w-5 h-5 text-green-500" />
          <h2 className="text-lg font-semibold">Texas Authors</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Search</label>
            <input
              type="text"
              placeholder="Name, email, city, state…"
              className={inputCls}
              value={taQ}
              onChange={e => setTaQ(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>Contact Status</label>
            <select className={selectCls} value={taContacted} onChange={e => setTaContacted(e.target.value)}>
              <option value="">All</option>
              <option value="false">Not Contacted</option>
              <option value="true">Contacted</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>Created From</label>
            <input type="date" className={inputCls} value={taCreatedFrom} onChange={e => setTaCreatedFrom(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>Created To</label>
            <input type="date" className={inputCls} value={taCreatedTo} onChange={e => setTaCreatedTo(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={exportTexasAuthors} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <p className="text-xs text-gray-400">
            Columns: Name, Email, Phone, Website, City, State, Contacted, Notes, Source Ref, Created, Updated
          </p>
        </div>
      </div>

      {/* ── SER ────────────────────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <FileSpreadsheet className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-semibold">Sponsored Editorial Reviews (SER)</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Scope</label>
            <select className={selectCls} value={serStatus} onChange={e => setSerStatus(e.target.value)}>
              <option value="active">Active only (not DONE)</option>
              <option value="DONE">Completed only</option>
              <option value="all">All SERs</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>Owner</label>
            <select className={selectCls} value={serOwner} onChange={e => setSerOwner(e.target.value)}>
              <option value="">All Owners</option>
              {users?.map(u => (
                <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>Created From</label>
            <input type="date" className={inputCls} value={serCreatedFrom} onChange={e => setSerCreatedFrom(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls}>Created To</label>
            <input type="date" className={inputCls} value={serCreatedTo} onChange={e => setSerCreatedTo(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={exportSer} className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <p className="text-xs text-gray-400">
            Columns: ID, Title, Status, Owner, Due Date, Created, Started, Completed, Age (days), Cycle Time (days)
          </p>
        </div>
      </div>
    </div>
  );
}
