import { describe, expect, it } from "vitest";
import {
  guardPublicApi,
  isSafeDeviceId,
  isSafeUuid,
  readJsonObject,
} from "@/lib/server/publicApiGuard";

describe("publicApiGuard", () => {
  it("accepts SportMonitor device ids and rejects malformed ids", () => {
    expect(isSafeDeviceId("sm_12345678")).toBe(true);
    expect(isSafeDeviceId("sm_tmp_abcdef123456")).toBe(true);
    expect(isSafeDeviceId("device-123")).toBe(false);
    expect(isSafeDeviceId("sm_x")).toBe(false);
  });

  it("validates UUIDs", () => {
    expect(isSafeUuid("9f0e2b9a-0b8a-4159-9a88-283125416bcc")).toBe(true);
    expect(isSafeUuid("not-a-uuid")).toBe(false);
  });

  it("rejects oversized bodies before route work", () => {
    const request = new Request("https://sportmonitor.se/api/events", {
      method: "POST",
      headers: {
        "content-length": "9000",
        "x-forwarded-for": "203.0.113.10",
      },
    });

    const response = guardPublicApi(request, {
      key: "test-body",
      limit: 10,
      maxBodyBytes: 1024,
    });

    expect(response?.status).toBe(413);
  });

  it("returns 429 after a request window is exhausted", () => {
    const headers = { "x-forwarded-for": "203.0.113.11" };

    const first = guardPublicApi(
      new Request("https://sportmonitor.se/api/news", { headers }),
      { key: "test-rate", limit: 1, windowMs: 60_000 },
    );
    const second = guardPublicApi(
      new Request("https://sportmonitor.se/api/news", { headers }),
      { key: "test-rate", limit: 1, windowMs: 60_000 },
    );

    expect(first).toBeNull();
    expect(second?.status).toBe(429);
    expect(second?.headers.get("Retry-After")).toBeTruthy();
  });

  it("rejects invalid JSON and accepts JSON objects", async () => {
    const invalid = await readJsonObject<Record<string, unknown>>(
      new Request("https://sportmonitor.se/api/events", {
        method: "POST",
        body: "{",
      }),
      1024,
    );
    expect(invalid.ok).toBe(false);

    const valid = await readJsonObject<Record<string, unknown>>(
      new Request("https://sportmonitor.se/api/events", {
        method: "POST",
        body: JSON.stringify({ event_type: "news_click" }),
      }),
      1024,
    );
    expect(valid.ok).toBe(true);
  });
});
