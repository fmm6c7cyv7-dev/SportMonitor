import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

type Sport = "football" | "hockey";
type EntityType = "player" | "team" | "league";
type EntityRow = {
  sport: Sport;
  type: EntityType;
  name: string;
  slug: string;
  active: boolean;
};

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function slugify(str: string) {
  return (str ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function readCsv(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath} (pwd=${process.cwd()})`);
  }

  const csv = fs.readFileSync(filePath, "utf8");
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) throw new Error(`CSV seems empty: ${filePath}`);

  const header = lines[0]!.split(",").map((x) => x.trim());
  const rows = lines.slice(1).map((line) => line.split(",").map((x) => x.trim()));

  return { header, rows };
}

function idxOf(header: string[], name: string) {
  const i = header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  if (i < 0) throw new Error(`CSV header missing "${name}". Found: ${header.join(", ")}`);
  return i;
}

function pushEntity(map: Map<string, EntityRow>, sport: Sport, type: EntityType, name: string) {
  const n = (name ?? "").trim();
  if (!n) return;

  const slug = slugify(n);
  if (!slug) return;

  const key = `${sport}:${type}:${slug}`;
  if (map.has(key)) return;

  map.set(key, {
    sport,
    type,
    name: n,
    slug,
    active: true,
  });
}

function parseAliases(raw: string) {
  // "A|B|C" => ["A","B","C"] (unika, rimlig längd)
  const parts = (raw ?? "")
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (p.length < 2) continue;
    if (out.some((x) => x.toLowerCase() === k)) continue;
    out.push(p);
  }
  return out;
}

async function run() {
  console.log("seed-entities: start");

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  console.log("env ok");

  const entities = new Map<string, EntityRow>();

  // -----------------------------
  // 1) Football leagues list
  // -----------------------------
  {
    const leaguesPath = "./src/data/leagues.csv";
    if (fs.existsSync(leaguesPath)) {
      const { header, rows } = readCsv(leaguesPath);
      const iLeague = idxOf(header, "Liga");

      for (const cols of rows) {
        const league = cols[iLeague] ?? "";
        pushEntity(entities, "football", "league", league);
      }

      console.log(`leagues.csv: ok (${rows.length} rows)`);
    } else {
      console.log("leagues.csv: skip (file missing)");
    }
  }

  // -----------------------------
  // 2) Football teams list
  // -----------------------------
  {
    const teamsPath = "./src/data/teams.csv";
    if (fs.existsSync(teamsPath)) {
      const { header, rows } = readCsv(teamsPath);
      const iClub = idxOf(header, "Klubb");
      const iLeague = header.findIndex((h) => h.toLowerCase() === "liga"); // optional

      for (const cols of rows) {
        const club = cols[iClub] ?? "";
        const league = iLeague >= 0 ? (cols[iLeague] ?? "") : "";

        pushEntity(entities, "football", "team", club);
        if (league) pushEntity(entities, "football", "league", league);
      }

      console.log(`teams.csv: ok (${rows.length} rows)`);
    } else {
      console.log("teams.csv: skip (file missing)");
    }
  }

  // -----------------------------
  // 3) Football swedes abroad players
  // -----------------------------
  {
    const swedesPath = "./src/data/swedes_abroad.csv";
    const { header, rows } = readCsv(swedesPath);

    const iFirst = idxOf(header, "Förnamn");
    const iLast = idxOf(header, "Efternamn");
    const iNick = header.findIndex((h) => h.toLowerCase() === "smeknamn"); // optional
    const iLeague = idxOf(header, "Liga");
    const iClub = idxOf(header, "Klubb");

    for (const cols of rows) {
      const first = cols[iFirst] ?? "";
      const last = cols[iLast] ?? "";
      const nick = iNick >= 0 ? (cols[iNick] ?? "") : "";
      const league = cols[iLeague] ?? "";
      const club = cols[iClub] ?? "";

      const fullName = `${first} ${last}`.replace(/\s+/g, " ").trim();

      pushEntity(entities, "football", "player", fullName);

      if (nick && nick.trim().length >= 3) {
        pushEntity(entities, "football", "player", nick.trim());
      }

      pushEntity(entities, "football", "team", club);
      pushEntity(entities, "football", "league", league);
    }

    console.log(`swedes_abroad.csv: ok (${rows.length} rows)`);
  }

  // =========================================================
  // HOCKEY
  // =========================================================

  // -----------------------------
  // 4) Hockey teams (SHL + HockeyAllsvenskan)
  // -----------------------------
  {
    const hockeyTeamsPath = "./src/data/hockey_teams.csv";
    if (fs.existsSync(hockeyTeamsPath)) {
      const { header, rows } = readCsv(hockeyTeamsPath);

      const iClub = idxOf(header, "Klubb");
      const iLeague = header.findIndex((h) => h.toLowerCase() === "liga"); // optional
      const iAlias = header.findIndex((h) => h.toLowerCase() === "search_alias"); // optional

      for (const cols of rows) {
        const club = cols[iClub] ?? "";
        const league = iLeague >= 0 ? (cols[iLeague] ?? "") : "";
        const aliasRaw = iAlias >= 0 ? (cols[iAlias] ?? "") : "";

        // primary team entity
        pushEntity(entities, "hockey", "team", club);

        // ensure league exists too
        if (league) pushEntity(entities, "hockey", "league", league);

        // alias as extra team-entities (makes "FBK", "DIF", "SSK", "VIK" searchable)
        const aliases = parseAliases(aliasRaw);
        for (const a of aliases) {
          // undvik att skapa alias som exakt samma namn
          if (a.trim().toLowerCase() === club.trim().toLowerCase()) continue;
          pushEntity(entities, "hockey", "team", a);
        }
      }

      console.log(`hockey_teams.csv: ok (${rows.length} rows)`);
    } else {
      console.log("hockey_teams.csv: skip (file missing)");
    }
  }

  // -----------------------------
  // 5) Hockey Swedish players in NHL (and their teams)
  // -----------------------------
  {
    const nhlSwedesPath = "./src/data/hockey_swedes_nhl.csv";
    if (fs.existsSync(nhlSwedesPath)) {
      const { header, rows } = readCsv(nhlSwedesPath);

      const iFirst = idxOf(header, "Förnamn");
      const iLast = idxOf(header, "Efternamn");
      const iLeague = idxOf(header, "Liga");
      const iClub = idxOf(header, "Klubb");

      for (const cols of rows) {
        const first = cols[iFirst] ?? "";
        const last = cols[iLast] ?? "";
        const league = cols[iLeague] ?? "";
        const club = cols[iClub] ?? "";

        const fullName = `${first} ${last}`.replace(/\s+/g, " ").trim();

        pushEntity(entities, "hockey", "player", fullName);
        pushEntity(entities, "hockey", "team", club);
        pushEntity(entities, "hockey", "league", league);
      }

      console.log(`hockey_swedes_nhl.csv: ok (${rows.length} rows)`);
    } else {
      console.log("hockey_swedes_nhl.csv: skip (file missing)");
    }
  }

  const rows = [...entities.values()];
  console.log(`prepared total entities: ${rows.length}`);

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { error } = await supabase.from("entities").upsert(rows, {
    onConflict: "sport,type,slug",
  });

  if (error) {
    console.error("supabase upsert error:", error);
    process.exitCode = 1;
    return;
  }

  console.log("seed-entities: done");
}

run().catch((e) => {
  console.error("seed-entities: fatal", e);
  process.exit(1);
});