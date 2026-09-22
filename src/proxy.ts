import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BASIC_AUTH_CHALLENGE = 'Basic realm="SportMonitor Admin", charset="UTF-8"';
const SHA_256 = "SHA-256";
const textEncoder = new TextEncoder();

function resolveAdminSecret(): string | null {
  const value = process.env.FAVORITE_AUDIT_SECRET?.trim();
  return value && value.length > 0 ? value : null;
}

function decodeBasicValue(encodedValue: string): string | null {
  try {
    const decoded = atob(encodedValue);
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
    return decodeBasicValue(rawValue.trim());
  }

  return null;
}

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(SHA_256, textEncoder.encode(value));
  return new Uint8Array(digest);
}

async function isConstantTimeMatch(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([sha256(left), sha256(right)]);

  let diff = 0;
  for (let index = 0; index < leftHash.length; index += 1) {
    diff |= leftHash[index] ^ rightHash[index];
  }

  return diff === 0;
}

export async function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/debug-tools")) {
    return NextResponse.next();
  }

  const expectedSecret = resolveAdminSecret();
  const presentedSecret = extractSecretFromAuthorizationHeader(
    request.headers.get("authorization"),
  );

  const isAuthorized = Boolean(
    expectedSecret &&
      presentedSecret &&
      (await isConstantTimeMatch(expectedSecret, presentedSecret)),
  );

  if (isAuthorized) {
    return NextResponse.next();
  }

  const response = NextResponse.json(
    { ok: false, error: "Unauthorized" },
    { status: 401 },
  );
  response.headers.set("WWW-Authenticate", BASIC_AUTH_CHALLENGE);
  return response;
}

export const config = {
  matcher: ["/debug-tools", "/debug-tools/:path*"],
};
