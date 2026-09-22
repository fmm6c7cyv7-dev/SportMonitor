// src/lib/ingest/sourceRegistry.ts

import { FOOTBALL_SOURCES } from "@/lib/sources/football.sources";
import { HOCKEY_SOURCES } from "@/lib/sources/hockey.sources";

/* ==========================================================================
   TYPES
   ========================================================================== */

export type Sport = "football" | "hockey";
export type FeedType = "rss" | "scrape";
export type ScrapeSource = "anno1904" | "vskherrlag" | "olandsbladetKalmarFF";

export type FeedDef = {
  sport: Sport;
  name: string; // fallback source-namn
  url: string; // rss-url eller canonical scrape-url
  weight: number; // käll-prioritet (högre = bättre)
  type?: FeedType;
  scrapeSource?: ScrapeSource;
};

/* ==========================================================================
   CURATED FEEDS
   Handtrimmade feeds som får företräde vid merge.

   OBS:
   SvenskaFans-feeds är officiella och korrekta som länkar, men de är
   temporärt avstängda i aktiv server-ingest eftersom de just nu returnerar
   CloudFront/WAF challenge i stället för användbar RSS till backend-fetchen.
   De kan återaktiveras senare utan att URL:erna behöver ändras.
   ========================================================================== */

const CURATED_FEEDS: FeedDef[] = [
  // --- SVERIGE & GRUNDFLÖDEN ---
  {
    sport: "football",
    name: "SVT Sport – Fotboll",
    url: "https://www.svt.se/sport/fotboll/rss.xml",
    weight: 5,
    type: "rss",
  },
  {
    sport: "football",
    name: "Aftonbladet – Fotboll",
    url: "https://rss.aftonbladet.se/rss2/small/pages/sections/sportbladet/fotboll/",
    weight: 4,
    type: "rss",
  },
  {
    sport: "football",
    name: "SvenskaFans – Sverige",
    url: "https://www.svenskafans.com/rss/site/2",
    weight: 4,
    type: "rss",
  },
  {
    sport: "football",
    name: "SvenskaFans – England",
    url: "https://www.svenskafans.com/rss/site/3",
    weight: 4,
    type: "rss",
  },
  {
    sport: "football",
    name: "SvenskaFans – Italien",
    url: "https://www.svenskafans.com/rss/site/4",
    weight: 4,
    type: "rss",
  },
  {
    sport: "football",
    name: "SvenskaFans – Spanien",
    url: "https://www.svenskafans.com/rss/site/5",
    weight: 4,
    type: "rss",
  },
  {
    sport: "football",
    name: "SvenskaFans – Västerås SK",
    url: "https://www.svenskafans.com/rss/team/102",
    weight: 5,
    type: "rss",
  },
  {
    sport: "football",
    name: "Pressgurkan",
    url: "https://pressgurkan.se/feed/",
    weight: 5,
    type: "rss",
  },
  {
    sport: "football",
    name: "ANNO 1904",
    url: "https://www.anno1904.se/tag/herrfotboll/",
    weight: 5,
    type: "scrape",
    scrapeSource: "anno1904",
  },
  {
    sport: "football",
    name: "VSK Fotboll",
    url: "https://www.vskfotboll.nu/nyheter/herrlag/",
    weight: 5,
    type: "scrape",
    scrapeSource: "vskherrlag",
  },
  {
    sport: "football",
    name: "Ölandsbladet – Kalmar FF",
    url: "https://www.olandsbladet.se/organisation/cdfdee1b-c997-38cc-950b-c28ac89d6eff?pageSlug=kalmar-ff",
    weight: 4,
    type: "scrape",
    scrapeSource: "olandsbladetKalmarFF",
  },

  // --- ITALIEN (SERIE A) ---
  {
    sport: "football",
    name: "Football Italia",
    url: "https://football-italia.net/feed/",
    weight: 4,
    type: "rss",
  },
  {
    sport: "football",
    name: "Cult of Calcio",
    url: "https://cultofcalcio.com/feed/",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "CaughtOffside – Juventus",
    url: "https://www.caughtoffside.com/tags/serie-a/juventus/feed/",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "Black & White & Read All Over",
    url: "https://www.blackwhitereadallover.com/rss/current.xml",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "JuveFC",
    url: "https://www.juvefc.com/feed/",
    weight: 3,
    type: "rss",
  },

  // --- ENGLAND (PREMIER LEAGUE) ---
  {
    sport: "football",
    name: "My Old Man Said",
    url: "https://myoldmansaid.com/feed/",
    weight: 4,
    type: "rss",
  },
  {
    sport: "football",
    name: "A Villa Fan",
    url: "https://www.avillafan.com/feed/",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "CaughtOffside",
    url: "https://www.caughtoffside.com/feed/",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "Man Utd Official",
    url: "https://www.manutd.com/Feeds/NewsRSSFeed",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "Manchester Evening News – Manchester United",
    url: "https://www.manchestereveningnews.co.uk/all-about/manchester%20united%20fc?service=rss",
    weight: 4,
    type: "rss",
  },
  {
    sport: "football",
    name: "Manchester Evening News – Manchester City",
    url: "https://www.manchestereveningnews.co.uk/all-about/manchester%20city%20fc?service=rss",
    weight: 4,
    type: "rss",
  },
  {
    sport: "football",
    name: "ChronicleLive – Newcastle United",
    url: "https://www.chroniclelive.co.uk/all-about/newcastle%20united%20fc?service=rss",
    weight: 4,
    type: "rss",
  },
  {
    sport: "football",
    name: "Liverpool Echo – Liverpool FC",
    url: "https://www.liverpoolecho.co.uk/all-about/liverpool-fc?service=rss",
    weight: 4,
    type: "rss",
  },
  {
    sport: "football",
    name: "Man City News",
    url: "https://mancitynews.com/feed/",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "Arseblog",
    url: "https://arseblog.com/feed/",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "Talk Chelsea",
    url: "https://www.talkchelsea.net/feed/",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "This is Anfield",
    url: "https://www.thisisanfield.com/feed/",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "The Mag",
    url: "https://www.themag.co.uk/feed/",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "West Ham News",
    url: "https://feeds.feedburner.com/WestHamUnitedFootballClub-LatestHammersNews",
    weight: 3,
    type: "rss",
  },

  // --- FRANKRIKE (LIGUE 1) ---
  {
    sport: "football",
    name: "Get French Football News",
    url: "https://www.getfootballnewsfrance.com/feed/",
    weight: 4,
    type: "rss",
  },
  {
    sport: "football",
    name: "PSG Talk",
    url: "https://psgtalk.com/feed/",
    weight: 3,
    type: "rss",
  },

  // --- SPANIEN (LA LIGA) ---
  {
    sport: "football",
    name: "Football España",
    url: "https://www.football-espana.net/feed",
    weight: 4,
    type: "rss",
  },
  {
    sport: "football",
    name: "Marca (English) – La Liga",
    url: "https://e00-marca.uecdn.es/rss/en/football/spanish-football.xml",
    weight: 4,
    type: "rss",
  },
  {
    sport: "football",
    name: "Managing Madrid",
    url: "https://www.managingmadrid.com/rss/current.xml",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "Barca Blaugranes",
    url: "https://www.barcablaugranes.com/rss/current.xml",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "Real Madrid News",
    url: "http://www.realmadridnews.com/feed",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "La Liga Blog",
    url: "http://laligablog.com/feed/",
    weight: 3,
    type: "rss",
  },

  // --- PORTUGAL (PRIMEIRA LIGA) ---
  {
    sport: "football",
    name: "PortuGOAL",
    url: "https://portugoal.net/?format=feed&type=rss",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "The Portugal News – Sports",
    url: "https://www.theportugalnews.com/rss/sport",
    weight: 3,
    type: "rss",
  },

  // --- TYSKLAND (BUNDESLIGA) ---
  {
    sport: "football",
    name: "Bundesliga (Officiell)",
    url: "https://www.bundesliga.com/rss/en/rss_news.xml",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "SoccerNews – Bundesliga",
    url: "https://www.soccernews.com/category/bundesliga/feed/",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "Bavarian Football Works",
    url: "https://www.bavarianfootballworks.com/rss/current.xml",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "Get German Football News",
    url: "https://www.getfootballnewsgermany.com/bundesliga/feed/",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "Bundesliga Live",
    url: "https://bundesligalive.com/feed/",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "Bundesliga Fan",
    url: "https://bundesligafan.com/feed/",
    weight: 3,
    type: "rss",
  },

  // --- NEDERLÄNDERNA (EREDIVISIE) ---
  {
    sport: "football",
    name: "Eredivisie (Officiell)",
    url: "https://eredivisie.nl/cache/site/EredivisieNL/esi/feeds/news.rss?cache_control=1&cache_seconds=812&cache_tags%5B0%5D=news",
    weight: 4,
    type: "rss",
  },
  {
    sport: "football",
    name: "Football Oranje",
    url: "https://www.football-oranje.com/feed/",
    weight: 3,
    type: "rss",
  },
  {
    sport: "football",
    name: "Dutch Review – Sports",
    url: "https://dutchreview.com/category/news/sports/feed/",
    weight: 3,
    type: "rss",
  },

  // --- HOCKEY ---
  {
    sport: "hockey",
    name: "SVT Sport – Hockey",
    url: "https://www.svt.se/sport/ishockey/rss.xml",
    weight: 4,
    type: "rss",
  },
  {
    sport: "hockey",
    name: "HockeyNews – SHL",
    url: "https://hockeynews.se/rss/ligor/shl/feed.xml",
    weight: 4,
    type: "rss",
  },
  {
    sport: "hockey",
    name: "HockeyNews – HockeyAllsvenskan",
    url: "https://hockeynews.se/rss/ligor/hockeyallsvenskan/feed.xml",
    weight: 4,
    type: "rss",
  },
  {
    sport: "hockey",
    name: "HockeyNews – NHL",
    url: "https://hockeynews.se/rss/ligor/nhl/feed.xml",
    weight: 3,
    type: "rss",
  },
  {
    sport: "hockey",
    name: "Aftonbladet – Hockey",
    url: "https://rss.aftonbladet.se/rss2/small/pages/sections/sportbladet/hockey/",
    weight: 4,
    type: "rss",
  },
  {
    sport: "hockey",
    name: "SHL (officiell)",
    url: "https://www.shl.se/api/articles/rss",
    weight: 5,
    type: "rss",
  },
  {
    sport: "hockey",
    name: "Expressen – Hockey",
    url: "https://feeds.expressen.se/hockey",
    weight: 3,
    type: "rss",
  },
  {
    sport: "hockey",
    name: "Sportsnet – NHL",
    url: "https://www.sportsnet.ca/hockey/nhl/feed/",
    weight: 3,
    type: "rss",
  },
  {
    sport: "hockey",
    name: "The Hockey Writers – NHL",
    url: "https://thehockeywriters.com/feed/",
    weight: 3,
    type: "rss",
  },
  {
    sport: "hockey",
    name: "Yahoo Sports – NHL",
    url: "https://sports.yahoo.com/nhl/rss/",
    weight: 3,
    type: "rss",
  },
  {
    sport: "hockey",
    name: "Superstars (Leksand)",
    url: "https://rssgenerator.mooo.com/feeds/?p=aaHR0cHM6Ly93d3cuc3VwZXJzdGFycy5udS8=",
    weight: 4,
    type: "rss",
  },
];

