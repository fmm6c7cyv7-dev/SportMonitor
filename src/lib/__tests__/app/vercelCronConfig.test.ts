import { readFileSync } from "node:fs";
import path from "node:path";

type VercelCronConfig = {
  crons?: Array<{
    path?: string;
    schedule?: string;
  }>;
};

describe("vercel cron config", () => {
  it("does not define ingest cron jobs because Supabase pg_cron owns scheduling", () => {
    const filePath = path.resolve(process.cwd(), "vercel.json");
    const raw = readFileSync(filePath, "utf8");
    const config = JSON.parse(raw) as VercelCronConfig;

    const ingestCrons = (config.crons ?? []).filter(
      (cron) => typeof cron.path === "string" && cron.path.startsWith("/api/ingest"),
    );

    expect(ingestCrons).toEqual([]);
  });
});
