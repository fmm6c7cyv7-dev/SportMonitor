/* ==========================================================================
   TYPES
   ========================================================================== */

export type FootballCountry =
  | "SE"
  | "UK"
  | "IT"
  | "ES"
  | "DE"
  | "FR"
  | "PT"
  | "unknown";

export type FootballLeague =
  | "Allsvenskan"
  | "Superettan"
  | "Premier League"
  | "La Liga"
  | "Serie A"
  | "Bundesliga"
  | "unknown";

export type FootballSource = {
  id: string;
  name: string; // Ska matcha sourceProfiles.ts så nära som möjligt
  type: "rss";
  url: string;
  tags: string[];
  team?: string;
  country?: FootballCountry;
  league?: FootballLeague;
};

/* ==========================================================================
   SOURCE REGISTRY
   Endast sport-specifika och relativt säkra fotbollsfeeds.
   Källor med bekräftad 404/WAF i backend är temporärt borttagna från aktivt
   registry tills vi har fungerande endpoints.
   ========================================================================== */

export const FOOTBALL_SOURCES: FootballSource[] = [
  /* ========================================================================
     SVENSK FOTBOLL — NATIONELLT
     ======================================================================== */

  {
    id: "expressen-fotboll",
    name: "Expressen",
    type: "rss",
    url: "https://www.expressen.se/sport/fotboll/feed/",
    tags: ["Fotboll", "Svenska spelare"],
    country: "SE",
  },
  {
    id: "aftonbladet-fotboll",
    name: "Aftonbladet",
    type: "rss",
    url: "https://rss.aftonbladet.se/rss2/small/pages/sections/sportbladet/fotboll/",
    tags: ["Fotboll", "Svenska spelare"],
    country: "SE",
  },
  {
    id: "svt-fotboll",
    name: "SVT Sport",
    type: "rss",
    url: "https://www.svt.se/sport/fotboll/rss.xml",
    tags: ["Fotboll", "SVT"],
    country: "SE",
  },
  {
    id: "svenskafans-sverige",
    name: "SvenskaFans",
    type: "rss",
    url: "https://www.svenskafans.com/rss/site/2",
    tags: ["Fotboll", "Sverige", "Allsvenskan"],
    league: "Allsvenskan",
    country: "SE",
  },
  {
    id: "svenskafans-england",
    name: "SvenskaFans",
    type: "rss",
    url: "https://www.svenskafans.com/rss/site/3",
    tags: ["Fotboll", "England", "Premier League"],
    league: "Premier League",
    country: "SE",
  },
  {
    id: "svenskafans-italien",
    name: "SvenskaFans",
    type: "rss",
    url: "https://www.svenskafans.com/rss/site/4",
    tags: ["Fotboll", "Italien", "Serie A"],
    league: "Serie A",
    country: "SE",
  },
  {
    id: "svenskafans-spanien",
    name: "SvenskaFans",
    type: "rss",
    url: "https://www.svenskafans.com/rss/site/5",
    tags: ["Fotboll", "Spanien", "La Liga"],
    league: "La Liga",
    country: "SE",
  },
  {
    id: "svenskafans-vasteras-sk",
    name: "SvenskaFans",
    type: "rss",
    url: "https://www.svenskafans.com/rss/team/102",
    tags: ["Fotboll", "Västerås SK", "VSK"],
    league: "Allsvenskan",
    country: "SE",
  },
  {
    id: "pressgurkan",
    name: "Pressgurkan",
    type: "rss",
    url: "https://pressgurkan.se/feed/",
    tags: ["Fotboll", "Hammarby"],
    country: "SE",
    league: "Allsvenskan",
  },
  {
    id: "kalmar-ff-officiell",
    name: "Kalmar FF (officiell)",
    type: "rss",
    url: "https://kalmarff.se/nyheter/feed/",
    tags: ["Fotboll", "Kalmar FF", "Allsvenskan"],
    league: "Allsvenskan",
    country: "SE",
    team: "Kalmar FF",
  },
  {
    id: "barometern-sport",
    name: "Barometern Sport",
    type: "rss",
    url: "https://www.barometern.se/feeds/section/sport/feed.xml",
    tags: ["Sport", "Kalmar", "Lokalmedia"],
    country: "SE",
  },
  {
    id: "barometern-kalmar-ff",
    name: "Barometern – Kalmar FF",
    type: "rss",
    url: "https://www.barometern.se/feeds/section/kalmar-ff/feed.xml",
    tags: ["Fotboll", "Kalmar FF", "Allsvenskan", "Lokalmedia"],
    league: "Allsvenskan",
    country: "SE",
    team: "Kalmar FF",
  },
  {
    id: "bollsvenskan-kalmar-ff",
    name: "Bollsvenskan – Kalmar FF",
    type: "rss",
    url: "https://bollsvenskan.se/feed/kalmar-ff",
    tags: ["Fotboll", "Kalmar FF", "Allsvenskan"],
    league: "Allsvenskan",
    country: "SE",
    team: "Kalmar FF",
  },
  {
    id: "p4-kalmar-sporten",
    name: "P4 Kalmar Sporten",
    type: "rss",
    url: "https://api.sr.se/api/rss/program/86",
    tags: ["Sport", "Kalmar", "Public Service"],
    country: "SE",
  },

  /* ========================================================================
     ENGLAND
     ======================================================================== */

  {
    id: "bbc-football",
    name: "BBC Sport",
    type: "rss",
    url: "https://feeds.bbci.co.uk/sport/football/rss.xml",
    tags: ["Football", "Premier League"],
    league: "Premier League",
    country: "UK",
  },
  {
    id: "skysports-football",
    name: "Sky Sports",
    type: "rss",
    url: "https://www.skysports.com/rss/12040",
    tags: ["Football", "Premier League", "Transfers"],
    league: "Premier League",
    country: "UK",
  },
  {
    id: "caughtoffside",
    name: "CaughtOffside",
    type: "rss",
    url: "https://www.caughtoffside.com/feed/",
    tags: ["Football", "Transfers", "Premier League"],
    league: "Premier League",
    country: "UK",
  },
  {
    id: "90min-football",
    name: "90min",
    type: "rss",
    url: "https://www.90min.com/posts.rss",
    tags: ["Football", "Premier League"],
    league: "Premier League",
    country: "UK",
  },
  {
    id: "manchester-evening-news-united",
    name: "Manchester Evening News",
    type: "rss",
    url: "https://www.manchestereveningnews.co.uk/all-about/manchester%20united%20fc?service=rss",
    tags: ["Football", "Manchester United"],
    league: "Premier League",
    country: "UK",
    team: "Manchester United",
  },
  {
    id: "manchester-evening-news-city",
    name: "Manchester Evening News",
    type: "rss",
    url: "https://www.manchestereveningnews.co.uk/all-about/manchester%20city%20fc?service=rss",
    tags: ["Football", "Manchester City"],
    league: "Premier League",
    country: "UK",
    team: "Manchester City",
  },
  {
    id: "chroniclelive-newcastle",
    name: "ChronicleLive",
    type: "rss",
    url: "https://www.chroniclelive.co.uk/all-about/newcastle%20united%20fc?service=rss",
    tags: ["Football", "Newcastle United"],
    league: "Premier League",
    country: "UK",
    team: "Newcastle United",
  },
  {
    id: "this-is-anfield",
    name: "This is Anfield",
    type: "rss",
    url: "https://www.thisisanfield.com/feed/",
    tags: ["Football", "Liverpool"],
    league: "Premier League",
    country: "UK",
    team: "Liverpool",
  },
  {
    id: "the-mag",
    name: "The Mag",
    type: "rss",
    url: "https://www.themag.co.uk/feed/",
    tags: ["Football", "Newcastle United"],
    league: "Premier League",
    country: "UK",
    team: "Newcastle United",
  },
  {
    id: "arseblog",
    name: "Arseblog",
    type: "rss",
    url: "https://arseblog.com/feed/",
    tags: ["Football", "Arsenal"],
    league: "Premier League",
    country: "UK",
    team: "Arsenal",
  },

  /* ========================================================================
     ITALIEN
     ======================================================================== */

  {
    id: "football-italia",
    name: "Football Italia",
    type: "rss",
    url: "https://football-italia.net/feed/",
    tags: ["Football", "Serie A"],
    league: "Serie A",
    country: "IT",
  },
  {
    id: "cult-of-calcio",
    name: "Cult of Calcio",
    type: "rss",
    url: "https://cultofcalcio.com/feed/",
    tags: ["Football", "Serie A"],
    league: "Serie A",
    country: "IT",
  },
  {
    id: "gazzetta",
    name: "Gazzetta dello Sport",
    type: "rss",
    url: "https://www.gazzetta.it/rss/calcio.xml",
    tags: ["Football", "Serie A"],
    league: "Serie A",
    country: "IT",
  },

  /* ========================================================================
     SPANIEN
     ======================================================================== */

  {
    id: "football-espana",
    name: "Football España",
    type: "rss",
    url: "https://www.football-espana.net/feed",
    tags: ["Football", "La Liga"],
    league: "La Liga",
    country: "ES",
  },
  {
    id: "marca",
    name: "Marca",
    type: "rss",
    url: "https://e00-marca.uecdn.es/rss/futbol/primera-division.xml",
    tags: ["Football", "La Liga"],
    league: "La Liga",
    country: "ES",
  },
  {
    id: "managing-madrid",
    name: "Managing Madrid",
    type: "rss",
    url: "https://www.managingmadrid.com/rss/current.xml",
    tags: ["Football", "La Liga", "Real Madrid"],
    league: "La Liga",
    country: "ES",
    team: "Real Madrid",
  },
  {
    id: "barca-blaugranes",
    name: "Barca Blaugranes",
    type: "rss",
    url: "https://www.barcablaugranes.com/rss/current.xml",
    tags: ["Football", "La Liga", "Barcelona"],
    league: "La Liga",
    country: "ES",
    team: "Barcelona",
  },

  /* ========================================================================
     TYSKLAND
     ======================================================================== */

  {
    id: "bundesliga-live",
    name: "Bundesliga Live",
    type: "rss",
    url: "https://bundesligalive.com/feed/",
    tags: ["Football", "Bundesliga"],
    league: "Bundesliga",
    country: "DE",
  },
  {
    id: "bundesliga-fan",
    name: "Bundesliga Fan",
    type: "rss",
    url: "https://bundesligafan.com/feed/",
    tags: ["Football", "Bundesliga"],
    league: "Bundesliga",
    country: "DE",
  },
  {
    id: "bavarian-football-works",
    name: "Bavarian Football Works",
    type: "rss",
    url: "https://www.bavarianfootballworks.com/rss/current.xml",
    tags: ["Football", "Bundesliga", "Bayern Munich"],
    league: "Bundesliga",
    country: "DE",
    team: "Bayern Munich",
  },
  {
    id: "get-german-football-news",
    name: "Get Football News Germany",
    type: "rss",
    url: "https://www.getfootballnewsgermany.com/bundesliga/feed/",
    tags: ["Football", "Bundesliga"],
    league: "Bundesliga",
    country: "DE",
  },

  /* ========================================================================
     PORTUGAL
     ======================================================================== */

  {
    id: "portugoal",
    name: "PortuGOAL",
    type: "rss",
    url: "https://portugoal.net/?format=feed&type=rss",
    tags: ["Football", "Primeira Liga", "Gyökeres"],
    country: "PT",
  },

  /* ========================================================================
     FRANKRIKE
     ======================================================================== */

  {
    id: "get-french-football-news",
    name: "Get French Football News",
    type: "rss",
    url: "https://www.getfootballnewsfrance.com/feed/",
    tags: ["Football", "Ligue 1"],
    country: "FR",
  },
];
