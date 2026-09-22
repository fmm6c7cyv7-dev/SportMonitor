import { readFileSync } from "node:fs";
import path from "node:path";

const REQUIRED_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
  "INGEST_SECRET",
  "FAVORITE_AUDIT_SECRET",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "TOP_RSS_URL",
  "TOP_MAX_AGE_HOURS",
] as const;

describe(".env.example", () => {
  it("is explicitly unignored and contains only blank required assignments", () => {
    const gitignore = readFileSync(path.resolve(process.cwd(), ".gitignore"), "utf8");
    const gitignoreLines = gitignore.split(/\r?\n/);
    const envIgnoreIndex = gitignoreLines.indexOf(".env*");

    expect(envIgnoreIndex).toBeGreaterThanOrEqual(0);
    expect(gitignoreLines[envIgnoreIndex + 1]).toBe("!.env.example");

    const envExample = readFileSync(
      path.resolve(process.cwd(), ".env.example"),
      "utf8",
    );
    const entries = envExample.split(/\r?\n/).filter(Boolean);
    const keys = entries.map((entry) => {
      expect(entry).toMatch(/^([A-Z][A-Z0-9_]*)=$/);
      return entry.slice(0, -1);
    });

    expect(new Set(keys)).toEqual(new Set(REQUIRED_ENV_KEYS));
  });
});
