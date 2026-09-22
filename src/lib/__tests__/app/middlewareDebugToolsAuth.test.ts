import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function createRequest(pathname: string, secret?: string): NextRequest {
  const headers = new Headers();

  if (secret) {
    headers.set("authorization", ["Bearer", secret].join(" "));
  }

  return new NextRequest(`http://localhost${pathname}`, { headers });
}

describe("debug-tools middleware auth", () => {
  beforeEach(() => {
    process.env.FAVORITE_AUDIT_SECRET = "admin-secret";
  });

  it("returns 401 for /debug-tools without auth", async () => {
    const response = await proxy(createRequest("/debug-tools"));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Basic realm=");
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unauthorized",
    });
  });

  it("allows /debug-tools when auth header is valid", async () => {
    const response = await proxy(
      createRequest("/debug-tools", "admin-secret"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("does not intercept non-debug routes", async () => {
    const response = await proxy(createRequest("/api/news"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
