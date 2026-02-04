'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseFetchOptions {
  pollInterval?: number;
  enabled?: boolean;
}

export function useFetch<T>(url: string | null, options: UseFetchOptions = {}) {
  const { pollInterval = 0, enabled = true } = options;
  const shouldFetch = enabled && url !== null;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!shouldFetch || !url) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const json = await res.json();
      setData(json.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [url, shouldFetch]);

  useEffect(() => {
    fetchData();

    if (pollInterval > 0 && shouldFetch) {
      const interval = setInterval(fetchData, pollInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, pollInterval, shouldFetch]);

  return { data, error, isLoading, refetch: fetchData };
}

export function useMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (variables: TVariables) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await mutationFn(variables);
        return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'An error occurred';
        setError(message);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [mutationFn]
  );

  return { mutate, isLoading, error };
}

// API helper functions
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const text = await res.text();
      if (text) {
        console.error("API error response:", text.slice(0, 2000));
      }
      if (text) {
        try {
          const data = JSON.parse(text);
          if (data?.error) msg = data.error;
        } catch {
          msg = `${msg}: ${text.slice(0, 300)}`;
        }
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(msg);
  }

  const text = await res.text();
  if (!text) return null as T;
  try {
    const json = JSON.parse(text);
    return json.data;
  } catch {
    console.error("API unexpected response:", text.slice(0, 2000));
    return text as unknown as T;
  }
}

export const api = {
  get: <T = unknown>(url: string) => apiFetch<T>(url),
  post: <T = unknown>(url: string, data: unknown) =>
    apiFetch<T>(url, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  patch: <T = unknown>(url: string, data: unknown) =>
    apiFetch<T>(url, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: <T = unknown>(url: string) =>
    apiFetch<T>(url, {
      method: 'DELETE',
    }),
  workItems: {
    list: (params?: Record<string, string>) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return apiFetch(`/api/work-items${query}`);
    },
    get: (id: string) => apiFetch(`/api/work-items/${id}`),
    create: (data: unknown) =>
      apiFetch('/api/work-items', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: unknown) =>
      apiFetch(`/api/work-items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiFetch(`/api/work-items/${id}`, {
        method: 'DELETE',
      }),
  },
  subtasks: {
    toggle: (id: string, completed: boolean) =>
      apiFetch(`/api/subtasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed }),
      }),
    create: (workItemId: string, title: string) =>
      apiFetch(`/api/work-items/${workItemId}/subtasks`, {
        method: 'POST',
        body: JSON.stringify({ title }),
      }),
  },
  comments: {
    create: (workItemId: string, body: string) =>
      apiFetch(`/api/work-items/${workItemId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
  },
  users: {
    list: () => apiFetch('/api/users'),
  },
  templates: {
    list: () => apiFetch('/api/templates'),
  },
  stats: {
    get: () => apiFetch('/api/stats'),
  },
  ghl: {
    events: () => apiFetch('/api/ghl/events'),
  },
  qc: {
    get: (workItemId: string) => apiFetch(`/api/work-items/${workItemId}/qc`),
    addCheckpoints: (workItemId: string, checkpoints: string[]) =>
      apiFetch(`/api/work-items/${workItemId}/qc`, {
        method: 'POST',
        body: JSON.stringify({ checkpoints }),
      }),
    updateCheckpoint: (
      workItemId: string,
      checkpoint: string,
      status: 'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED',
      notes?: string
    ) =>
      apiFetch(`/api/work-items/${workItemId}/qc`, {
        method: 'PATCH',
        body: JSON.stringify({ checkpoint, status, notes }),
      }),
  },
};