/* ==========================================================================
   SOURCE ADAPTERS
   feeds.ts ska bara mappa sources -> FeedDef.
   Semantisk prioritering hör egentligen hemma längre ned i ingest/ranking.
   ========================================================================== */

const DEFAULT_SOURCE_WEIGHT = 3;

type SourceLike = {
  type: string;
  name: string;
  url: string;
};

function mapSourcesToFeeds(sport: Sport, sources: SourceLike[]): FeedDef[] {
  return sources
    .filter((source) => source.type === "rss")
    .map((source) => ({
      name: source.name,
      sport,
      url: source.url,
      weight: DEFAULT_SOURCE_WEIGHT,
      type: "rss" as const,
    }));
}

const FOOTBALL_FEEDS_FROM_SOURCES: FeedDef[] = mapSourcesToFeeds(
  "football",
  FOOTBALL_SOURCES,
);

const HOCKEY_FEEDS_FROM_SOURCES: FeedDef[] = mapSourcesToFeeds(
  "hockey",
  HOCKEY_SOURCES,
);

/* ==========================================================================
   FILTER / MERGE HELPERS
   Curated feeds får företräde om samma URL finns i source-registry också.
   ========================================================================== */

function getFeedHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isBlockedSvenskaFansFeed(feed: FeedDef): boolean {
  return getFeedHostname(feed.url).includes("svenskafans.com");
}

