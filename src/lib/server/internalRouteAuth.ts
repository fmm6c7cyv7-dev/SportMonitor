import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export type InternalRouteScope = "admin" | "cron";

const ADMIN_SECRET_ENV_KEYS = ["FAVORITE_AUDIT_SECRET"] as const;
const CRON_SECRET_ENV_KEYS = ["CRON_SECRET", "INGEST_SECRET"] as const;
const BASIC_AUTH_CHALLENGE = 'Basic realm="SportMonitor Admin", charset="UTF-8"';

function resolveEnvSecret(keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

function resolveExpectedSecret(scope: InternalRouteScope): string | null {
  if (scope === "cron") {
    return resolveEnvSecret(CRON_SECRET_ENV_KEYS);
  }

  return resolveEnvSecret(ADMIN_SECRET_ENV_KEYS);
}

function decodeBasicSecret(encodedValue: string): string | null {
  try {
    const decoded = Buffer.from(encodedValue, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex < 0) {
      const token = decoded.trim();
      return token.length > 0 ? token : null;
    }

    const password = decoded.slice(separatorIndex + 1).trim();
    return password.length > 0 ? password : null;
  } catch {
    return null;
  }
}

function extractSecretFromAuthorizationHeader(
  authorizationHeader: string | null,
): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, rawValue] = authorizationHeader.split(/\s+/, 2);
  if (!scheme || !rawValue) {
    return null;
  }

  if (/^bearer$/i.test(scheme)) {
    const token = rawValue.trim();
    return token.length > 0 ? token : null;
  }

  if (/^basic$/i.test(scheme)) {
    return decodeBasicSecret(rawValue.trim());
  }

  return null;
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function isConstantTimeSecretMatch(expected: string, candidate: string): boolean {
  return timingSafeEqual(sha256(expected), sha256(candidate));
}

function isRequestAuthorized(request: Request, scope: InternalRouteScope): boolean {
  const expectedSecret = resolveExpectedSecret(scope);
  if (!expectedSecret) {
    return false;
  }

  const presentedSecret = extractSecretFromAuthorizationHeader(
    request.headers.get("authorization"),
  );

  if (!presentedSecret) {
    return false;
  }

  return isConstantTimeSecretMatch(expectedSecret, presentedSecret);
}

export function requireInternalRouteAuth(
  request: Request,
  scope: InternalRouteScope,
): NextResponse | null {
  if (isRequestAuthorized(request, scope)) {
    return null;
  }

  const response = NextResponse.json(
    { ok: false, error: "Unauthorized" },
    { status: 401 },
  );

  if (scope === "admin") {
    response.headers.set("WWW-Authenticate", BASIC_AUTH_CHALLENGE);
  }

  return response;
}
