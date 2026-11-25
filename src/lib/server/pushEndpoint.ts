/**
 * Allowlist for Web Push endpoints.
 *
 * The server POSTs to whatever endpoint a client registers, so an unrestricted
 * value would be a (blind) SSRF primitive. Only the push services used by real
 * browsers are accepted.
 */

const EXACT_HOSTS = new Set([
  "fcm.googleapis.com", // Chrome, Edge, Opera, Brave, Samsung Internet
  "android.googleapis.com", // legacy GCM endpoints
  "updates.push.services.mozilla.com", // Firefox
  "web.push.apple.com", // Safari / iOS web push
]);

const HOST_SUFFIXES = [
  ".push.services.mozilla.com", // Firefox regional/stage hosts
  ".push.apple.com", // Safari
  ".notify.windows.com", // Edge / WNS
];

export function isAllowedPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string") return false;

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;

  const host = url.hostname.toLowerCase();
  if (EXACT_HOSTS.has(host)) return true;

  return HOST_SUFFIXES.some(
    (suffix) => host.endsWith(suffix) && host.length > suffix.length,
  );
}