function normalizeFeedUrlForDedup(url: string): string {
  const fallback = String(url ?? "").trim().replace(/\/+$/, "").toLowerCase();

  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();

    if (
      parsed.hostname === "pressgurkan.se" ||
      parsed.hostname === "www.pressgurkan.se"
    ) {
      parsed.protocol = "https:";
    }

    if (parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }

    return parsed.toString();
  } catch {
    return fallback;
  }
}

function filterActiveFeeds(feeds: FeedDef[]): FeedDef[] {
  return feeds.filter((feed) => !isBlockedSvenskaFansFeed(feed));
}

function mergeFeedsPreferCurated(
  curated: FeedDef[],
  discovered: FeedDef[],
): FeedDef[] {
  const mergedFeeds: FeedDef[] = [];
  const seen = new Set<string>();

  for (const feed of curated) {
    const dedupeKey = `${feed.sport}:${normalizeFeedUrlForDedup(feed.url)}`;
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    mergedFeeds.push(feed);
  }

  for (const feed of discovered) {
    const dedupeKey = `${feed.sport}:${normalizeFeedUrlForDedup(feed.url)}`;
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    mergedFeeds.push(feed);
  }

  return mergedFeeds;
}

/* ==========================================================================
   FINAL EXPORTS
   ========================================================================== */

const ACTIVE_CURATED_FEEDS = filterActiveFeeds(CURATED_FEEDS);

const ACTIVE_DISCOVERED_FEEDS = filterActiveFeeds([
  ...FOOTBALL_FEEDS_FROM_SOURCES,
  ...HOCKEY_FEEDS_FROM_SOURCES,
]);

export const FEEDS: FeedDef[] = mergeFeedsPreferCurated(
  ACTIVE_CURATED_FEEDS,
  ACTIVE_DISCOVERED_FEEDS,
);
