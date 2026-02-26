"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/hooks";

type AuthorListItem = {
  id: string;
  name: string;
  email: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  contacted: boolean;
  sourceRef: string | null;
  updatedAt: string;
};

type AuthorDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  contacted: boolean;
  sourceRef: string | null;
  raw: any;
  updatedAt: string;
};

type LastRun = {
  id: string;
  createdAt: string;
  status: string;
  inserted: number;
  updated: number;
  skipped: number;
  error: string | null;
};

function ContactedBadge({ contacted }: { contacted: boolean }) {
  return contacted ? (
    <span className="inline-block rounded px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700">
      CONTACTED
    </span>
  ) : (
    <span className="inline-block rounded px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-600">
      NOT CONTACTED
    </span>
  );
}

export default function TexasAuthorsPage() {
  const [q, setQ] = useState("");
  const [contactedFilter, setContactedFilter] = useState<"all" | "contacted" | "not-contacted">("all");
  const [items, setItems] = useState<AuthorListItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [selected, setSelected] = useState<AuthorDetail | null>(null);
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [toasting, setToasting] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load(query = q, cf = contactedFilter) {
    setLoading(true);
    try {
      let url = `/api/texas-authors?q=${encodeURIComponent(query)}`;
      if (cf === "contacted") url += "&contacted=true";
      if (cf === "not-contacted") url += "&contacted=false";
      const res = await api.get<{ items: AuthorListItem[]; total: number; lastRun: LastRun | null }>(url);
      setItems(res?.items ?? []);
      setTotal(res?.total ?? 0);
      setLastRun(res?.lastRun ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function quickToggleContacted(e: React.MouseEvent, id: string, currentlyContacted: boolean) {
    e.stopPropagation();
    await api.patch(`/api/texas-authors/${id}`, { contacted: !currentlyContacted });
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, contacted: !currentlyContacted } : a)));
    if (selected?.id === id) {
      setSelected((prev) => (prev ? { ...prev, contacted: !currentlyContacted } : prev));
    }
  }

  async function syncNow() {
    setSyncing(true);
    setSyncError(null);
    try {
      await api.post("/api/texas-authors/sync", {});
      await load();
    } catch (err: any) {
      setSyncError(err?.message ?? "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function open(id: string) {
    const res = await api.get<{ item: AuthorDetail }>(`/api/texas-authors/${id}`);
    setSelected(res?.item ?? null);
    setEditingNotes(false);
  }

  function startEditNotes() {
    setNotesValue(selected?.notes ?? "");
    setEditingNotes(true);
  }

  async function saveNotes() {
    if (!selected) return;
    setSavingNotes(true);
    try {
      const res = await api.patch<{ item: AuthorDetail }>(`/api/texas-authors/${selected.id}`, { notes: notesValue });
      if (res?.item) setSelected(res.item);
      setEditingNotes(false);
    } finally {
      setSavingNotes(false);
    }
  }

  async function toggleContacted() {
    if (!selected) return;
    const next = !selected.contacted;
    const res = await api.patch<{ item: AuthorDetail }>(`/api/texas-authors/${selected.id}`, { contacted: next });
    if (res?.item) {
      setSelected(res.item);
      setItems((prev) => prev.map((a) => a.id === selected.id ? { ...a, contacted: next } : a));
    }
  }

  function copyEmail() {
    if (!selected?.email) return;
    navigator.clipboard.writeText(selected.email);
    setToasting("Email copied");
    setTimeout(() => setToasting(null), 2000);
  }

  // Debounced search + contacted filter
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { load(q, contactedFilter); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, contactedFilter]);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="flex h-[calc(100vh-48px)]">
      {toasting && (
        <div className="fixed bottom-4 right-4 z-50 rounded bg-gray-800 px-4 py-2 text-sm text-white shadow">
          {toasting}
        </div>
      )}

      <div className="flex-1 p-4 overflow-auto">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold">Texas Authors</h1>
          <span className="text-xs text-gray-400">
            {loading ? "…" : total > 0 ? (items.length < total ? `Showing ${items.length} of ${total.toLocaleString()}` : `${total.toLocaleString()} authors`) : ""}
          </span>
          {lastRun && (
            <div className={`rounded border px-3 py-1.5 text-xs ${
              lastRun.status === "FAILED"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-800"
            }`}>
              <span className={`mr-2 inline-block rounded px-1.5 py-0.5 font-semibold ${
                lastRun.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
              }`}>
                {lastRun.status}
              </span>
              {new Date(lastRun.createdAt).toLocaleString()}
              {lastRun.status === "FAILED"
                ? lastRun.error
                  ? <span className="ml-2 font-medium">{lastRun.error}</span>
                  : null
                : <span className="ml-2 text-gray-500">+{lastRun.inserted} inserted · {lastRun.updated} updated · {lastRun.skipped} skipped</span>
              }
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <input
              className="w-72 rounded border px-3 py-2 text-sm"
              placeholder="Search name, email, phone, website, city…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              className="rounded border px-3 py-2 text-sm disabled:opacity-50"
              onClick={syncNow}
              disabled={syncing}
            >
              {syncing ? "Syncing…" : "Sync now"}
            </button>
          </div>
        </div>

        <div className="mt-2 flex gap-2">
          {(["all", "contacted", "not-contacted"] as const).map((cf) => (
            <button
              key={cf}
              onClick={() => setContactedFilter(cf)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition ${
                contactedFilter === cf
                  ? cf === "contacted"
                    ? "bg-green-600 text-white border-green-600"
                    : cf === "not-contacted"
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-gray-800 text-white border-gray-800"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {cf === "all" ? "All" : cf === "contacted" ? "Contacted" : "Not Contacted"}
            </button>
          ))}
        </div>

        {syncError && (
          <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Sync failed: {syncError}
          </div>
        )}

        <div className="mt-4 overflow-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Website</th>
                <th className="p-2 text-left">Location</th>
                <th className="p-2 text-left">Tab</th>
                <th className="p-2 text-left">Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr
                  key={a.id}
                  className="group cursor-pointer border-t hover:bg-gray-50"
                  onClick={() => open(a.id)}
                >
                  <td className="p-2 font-medium">{a.name}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-1.5">
                      <ContactedBadge contacted={a.contacted} />
                      <button
                        onClick={(e) => quickToggleContacted(e, a.id, a.contacted)}
                        className="opacity-0 group-hover:opacity-100 rounded border border-gray-300 px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100 transition"
                        title={a.contacted ? "Mark not contacted" : "Mark contacted"}
                      >
                        {a.contacted ? "✗" : "✓"}
                      </button>
                    </div>
                  </td>
                  <td className="p-2">{a.email ?? "-"}</td>
                  <td className="p-2">{a.website ?? "-"}</td>
                  <td className="p-2">{[a.city, a.state].filter(Boolean).join(", ") || "-"}</td>
                  <td className="p-2 text-xs text-gray-500">{a.sourceRef ?? "-"}</td>
                  <td className="p-2">{new Date(a.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td className="p-4 text-gray-500" colSpan={7}>
                    {q ? "No authors match your search." : "No authors yet — click Sync now to import from the sheet."}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td className="p-4 text-gray-400" colSpan={7}>Loading…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <aside className="w-[420px] border-l bg-white p-4 overflow-auto">
          <div className="flex items-start">
            <div>
              <h2 className="text-lg font-semibold">{selected.name}</h2>
              <div className="mt-1 flex items-center gap-2">
                <ContactedBadge contacted={selected.contacted} />
                {selected.sourceRef && (
                  <span className="text-xs text-gray-500">Tab: {selected.sourceRef}</span>
                )}
              </div>
              <div className="mt-1 text-xs text-gray-400">
                Updated: {new Date(selected.updatedAt).toLocaleString()}
              </div>
            </div>
            <button
              className="ml-auto text-sm text-gray-500 hover:text-gray-800"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={toggleContacted}
              className={`rounded border px-3 py-1.5 text-xs font-medium ${
                selected.contacted
                  ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                  : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
              }`}
            >
              {selected.contacted ? "Mark not contacted" : "Mark contacted"}
            </button>
            {selected.email && (
              <button
                onClick={copyEmail}
                className="rounded border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Copy email
              </button>
            )}
            {selected.website && (
              <a
                href={selected.website}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
              >
                Open website
              </a>
            )}
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <div><span className="text-gray-500">Email:</span> {selected.email ?? "-"}</div>
            <div><span className="text-gray-500">Phone:</span> {selected.phone ?? "-"}</div>
            <div>
              <span className="text-gray-500">Website:</span>{" "}
              {selected.website ? (
                <a href={selected.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                  {selected.website}
                </a>
              ) : "-"}
            </div>
            <div>
              <span className="text-gray-500">Location:</span>{" "}
              {[selected.city, selected.state].filter(Boolean).join(", ") || "-"}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-gray-500">Notes</span>
                {!editingNotes && (
                  <button
                    onClick={startEditNotes}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Edit
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div className="space-y-2">
                  <textarea
                    rows={4}
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    className="w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveNotes}
                      disabled={savingNotes}
                      className="rounded bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {savingNotes ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => setEditingNotes(false)}
                      className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-700 whitespace-pre-wrap">{selected.notes || <span className="text-gray-400 italic">No notes</span>}</p>
              )}
            </div>
          </div>

          <details className="mt-4 rounded border p-2">
            <summary className="cursor-pointer text-sm font-medium">Raw sheet data</summary>
            <pre className="mt-2 max-h-[40vh] overflow-auto rounded bg-gray-50 p-2 text-xs">
              {JSON.stringify(selected.raw, null, 2)}
            </pre>
          </details>
        </aside>
      )}
    </div>
  );
}
