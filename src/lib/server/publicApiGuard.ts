import { NextResponse } from "next/server";

type WindowEntry = {
  count: number;
  resetAt: number;
};

type GuardOptions = {
  key: string;
  limit: number;
  windowMs?: number;
  maxBodyBytes?: number;
};

const DEFAULT_WINDOW_MS = 60_000;
const MAX_TRACKED_KEYS = 5_000;

const rateWindows = new Map<string, WindowEntry>();

function clientIp(request: Request): string | null {
  const raw =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip");

  if (!raw) return null;

  const first = raw.split(",")[0]?.trim();
  return first || null;
}

function pruneExpired(now: number): void {
  if (rateWindows.size < MAX_TRACKED_KEYS) return;

  for (const [key, entry] of rateWindows) {
    if (entry.resetAt <= now) {
      rateWindows.delete(key);
    }
  }

  if (rateWindows.size >= MAX_TRACKED_KEYS) {
    const overflow = rateWindows.size - MAX_TRACKED_KEYS + 1;
    const keys = rateWindows.keys();
    for (let index = 0; index < overflow; index += 1) {
      const next = keys.next();
      if (next.done) break;
      rateWindows.delete(next.value);
    }
  }
}

export function guardPublicApi(
  request: Request,
  options: GuardOptions,
): NextResponse | null {
  const isWrite = request.method !== "GET" && request.method !== "HEAD";

  if (isWrite) {
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite === "cross-site") {
      return NextResponse.json(
        { ok: false, error: "Cross-site request blocked" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    const origin = request.headers.get("origin");
    if (origin) {
      try {
        if (new URL(origin).host !== new URL(request.url).host) {
          return NextResponse.json(
            { ok: false, error: "Cross-origin request blocked" },
            { status: 403, headers: { "Cache-Control": "no-store" } },
          );
        }
      } catch {
        return NextResponse.json(
          { ok: false, error: "Invalid request origin" },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
    }
  }

  const maxBodyBytes = options.maxBodyBytes;
  if (maxBodyBytes && isWrite) {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
      return NextResponse.json(
        { ok: false, error: "Request body too large" },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  if (request.url.length > 4_096) {
    return NextResponse.json(
      { ok: false, error: "Request URL too long" },
      { status: 414, headers: { "Cache-Control": "no-store" } },
    );
  }

  const ip = clientIp(request);
  if (!ip) {
    // Vercel supplies a client IP in production. Skipping when absent keeps
    // local development and unit tests deterministic.
    return null;
  }

  const now = Date.now();
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const key = `${options.key}:${ip}`;

  pruneExpired(now);

  const existing = rateWindows.get(key);
  if (!existing || existing.resetAt <= now) {
    rateWindows.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (existing.count >= options.limit) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  existing.count += 1;
  return null;
}

export async function readJsonObject<T extends Record<string, unknown>>(
  request: Request,
  maxBytes: number,
): Promise<
  | { ok: true; value: T }
  | { ok: false; response: NextResponse }
> {
  const raw = await request.text();

  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Request body too large" },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Invalid JSON" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Invalid JSON object" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  return { ok: true, value: value as T };
}

export function isSafeDeviceId(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  return (
    trimmed.length >= 10 &&
    trimmed.length <= 100 &&
    trimmed.startsWith("sm_") &&
    /^sm_[A-Za-z0-9_-]+$/.test(trimmed)
  );
}

export function isSafeUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value.trim(),
    )
  );
}
