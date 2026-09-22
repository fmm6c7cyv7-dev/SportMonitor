"use client";

import { useEffect, useState } from "react";
import { getDeviceId } from "@/lib/deviceId";

type AuditRow = {
  id?: string;
  news_item_id?: string;
  device_id?: string;
  matched_favorite?: boolean;
  feed_eligible?: boolean;
  push_delivery_logged?: boolean;
  reason?: string | null;
  article?: {
    title?: string | null;
    url?: string | null;
    source?: string | null;
  } | null;
};

type AuditResponse = {
  ok?: boolean;
  count?: number;
  rows?: AuditRow[];
  error?: string;
  [key: string]: unknown;
};

function buildQuery(params: Record<string, string | null | undefined>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    searchParams.set(key, value);
  }

  return searchParams.toString();
}

export default function DebugToolsPage() {
  const [newsItemId, setNewsItemId] = useState("");
  const [currentDeviceId, setCurrentDeviceId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AuditResponse | null>(null);

  useEffect(() => {
    setCurrentDeviceId(getDeviceId());
  }, []);

  async function runRequest(input: RequestInfo, init?: RequestInit) {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetch(input, {
        cache: "no-store",
        ...init,
      });
      const json = (await result.json()) as AuditResponse;

      if (!result.ok) {
        throw new Error(json.error ?? `Request failed: ${result.status}`);
      }

      setResponse(json);
    } catch (requestError) {
      setResponse(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unknown request error",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchLatestAuditRows() {
    await runRequest(
      `/api/debug/favorite-audit?${buildQuery({
        limit: "20",
      })}`,
    );
  }

  async function fetchCurrentDeviceAuditRows() {
    await runRequest(
      `/api/debug/favorite-audit?${buildQuery({
        device_id: currentDeviceId,
        limit: "50",
      })}`,
    );
  }

  async function fetchAuditForArticleId() {
    if (!newsItemId.trim()) {
      setError("Missing news_item_id");
      return;
    }

    await runRequest(
      `/api/debug/favorite-audit?${buildQuery({
        news_item_id: newsItemId.trim(),
      })}`,
    );
  }

  async function runReauditForArticleId() {
    if (!newsItemId.trim()) {
      setError("Missing news_item_id");
      return;
    }

    await runRequest(
      "/api/debug/favorite-audit/run",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          news_item_id: newsItemId.trim(),
        }),
      },
    );
  }

  const rows = Array.isArray(response?.rows) ? response.rows : [];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Debug Tools</h1>
          <p className="text-sm text-slate-400">
            Intern vy för favorite delivery audit och manuell re-audit.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-black/20">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-sm">
            <div className="text-slate-400">Current device</div>
            <div className="mt-1 break-all font-mono text-xs text-slate-200">
              {currentDeviceId}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Route access kräver server-side Authorization header.
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="text-lg font-medium">Audit Reads</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={fetchLatestAuditRows}
                disabled={isLoading}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Hämta senaste audit-rader
              </button>
              <button
                type="button"
                onClick={fetchCurrentDeviceAuditRows}
                disabled={isLoading}
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Hämta audit för current device
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="text-lg font-medium">Article ID</h2>
            <div className="mt-4 flex flex-col gap-3">
              <input
                type="text"
                value={newsItemId}
                onChange={(event) => setNewsItemId(event.target.value)}
                placeholder="news_item_id"
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={runReauditForArticleId}
                  disabled={isLoading}
                  className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Kör re-audit för article id
                </button>
                <button
                  type="button"
                  onClick={fetchAuditForArticleId}
                  disabled={isLoading}
                  className="rounded-xl bg-fuchsia-400 px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Hämta audit för article id
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-medium">Result</h2>
            {isLoading ? (
              <span className="text-sm text-slate-400">Laddar...</span>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="px-3 py-2 font-medium">article</th>
                    <th className="px-3 py-2 font-medium">device_id</th>
                    <th className="px-3 py-2 font-medium">matched</th>
                    <th className="px-3 py-2 font-medium">feed</th>
                    <th className="px-3 py-2 font-medium">push logged</th>
                    <th className="px-3 py-2 font-medium">reason</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr
                      key={`${row.id ?? row.news_item_id ?? "row"}-${index}`}
                      className="border-b border-slate-900 align-top"
                    >
                      <td className="px-3 py-2">
                        <div className="max-w-md">
                          <div className="font-medium text-slate-100">
                            {row.article?.title ?? row.news_item_id ?? "-"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {row.article?.source ?? ""}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-300">
                        {row.device_id ?? "-"}
                      </td>
                      <td className="px-3 py-2">
                        {row.matched_favorite ? "true" : "false"}
                      </td>
                      <td className="px-3 py-2">
                        {row.feed_eligible ? "true" : "false"}
                      </td>
                      <td className="px-3 py-2">
                        {row.push_delivery_logged ? "true" : "false"}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {row.reason ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="mb-2 text-sm font-medium text-slate-300">Raw JSON</div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-300">
              {response ? JSON.stringify(response, null, 2) : "Ingen respons ännu."}
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
}
