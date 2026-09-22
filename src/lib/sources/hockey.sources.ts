/* ==========================================================================
   TYPES
   ========================================================================== */

export type HockeyCountry = "SE" | "US" | "CA" | "FI" | "unknown";

export type HockeyLeague =
  | "SHL"
  | "HockeyAllsvenskan"
  | "NHL"
  | "Liiga"
  | "unknown";

export type HockeySource = {
  id: string;
  name: string; // Ska matcha sourceProfiles.ts så nära som möjligt
  type: "rss";
  url: string;
  tags: string[];
  team?: string;
  country?: HockeyCountry;
  league?: HockeyLeague;
};

/* ==========================================================================
   SOURCE REGISTRY
   Endast sport-specifika och relativt säkra hockeyfeeds.
   Lokala generella tidnings-feeds är borttagna tills vi har säkra sport-url:er.
   ========================================================================== */

export const HOCKEY_SOURCES: HockeySource[] = [
  /* ========================================================================
     HOCKEYNEWS.SE
     ======================================================================== */

  {
    id: "hockeynews-shl",
    name: "HockeyNews – SHL",
    type: "rss",
    url: "https://hockeynews.se/rss/ligor/shl/feed.xml",
    tags: ["Hockey", "SHL", "Svenska Hockey"],
    league: "SHL",
    country: "SE",
  },
  {
    id: "hockeynews-allsvenskan",
    name: "HockeyNews – HockeyAllsvenskan",
    type: "rss",
    url: "https://hockeynews.se/rss/ligor/hockeyallsvenskan/feed.xml",
    tags: ["Hockey", "HockeyAllsvenskan", "Svenska Hockey"],
    league: "HockeyAllsvenskan",
    country: "SE",
  },
  {
    id: "hockeynews-nhl",
    name: "HockeyNews – NHL",
    type: "rss",
    url: "https://hockeynews.se/rss/ligor/nhl/feed.xml",
    tags: ["Hockey", "NHL", "Svenska Hockey"],
    league: "NHL",
    country: "SE",
  },
  {
    id: "hockeynews-all-news",
    name: "HockeyNews.se",
    type: "rss",
    url: "https://hockeynews.se/rss/nyheter/feed.xml",
    tags: ["Hockey", "Svenska Hockey"],
    country: "SE",
  },
  {
    id: "hockeynews-kalmar-hc",
    name: "HockeyNews – Kalmar HC",
    type: "rss",
    url: "https://hockeynews.se/rss/lag/kalmar-hc/feed.xml",
    tags: ["Hockey", "Kalmar HC", "HockeyAllsvenskan"],
    league: "HockeyAllsvenskan",
    country: "SE",
    team: "Kalmar HC",
  },
  {
    id: "hockeynews-nybro-vikings",
    name: "HockeyNews – Nybro Vikings",
    type: "rss",
    url: "https://hockeynews.se/rss/lag/nybro-vikings-if/feed.xml",
    tags: ["Hockey", "Nybro Vikings", "HockeyAllsvenskan"],
    league: "HockeyAllsvenskan",
    country: "SE",
    team: "Nybro Vikings",
  },

  /* ========================================================================
     SVENSKA NATIONELLA MEDIER
     ======================================================================== */

  {
    id: "svt-hockey",
    name: "SVT Sport",
    type: "rss",
    url: "https://www.svt.se/sport/ishockey/rss.xml",
    tags: ["Hockey", "SVT", "Svenska Hockey"],
    country: "SE",
  },
  {
    id: "aftonbladet-hockey",
    name: "Aftonbladet",
    type: "rss",
    url: "https://rss.aftonbladet.se/rss2/small/pages/sections/sportbladet/hockey/",
    tags: ["Hockey", "Aftonbladet"],
    country: "SE",
  },
  {
    id: "expressen-hockey",
    name: "Expressen – Hockey",
    type: "rss",
    url: "https://feeds.expressen.se/hockey",
    tags: ["Hockey", "Expressen"],
    country: "SE",
  },
  {
    id: "shl-officiell",
    name: "SHL (officiell)",
    type: "rss",
    url: "https://www.shl.se/api/articles/rss",
    tags: ["Hockey", "SHL"],
    league: "SHL",
    country: "SE",
  },
  {
    id: "kalmar-hc-officiell",
    name: "Kalmar HC (officiell)",
    type: "rss",
    url: "https://www.kalmarhockey.com/api/articles/rss",
    tags: ["Hockey", "Kalmar HC", "HockeyAllsvenskan"],
    league: "HockeyAllsvenskan",
    country: "SE",
    team: "Kalmar HC",
  },
  {
    id: "nybro-vikings-officiell",
    name: "Nybro Vikings (officiell)",
    type: "rss",
    url: "https://www.nybrovikings.com/api/articles/rss",
    tags: ["Hockey", "Nybro Vikings", "HockeyAllsvenskan"],
    league: "HockeyAllsvenskan",
    country: "SE",
    team: "Nybro Vikings",
  },
  {
    id: "barometern-sport-hockey",
    name: "Barometern Sport",
    type: "rss",
    url: "https://www.barometern.se/feeds/section/sport/feed.xml",
    tags: ["Sport", "Kalmar", "Lokalmedia"],
    country: "SE",
  },
  {
    id: "p4-kalmar-sporten-hockey",
    name: "P4 Kalmar Sporten",
    type: "rss",
    url: "https://api.sr.se/api/rss/program/86",
    tags: ["Sport", "Kalmar", "Public Service"],
    country: "SE",
  },

  /* ========================================================================
     INTERNATIONELLA KÄLLOR
     ======================================================================== */

  {
    id: "nhl-com-latest",
    name: "NHL.com",
    type: "rss",
    url: "https://www.nhl.com/feeds/latest-news.xml",
    tags: ["Hockey", "NHL", "Svenska spelare"],
    league: "NHL",
    country: "US",
  },
  {
    id: "sportsnet-nhl",
    name: "Sportsnet",
    type: "rss",
    url: "https://www.sportsnet.ca/hockey/nhl/feed/",
    tags: ["Hockey", "NHL"],
    league: "NHL",
    country: "CA",
  },
  {
    id: "the-hockey-writers-nhl",
    name: "The Hockey Writers – NHL",
    type: "rss",
    url: "https://thehockeywriters.com/feed/",
    tags: ["Hockey", "NHL"],
    league: "NHL",
    country: "US",
  },
  {
    id: "liiga-news",
    name: "Liiga.fi – Nyheter",
    type: "rss",
    url: "https://www.liiga.fi/rss/uutiset",
    tags: ["Hockey", "Liiga", "Svenska spelare"],
    league: "Liiga",
    country: "FI",
  },
];
