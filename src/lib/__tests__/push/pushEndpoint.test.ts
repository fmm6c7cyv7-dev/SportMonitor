import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint } from "@/lib/server/pushEndpoint";

describe("isAllowedPushEndpoint", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc123",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/QabC123",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
    "https://fcm.googleapis.com:443/fcm/send/abc",
  ])("accepts %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/hook",
    "https://internal.example.com/push",
    "https://fcm.googleapis.com.evil.com/x",
    "https://evil.com/fcm.googleapis.com",
    "https://user:pass@fcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/x",
    "https://notify.windows.com/x",
    "javascript:alert(1)",
    "not a url",
    "",
    null,
    42,
  ])("rejects %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });
});
