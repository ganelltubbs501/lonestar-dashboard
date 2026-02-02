"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/hooks";

type AuthorListItem = {
  id: string;
  name: string;
  email: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
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
  raw: any;
  updatedAt: string;
};

export default function TexasAuthorsPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<AuthorListItem[]>([]);
  const [selected, setSelected] = useState<AuthorDetail | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/api/texas-authors?q=${encodeURIComponent(q)}`);
      setItems(res.data?.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function open(id: string) {
    const res = await api.get(`/api/texas-authors/${id}`);
    setSelected(res.data?.item ?? null);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-[calc(100vh-48px)]">
      <div className="flex-1 p-4 overflow-auto">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold">Texas Authors</h1>
          <div className="ml-auto flex gap-2">
            <input
              className="w-72 rounded border px-3 py-2 text-sm"
              placeholder="Search name, email, website, city…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
            <button
              className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
              onClick={load}
              disabled={loading}
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Website</th>
                <th className="p-2 text-left">Location</th>
                <th className="p-2 text-left">Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr
                  key={a.id}
                  className="cursor-pointer border-t hover:bg-gray-50"
                  onClick={() => open(a.id)}
                >
                  <td className="p-2 font-medium">{a.name}</td>
                  <td className="p-2">{a.email ?? "-"}</td>
                  <td className="p-2">{a.website ?? "-"}</td>
                  <td className="p-2">{[a.city, a.state].filter(Boolean).join(", ") || "-"}</td>
                  <td className="p-2">{new Date(a.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td className="p-4 text-gray-500" colSpan={5}>
                    No results.
                  </td>
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
              <div className="mt-1 text-sm text-gray-600">
                Updated: {new Date(selected.updatedAt).toLocaleString()}
              </div>
            </div>
            <button className="ml-auto text-sm text-gray-500 hover:text-gray-800" onClick={() => setSelected(null)}>
              Close
            </button>
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
            <div><span className="text-gray-500">Location:</span> {[selected.city, selected.state].filter(Boolean).join(", ") || "-"}</div>
            <div><span className="text-gray-500">Notes:</span> {selected.notes ?? "-"}</div>
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
