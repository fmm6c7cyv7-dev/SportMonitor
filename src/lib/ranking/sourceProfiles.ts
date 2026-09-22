// src/lib/ranking/sourceProfiles.ts

/**
 * SportMonitor – Source Profiles
 *
 * Denna fil definierar källornas redaktionella profil.
 * Viktigt:
 * - sportspecifika källor ska normalt inte kräva hård sportverifiering
 * - breda/lokala/generalistkällor ska oftare kräva sportverifiering
 * - alias ska hanteras explicit, inte bara via partial match
 */

export type Sport = "football" | "hockey";

export type SourceCountry =
  | "se"
  | "uk"
  | "it"
  | "de"
  | "es"
  | "fr"
  | "us"
  | "ca"
  | "pt"
  | "other";

export type SourceProfileCategory =
  | "official_local"
  | "local_media"
  | "public_service_local"
  | "aggregator_team_feed"
  | "fan_community";

export type SourceProfile = {
  source: string;
  authority: number;
  country: SourceCountry;
  sports: Sport[];
  sourceCategory?: SourceProfileCategory;
  strengths?: string[];
  tags?: string[];
  requiresSportVerification?: boolean;
  trustFeedSport?: boolean;
};

export type SourceRegionalEligibility = {
  scope: "global" | "regional";
  regionKey: string | null;
  favoriteEligible: boolean;
  favoriteEntityIds: string[];
  favoriteTokens: string[];
};

type SourceRegionalEligibilityInput = {
  scope: "regional";
  regionKey: string;
  favoriteEligible?: boolean;
  favoriteEntityIds?: string[];
  favoriteTokens?: string[];
};

/* ==========================================================================
   SOURCE PROFILES
   ========================================================================== */

export const SOURCE_PROFILES: Record<string, SourceProfile> = {
  /* ========================================================================
     UK / INTERNATIONAL FOOTBALL
     ======================================================================== */

  "BBC Sport": {
    source: "BBC Sport",
    authority: 0.95,
    country: "uk",
    sports: ["football"],
    strengths: ["premier_league", "fa_cup", "championship"],
    trustFeedSport: true,
  },

  "The Athletic": {
    source: "The Athletic",
    authority: 0.95,
    country: "uk",
    sports: ["football", "hockey"],
    strengths: ["premier_league", "nhl"],
  },

  "Sky Sports": {
    source: "Sky Sports",
    authority: 0.9,
    country: "uk",
    sports: ["football"],
    strengths: ["premier_league", "transfers"],
    trustFeedSport: true,
  },

  "Guardian Sport": {
    source: "Guardian Sport",
    authority: 0.88,
    country: "uk",
    sports: ["football"],
    strengths: ["premier_league", "championship"],
    trustFeedSport: true,
  },

  CaughtOffside: {
    source: "CaughtOffside",
    authority: 0.62,
    country: "uk",
    sports: ["football"],
    strengths: ["premier_league", "transfers"],
    trustFeedSport: true,
  },

  Football365: {
    source: "Football365",
    authority: 0.65,
    country: "uk",
    sports: ["football"],
    strengths: ["premier_league"],
    trustFeedSport: true,
  },

  "Football Talk": {
    source: "Football Talk",
    authority: 0.58,
    country: "uk",
    sports: ["football"],
    strengths: ["premier_league"],
    trustFeedSport: true,
  },

  "90min": {
    source: "90min",
    authority: 0.62,
    country: "uk",
    sports: ["football"],
    strengths: ["premier_league", "transfers"],
    trustFeedSport: true,
  },

  PortuGOAL: {
    source: "PortuGOAL",
    authority: 0.75,
    country: "pt",
    sports: ["football"],
    strengths: ["swedish_players"],
    trustFeedSport: true,
  },

  /* ========================================================================
     CLUB-SPECIFIC UK OUTLETS
     ======================================================================== */

  ChronicleLive: {
    source: "ChronicleLive",
    authority: 0.6,
    country: "uk",
    sports: ["football"],
    strengths: ["premier_league"],
    requiresSportVerification: true,
  },

  "Manchester Evening News": {
    source: "Manchester Evening News",
    authority: 0.65,
    country: "uk",
    sports: ["football"],
    strengths: ["premier_league"],
    requiresSportVerification: true,
  },

  "Liverpool Echo": {
    source: "Liverpool Echo",
    authority: 0.62,
    country: "uk",
    sports: ["football"],
    strengths: ["premier_league"],
    requiresSportVerification: true,
  },

  "The Mag": {
    source: "The Mag",
    authority: 0.55,
    country: "uk",
    sports: ["football"],
    strengths: ["premier_league"],
    trustFeedSport: true,
  },

  "This is Anfield": {
    source: "This is Anfield",
    authority: 0.62,
    country: "uk",
    sports: ["football"],
    strengths: ["premier_league"],
    trustFeedSport: true,
  },

  "We Are The Arsenal": {
    source: "We Are The Arsenal",
    authority: 0.55,
    country: "uk",
    sports: ["football"],
    strengths: ["premier_league"],
    trustFeedSport: true,
  },

  "Vital Football": {
    source: "Vital Football",
    authority: 0.52,
    country: "uk",
    sports: ["football"],
    strengths: ["premier_league"],
    requiresSportVerification: true,
  },

  Arseblog: {
    source: "Arseblog",
    authority: 0.62,
    country: "uk",
    sports: ["football"],
    strengths: ["premier_league"],
    trustFeedSport: true,
  },

  /* ========================================================================
     ITALIAN FOOTBALL
     ======================================================================== */

  "Gazzetta dello Sport": {
    source: "Gazzetta dello Sport",
    authority: 0.92,
    country: "it",
    sports: ["football"],
    strengths: ["serie_a", "serie_b", "italian_football"],
    trustFeedSport: true,
  },

  "Corriere dello Sport": {
    source: "Corriere dello Sport",
    authority: 0.88,
    country: "it",
    sports: ["football"],
    strengths: ["serie_a", "serie_b", "italian_football"],
    trustFeedSport: true,
  },

  TuttoMercatoWeb: {
    source: "TuttoMercatoWeb",
    authority: 0.72,
    country: "it",
    sports: ["football"],
    strengths: ["serie_a", "transfers", "italian_football"],
    trustFeedSport: true,
  },

  "Football Italia": {
    source: "Football Italia",
    authority: 0.8,
    country: "it",
    sports: ["football"],
    strengths: ["serie_a", "italian_football"],
    trustFeedSport: true,
  },

  "Cult of Calcio": {
    source: "Cult of Calcio",
    authority: 0.66,
    country: "it",
    sports: ["football"],
    strengths: ["serie_a", "italian_football"],
    trustFeedSport: true,
  },

  /* ========================================================================
     GERMAN FOOTBALL
     ======================================================================== */

  "Bundesliga Live": {
    source: "Bundesliga Live",
    authority: 0.85,
    country: "de",
    sports: ["football"],
    strengths: ["bundesliga"],
    trustFeedSport: true,
  },

  "Get Football News Germany": {
    source: "Get Football News Germany",
    authority: 0.72,
    country: "de",
    sports: ["football"],
    strengths: ["bundesliga"],
    trustFeedSport: true,
  },

  "Bundesliga Fan": {
    source: "Bundesliga Fan",
    authority: 0.68,
    country: "de",
    sports: ["football"],
    strengths: ["bundesliga"],
    trustFeedSport: true,
  },

  "Bavarian Football Works": {
    source: "Bavarian Football Works",
    authority: 0.65,
    country: "de",
    sports: ["football"],
    strengths: ["bundesliga"],
    trustFeedSport: true,
  },

  /* ========================================================================
     SPANISH FOOTBALL
     ======================================================================== */

  Marca: {
    source: "Marca",
    authority: 0.88,
    country: "es",
    sports: ["football"],
    strengths: ["la_liga"],
    trustFeedSport: true,
  },

  AS: {
    source: "AS",
    authority: 0.85,
    country: "es",
    sports: ["football"],
    strengths: ["la_liga"],
    trustFeedSport: true,
  },

  "Managing Madrid": {
    source: "Managing Madrid",
    authority: 0.62,
    country: "es",
    sports: ["football"],
    strengths: ["la_liga"],
    trustFeedSport: true,
  },

  "Football España": {
    source: "Football España",
    authority: 0.74,
    country: "es",
    sports: ["football"],
    strengths: ["la_liga"],
    trustFeedSport: true,
  },

  "Barca Blaugranes": {
    source: "Barca Blaugranes",
    authority: 0.62,
    country: "es",
    sports: ["football"],
    strengths: ["la_liga"],
    trustFeedSport: true,
  },

  /* ========================================================================
     FRENCH FOOTBALL
     ======================================================================== */

  "L'Équipe": {
    source: "L'Équipe",
    authority: 0.92,
    country: "fr",
    sports: ["football"],
    strengths: ["ligue_1"],
    trustFeedSport: true,
  },

  "Get French Football News": {
    source: "Get French Football News",
    authority: 0.68,
    country: "fr",
    sports: ["football"],
    strengths: ["ligue_1", "transfers"],
    trustFeedSport: true,
  },

  /* ========================================================================
     SWEDISH FOOTBALL
     ======================================================================== */

  Fotbollskanalen: {
    source: "Fotbollskanalen",
    authority: 0.82,
    country: "se",
    sports: ["football"],
    strengths: ["allsvenskan", "swedish_players"],
    trustFeedSport: true,
  },

  "SvenskaFans": {
    source: "SvenskaFans",
    authority: 0.65,
    country: "se",
    sports: ["football"],
    strengths: ["swedish_players", "premier_league", "allsvenskan"],
    trustFeedSport: true,
  },

  "SvenskaFans – Sverige": {
    source: "SvenskaFans – Sverige",
    authority: 0.65,
    country: "se",
    sports: ["football"],
    strengths: ["allsvenskan", "swedish_players"],
    trustFeedSport: true,
  },

  "SVT Sport – Fotboll": {
    source: "SVT Sport – Fotboll",
    authority: 0.85,
    country: "se",
    sports: ["football"],
    strengths: ["allsvenskan", "swedish_players"],
    requiresSportVerification: false,
    trustFeedSport: true,
  },

  "Aftonbladet – Fotboll": {
    source: "Aftonbladet – Fotboll",
    authority: 0.75,
    country: "se",
    sports: ["football"],
    strengths: ["allsvenskan", "swedish_players"],
    requiresSportVerification: false,
    trustFeedSport: true,
  },

  "Expressen – Fotboll": {
    source: "Expressen – Fotboll",
    authority: 0.74,
    country: "se",
    sports: ["football"],
    strengths: ["allsvenskan", "swedish_players"],
    requiresSportVerification: false,
    trustFeedSport: true,
  },

  "Fotboll.se": {
    source: "Fotboll.se",
    authority: 0.95,
    country: "se",
    sports: ["football"],
    strengths: ["allsvenskan"],
    trustFeedSport: true,
  },

  Pressgurkan: {
    source: "Pressgurkan",
    authority: 0.95,
    country: "se",
    sports: ["football"],
    strengths: ["allsvenskan"],
    trustFeedSport: true,
  },

  "VSK Fotboll": {
    source: "VSK Fotboll",
    authority: 0.96,
    country: "se",
    sports: ["football"],
    strengths: ["allsvenskan"],
    trustFeedSport: true,
  },

  "ANNO 1904": {
    source: "ANNO 1904",
    authority: 0.6,
    country: "se",
    sports: ["football"],
    strengths: ["allsvenskan"],
    requiresSportVerification: false,
    trustFeedSport: true,
  },

  "Kalmar FF (officiell)": {
    source: "Kalmar FF (officiell)",
    authority: 0.97,
    country: "se",
    sports: ["football"],
    sourceCategory: "official_local",
    strengths: ["allsvenskan", "kalmar_ff"],
    requiresSportVerification: false,
    trustFeedSport: true,
  },

  "Barometern Sport": {
    source: "Barometern Sport",
    authority: 0.83,
    country: "se",
    sports: ["football", "hockey"],
    sourceCategory: "local_media",
    strengths: ["allsvenskan", "hockeyallsvenskan", "kalmar"],
    requiresSportVerification: true,
    trustFeedSport: false,
  },

  "Barometern – Kalmar FF": {
    source: "Barometern – Kalmar FF",
    authority: 0.86,
    country: "se",
    sports: ["football"],
    sourceCategory: "local_media",
    strengths: ["allsvenskan", "kalmar_ff"],
    requiresSportVerification: false,
    trustFeedSport: true,
  },

  "Ölandsbladet – Kalmar FF": {
    source: "Ölandsbladet – Kalmar FF",
    authority: 0.8,
    country: "se",
    sports: ["football"],
    sourceCategory: "local_media",
    strengths: ["allsvenskan", "kalmar_ff"],
    requiresSportVerification: false,
    trustFeedSport: true,
  },

  "Bollsvenskan – Kalmar FF": {
    source: "Bollsvenskan – Kalmar FF",
    authority: 0.63,
    country: "se",
    sports: ["football"],
    sourceCategory: "aggregator_team_feed",
    strengths: ["allsvenskan", "kalmar_ff"],
    requiresSportVerification: false,
    trustFeedSport: true,
  },

  "P4 Kalmar Sporten": {
    source: "P4 Kalmar Sporten",
    authority: 0.81,
    country: "se",
    sports: ["football", "hockey"],
    sourceCategory: "public_service_local",
    strengths: ["kalmar", "public_service"],
    requiresSportVerification: true,
    trustFeedSport: false,
  },

  "SvenskaFans – Kalmar FF": {
    source: "SvenskaFans – Kalmar FF",
    authority: 0.5,
    country: "se",
    sports: ["football"],
    sourceCategory: "fan_community",
    strengths: ["allsvenskan", "kalmar_ff"],
    requiresSportVerification: false,
    trustFeedSport: true,
  },

  /* ========================================================================
     SWEDISH HOCKEY
     ======================================================================== */

  "SHL (officiell)": {
    source: "SHL (officiell)",
    authority: 0.98,
    country: "se",
    sports: ["hockey"],
    strengths: ["shl"],
    trustFeedSport: true,
  },

  "HockeyNews.se": {
    source: "HockeyNews.se",
    authority: 0.75,
    country: "se",
    sports: ["hockey"],
    strengths: ["shl", "hockeyallsvenskan", "nhl"],
    trustFeedSport: true,
  },

  "HockeyNews – SHL": {
    source: "HockeyNews – SHL",
    authority: 0.75,
    country: "se",
    sports: ["hockey"],
    strengths: ["shl"],
    trustFeedSport: true,
  },

  "HockeyNews – HockeyAllsvenskan": {
    source: "HockeyNews – HockeyAllsvenskan",
    authority: 0.75,
    country: "se",
    sports: ["hockey"],
    strengths: ["hockeyallsvenskan"],
    trustFeedSport: true,
  },

  "HockeyNews – NHL": {
    source: "HockeyNews – NHL",
    authority: 0.75,
    country: "se",
    sports: ["hockey"],
    strengths: ["nhl"],
    trustFeedSport: true,
  },

  "Aftonbladet – Hockey": {
    source: "Aftonbladet – Hockey",
    authority: 0.75,
    country: "se",
    sports: ["hockey"],
    strengths: ["shl", "nhl"],
    trustFeedSport: true,
  },

  "Expressen – Hockey": {
    source: "Expressen – Hockey",
    authority: 0.74,
    country: "se",
    sports: ["hockey"],
    strengths: ["shl", "nhl"],
    trustFeedSport: true,
  },

  "SVT Sport – Hockey": {
    source: "SVT Sport – Hockey",
    authority: 0.85,
    country: "se",
    sports: ["hockey"],
    strengths: ["shl", "hockeyallsvenskan"],
    trustFeedSport: true,
  },

  "Kalmar HC (officiell)": {
    source: "Kalmar HC (officiell)",
    authority: 0.96,
    country: "se",
    sports: ["hockey"],
    sourceCategory: "official_local",
    strengths: ["hockeyallsvenskan", "kalmar_hc"],
    requiresSportVerification: false,
    trustFeedSport: true,
  },

  "Nybro Vikings (officiell)": {
    source: "Nybro Vikings (officiell)",
    authority: 0.95,
    country: "se",
    sports: ["hockey"],
    sourceCategory: "official_local",
    strengths: ["hockeyallsvenskan", "nybro_vikings"],
    requiresSportVerification: false,
    trustFeedSport: true,
  },

  "HockeyNews – Kalmar HC": {
    source: "HockeyNews – Kalmar HC",
    authority: 0.64,
    country: "se",
    sports: ["hockey"],
    sourceCategory: "aggregator_team_feed",
    strengths: ["hockeyallsvenskan", "kalmar_hc"],
    requiresSportVerification: false,
    trustFeedSport: true,
  },

  "HockeyNews – Nybro Vikings": {
    source: "HockeyNews – Nybro Vikings",
    authority: 0.64,
    country: "se",
    sports: ["hockey"],
    sourceCategory: "aggregator_team_feed",
    strengths: ["hockeyallsvenskan", "nybro_vikings"],
    requiresSportVerification: false,
    trustFeedSport: true,
  },

  /* ========================================================================
     NHL / NORTH AMERICAN HOCKEY
     ======================================================================== */

  "NHL.com": {
    source: "NHL.com",
    authority: 0.98,
    country: "us",
    sports: ["hockey"],
    strengths: ["nhl"],
    trustFeedSport: true,
  },

  TSN: {
    source: "TSN",
    authority: 0.7,
    country: "ca",
    sports: ["hockey"],
    strengths: ["nhl"],
    trustFeedSport: true,
  },

  Sportsnet: {
    source: "Sportsnet",
    authority: 0.7,
    country: "ca",
    sports: ["hockey"],
    strengths: ["nhl"],
    trustFeedSport: true,
  },

  "Sportsnet – NHL": {
    source: "Sportsnet – NHL",
    authority: 0.7,
    country: "ca",
    sports: ["hockey"],
    strengths: ["nhl"],
    trustFeedSport: true,
  },

  "The Hockey News": {
    source: "The Hockey News",
    authority: 0.85,
    country: "ca",
    sports: ["hockey"],
    strengths: ["nhl"],
    trustFeedSport: true,
  },

  "The Hockey Writers – NHL": {
    source: "The Hockey Writers – NHL",
    authority: 0.75,
    country: "us",
    sports: ["hockey"],
    strengths: ["nhl"],
    trustFeedSport: true,
  },

  /* ========================================================================
     SWEDISH NATIONAL / GENERAL MEDIA
     ======================================================================== */

  Aftonbladet: {
    source: "Aftonbladet",
    authority: 0.75,
    country: "se",
    sports: ["football", "hockey"],
    strengths: ["swedish_players"],
    requiresSportVerification: true,
  },

  Expressen: {
    source: "Expressen",
    authority: 0.74,
    country: "se",
    sports: ["football", "hockey"],
    strengths: ["swedish_players"],
    requiresSportVerification: true,
  },

  "SVT Sport": {
    source: "SVT Sport",
    authority: 0.85,
    country: "se",
    sports: ["football", "hockey"],
    strengths: ["allsvenskan", "shl", "swedish_players"],
    requiresSportVerification: true,
  },

  SVT: {
    source: "SVT",
    authority: 0.85,
    country: "se",
    sports: ["football", "hockey"],
    requiresSportVerification: true,
  },

  DN: {
    source: "DN",
    authority: 0.78,
    country: "se",
    sports: ["football", "hockey"],
    requiresSportVerification: true,
  },

  Sydsvenskan: {
    source: "Sydsvenskan",
    authority: 0.7,
    country: "se",
    sports: ["football", "hockey"],
    requiresSportVerification: true,
  },

  "Göteborgs-Posten": {
    source: "Göteborgs-Posten",
    authority: 0.68,
    country: "se",
    sports: ["football", "hockey"],
    requiresSportVerification: true,
  },

  /* ========================================================================
     SWEDISH LOCAL / REGIONAL MEDIA
     ======================================================================== */

  VLT: {
    source: "VLT",
    authority: 0.95,
    country: "se",
    sports: ["football", "hockey"],
    strengths: ["allsvenskan", "hockeyallsvenskan"],
    requiresSportVerification: true,
  },

  "Västerbottens-Kuriren": {
    source: "Västerbottens-Kuriren",
    authority: 0.5,
    country: "se",
    sports: ["hockey"],
    strengths: ["shl"],
    requiresSportVerification: true,
  },

  "Örnsköldsviks Allehanda": {
    source: "Örnsköldsviks Allehanda",
    authority: 0.48,
    country: "se",
    sports: ["hockey"],
    strengths: ["shl"],
    requiresSportVerification: true,
  },

  "Jönköpings-Posten": {
    source: "Jönköpings-Posten",
    authority: 0.48,
    country: "se",
    sports: ["football", "hockey"],
    strengths: ["allsvenskan", "shl"],
    requiresSportVerification: true,
  },

  "Helsingborgs Dagblad": {
    source: "Helsingborgs Dagblad",
    authority: 0.48,
    country: "se",
    sports: ["football", "hockey"],
    strengths: ["allsvenskan", "shl"],
    requiresSportVerification: true,
  },

  "Nerikes Allehanda": {
    source: "Nerikes Allehanda",
    authority: 0.48,
    country: "se",
    sports: ["football", "hockey"],
    strengths: ["allsvenskan", "shl"],
    requiresSportVerification: true,
  },

  "Norrköpings Tidningar": {
    source: "Norrköpings Tidningar",
    authority: 0.48,
    country: "se",
    sports: ["football", "hockey"],
    strengths: ["allsvenskan", "shl"],
    requiresSportVerification: true,
  },

  "Östgöta Correspondenten": {
    source: "Östgöta Correspondenten",
    authority: 0.48,
    country: "se",
    sports: ["football", "hockey"],
    strengths: ["allsvenskan", "shl"],
    requiresSportVerification: true,
  },

  "Sundsvalls Tidning": {
    source: "Sundsvalls Tidning",
    authority: 0.48,
    country: "se",
    sports: ["hockey"],
    strengths: ["shl"],
    requiresSportVerification: true,
  },

  MittMedia: {
    source: "MittMedia",
    authority: 0.45,
    country: "se",
    sports: ["football", "hockey"],
    strengths: ["allsvenskan", "shl"],
    requiresSportVerification: true,
  },

  Sportbladet: {
    source: "Sportbladet",
    authority: 0.85,
    country: "se",
    sports: ["football", "hockey"],
    strengths: ["swedish_players", "shl", "allsvenskan"],
    requiresSportVerification: true,
  },
};

/* ==========================================================================
   SOURCE ALIASES
   Normaliserar vanliga feed-namn till rätt profilnamn.
   ========================================================================== */

const SOURCE_ALIASES: Record<string, string> = {
  "svt sport – fotboll": "SVT Sport – Fotboll",
  "svt sport – hockey": "SVT Sport – Hockey",

  "aftonbladet – fotboll": "Aftonbladet – Fotboll",
  "aftonbladet – hockey": "Aftonbladet – Hockey",

  "expressen – fotboll": "Expressen – Fotboll",
  "expressen – hockey": "Expressen – Hockey",

  "sportsnet – nhl": "Sportsnet – NHL",
  "hockeynews.se – shl": "HockeyNews – SHL",
  "hockeynews.se – hockeyallsvenskan": "HockeyNews – HockeyAllsvenskan",
  "hockeynews.se – nhl": "HockeyNews – NHL",
  "hockeynews.se – alla nyheter": "HockeyNews.se",

  "manchester evening news – manchester united": "Manchester Evening News",
  "manchester evening news – manchester city": "Manchester Evening News",
  "chroniclelive – newcastle united": "ChronicleLive",
  "liverpool echo – liverpool fc": "Liverpool Echo",

  "svenskafans – sverige": "SvenskaFans – Sverige",
  "svenskafans – england": "SvenskaFans",
  "svenskafans – italien": "SvenskaFans",
  "svenskafans – spanien": "SvenskaFans",
  "svenskafans – västerås sk": "SvenskaFans",
  "svenskafans – kalmar ff": "SvenskaFans – Kalmar FF",

  "barometern - kalmar ff": "Barometern – Kalmar FF",
  "olandsbladet - kalmar ff": "Ölandsbladet – Kalmar FF",
  "hockeynews - kalmar hc": "HockeyNews – Kalmar HC",
  "hockeynews - nybro vikings": "HockeyNews – Nybro Vikings",

  "nhl – latest news": "NHL.com",
};

/* ==========================================================================
   REGIONAL ELIGIBILITY POLICIES
   Regionala källor exponeras endast när region/favorit matchar.
   ========================================================================== */

const SOURCE_REGIONAL_ELIGIBILITY_BY_SOURCE: Record<
  string,
  SourceRegionalEligibilityInput
> = {
  VLT: {
    scope: "regional",
    regionKey: "vasteras",
    favoriteEligible: true,
    favoriteEntityIds: [
      "football-team-vasteras-sk",
      "hockey-team-vasteras-ik",
      "football-league-allsvenskan",
      "hockey-league-hockeyallsvenskan",
    ],
    favoriteTokens: [
      "västerås sk",
      "vasteras sk",
      "västerås ik",
      "vasteras ik",
      "vsk",
      "vik",
      "allsvenskan",
      "hockeyallsvenskan",
    ],
  },
  "VSK Fotboll": {
    scope: "regional",
    regionKey: "vasteras",
    favoriteEligible: true,
    favoriteEntityIds: [
      "football-team-vasteras-sk",
      "football-league-allsvenskan",
    ],
    favoriteTokens: ["västerås sk", "vasteras sk", "vsk", "allsvenskan"],
  },
  "ANNO 1904": {
    scope: "regional",
    regionKey: "vasteras",
    favoriteEligible: true,
    favoriteEntityIds: [
      "football-team-vasteras-sk",
      "football-league-allsvenskan",
    ],
    favoriteTokens: ["västerås sk", "vasteras sk", "vsk", "allsvenskan"],
  },
  Pressgurkan: {
    scope: "regional",
    regionKey: "vasteras",
    favoriteEligible: true,
    favoriteEntityIds: ["football-team-vasteras-sk"],
    favoriteTokens: ["västerås sk", "vasteras sk", "vsk"],
  },
  "SvenskaFans – Västerås SK": {
    scope: "regional",
    regionKey: "vasteras",
    favoriteEligible: true,
    favoriteEntityIds: [
      "football-team-vasteras-sk",
      "football-league-allsvenskan",
    ],
    favoriteTokens: ["västerås sk", "vasteras sk", "vsk", "allsvenskan"],
  },
  "Kalmar FF (officiell)": {
    scope: "regional",
    regionKey: "kalmar",
    favoriteEligible: true,
    favoriteEntityIds: ["football-team-kalmar", "football-league-allsvenskan"],
    favoriteTokens: ["kalmar ff", "kff", "allsvenskan"],
  },
  "Kalmar FF officiella nyheter": {
    scope: "regional",
    regionKey: "kalmar",
    favoriteEligible: true,
    favoriteEntityIds: ["football-team-kalmar", "football-league-allsvenskan"],
    favoriteTokens: ["kalmar ff", "kff", "allsvenskan"],
  },
  "Barometern Sport": {
    scope: "regional",
    regionKey: "kalmar",
    favoriteEligible: true,
    favoriteEntityIds: [
      "football-team-kalmar",
      "hockey-team-kalmar-hc",
      "hockey-team-nybro-vikings-if",
      "football-league-allsvenskan",
      "hockey-league-hockeyallsvenskan",
    ],
    favoriteTokens: [
      "kalmar ff",
      "kff",
      "kalmar hc",
      "nybro vikings",
      "allsvenskan",
      "hockeyallsvenskan",
    ],
  },
  "Barometern – Kalmar FF": {
    scope: "regional",
    regionKey: "kalmar",
    favoriteEligible: true,
    favoriteEntityIds: ["football-team-kalmar", "football-league-allsvenskan"],
    favoriteTokens: ["kalmar ff", "kff", "allsvenskan"],
  },
  "Barometern Kalmar FF": {
    scope: "regional",
    regionKey: "kalmar",
    favoriteEligible: true,
    favoriteEntityIds: ["football-team-kalmar", "football-league-allsvenskan"],
    favoriteTokens: ["kalmar ff", "kff", "allsvenskan"],
  },
  "Ölandsbladet – Kalmar FF": {
    scope: "regional",
    regionKey: "kalmar",
    favoriteEligible: true,
    favoriteEntityIds: ["football-team-kalmar", "football-league-allsvenskan"],
    favoriteTokens: ["kalmar ff", "kff", "allsvenskan"],
  },
  "Ölandsbladet Kalmar FF": {
    scope: "regional",
    regionKey: "kalmar",
    favoriteEligible: true,
    favoriteEntityIds: ["football-team-kalmar", "football-league-allsvenskan"],
    favoriteTokens: ["kalmar ff", "kff", "allsvenskan"],
  },
  "Bollsvenskan – Kalmar FF": {
    scope: "regional",
    regionKey: "kalmar",
    favoriteEligible: true,
    favoriteEntityIds: ["football-team-kalmar", "football-league-allsvenskan"],
    favoriteTokens: ["kalmar ff", "kff", "allsvenskan"],
  },
  "Bollsvenskan Kalmar FF": {
    scope: "regional",
    regionKey: "kalmar",
    favoriteEligible: true,
    favoriteEntityIds: ["football-team-kalmar", "football-league-allsvenskan"],
    favoriteTokens: ["kalmar ff", "kff", "allsvenskan"],
  },
  "P4 Kalmar Sporten": {
    scope: "regional",
    regionKey: "kalmar",
    favoriteEligible: true,
    favoriteEntityIds: [
      "football-team-kalmar",
      "hockey-team-kalmar-hc",
      "hockey-team-nybro-vikings-if",
      "football-league-allsvenskan",
      "hockey-league-hockeyallsvenskan",
    ],
    favoriteTokens: [
      "kalmar ff",
      "kff",
      "kalmar hc",
      "nybro vikings",
      "allsvenskan",
      "hockeyallsvenskan",
    ],
  },
  "Kalmar HC (officiell)": {
    scope: "regional",
    regionKey: "kalmar",
    favoriteEligible: true,
    favoriteEntityIds: [
      "hockey-team-kalmar-hc",
      "hockey-league-hockeyallsvenskan",
    ],
    favoriteTokens: ["kalmar hc", "hockeyallsvenskan"],
  },
  "Kalmar HC officiell": {
    scope: "regional",
    regionKey: "kalmar",
    favoriteEligible: true,
    favoriteEntityIds: [
      "hockey-team-kalmar-hc",
      "hockey-league-hockeyallsvenskan",
    ],
    favoriteTokens: ["kalmar hc", "hockeyallsvenskan"],
  },
  "Nybro Vikings (officiell)": {
    scope: "regional",
    regionKey: "kalmar",
    favoriteEligible: true,
    favoriteEntityIds: [
      "hockey-team-nybro-vikings-if",
      "hockey-league-hockeyallsvenskan",
    ],
    favoriteTokens: ["nybro vikings", "hockeyallsvenskan"],
  },
  "Nybro Vikings officiell": {
    scope: "regional",
    regionKey: "kalmar",
    favoriteEligible: true,
    favoriteEntityIds: [
      "hockey-team-nybro-vikings-if",
      "hockey-league-hockeyallsvenskan",
    ],
    favoriteTokens: ["nybro vikings", "hockeyallsvenskan"],
  },
  "HockeyNews – Kalmar HC": {
    scope: "regional",
    regionKey: "kalmar",
    favoriteEligible: true,
    favoriteEntityIds: [
      "hockey-team-kalmar-hc",
      "hockey-league-hockeyallsvenskan",
    ],
    favoriteTokens: ["kalmar hc", "hockeyallsvenskan"],
  },
  "HockeyNews Kalmar HC": {
    scope: "regional",
    regionKey: "kalmar",
    favoriteEligible: true,
    favoriteEntityIds: [
      "hockey-team-kalmar-hc",
      "hockey-league-hockeyallsvenskan",
    ],
    favoriteTokens: ["kalmar hc", "hockeyallsvenskan"],
  },
  "HockeyNews – Nybro Vikings": {
    scope: "regional",
    regionKey: "kalmar",
    favoriteEligible: true,
    favoriteEntityIds: [
      "hockey-team-nybro-vikings-if",
      "hockey-league-hockeyallsvenskan",
    ],
    favoriteTokens: ["nybro vikings", "hockeyallsvenskan"],
  },
  "HockeyNews Nybro Vikings": {
    scope: "regional",
    regionKey: "kalmar",
    favoriteEligible: true,
    favoriteEntityIds: [
      "hockey-team-nybro-vikings-if",
      "hockey-league-hockeyallsvenskan",
    ],
    favoriteTokens: ["nybro vikings", "hockeyallsvenskan"],
  },
};

/* ==========================================================================
   DEFAULT PROFILE
   ========================================================================== */

export const DEFAULT_SOURCE_PROFILE: SourceProfile = {
  source: "unknown",
  authority: 0.5,
  country: "other",
  sports: ["football", "hockey"],
  requiresSportVerification: false,
  trustFeedSport: false,
};

/* ==========================================================================
   HELPERS
   ========================================================================== */

function normalizeSourceKey(source: string): string {
  return source.trim().toLowerCase();
}

function toUniqueStrings(
  values: string[] | undefined,
  normalizeValue: (value: string) => string,
): string[] {
  if (!values?.length) {
    return [];
  }

  const unique = new Set<string>();

  for (const value of values) {
    const normalized = normalizeValue(value);
    if (!normalized) continue;
    unique.add(normalized);
  }

  return Array.from(unique);
}

function resolveSourceProfileKey(source?: string): string | null {
  if (!source) {
    return null;
  }

  const normalizedInput = normalizeSourceKey(source);
  const aliasedInput = SOURCE_ALIASES[normalizedInput] ?? source;
  const normalizedAliasedInput = normalizeSourceKey(aliasedInput);

  const exactKey = Object.keys(SOURCE_PROFILES).find(
    (key) => normalizeSourceKey(key) === normalizedAliasedInput,
  );
  if (exactKey) {
    return exactKey;
  }

  const partialKey = Object.keys(SOURCE_PROFILES).find((key) =>
    normalizedAliasedInput.includes(normalizeSourceKey(key)),
  );
  if (partialKey) {
    return partialKey;
  }

  return aliasedInput.trim() || null;
}

/* ==========================================================================
   PUBLIC API
   ========================================================================== */

export function getSourceProfile(source?: string): SourceProfile {
  const sourceKey = resolveSourceProfileKey(source);
  if (sourceKey && SOURCE_PROFILES[sourceKey]) {
    return SOURCE_PROFILES[sourceKey];
  }

  return DEFAULT_SOURCE_PROFILE;
}

const REGIONAL_POLICY_BY_KEY = new Map<string, SourceRegionalEligibilityInput>(
  Object.entries(SOURCE_REGIONAL_ELIGIBILITY_BY_SOURCE).map(([key, value]) => [
    normalizeSourceKey(key),
    value,
  ]),
);

const DEFAULT_SOURCE_REGIONAL_ELIGIBILITY: SourceRegionalEligibility = {
  scope: "global",
  regionKey: null,
  favoriteEligible: false,
  favoriteEntityIds: [],
  favoriteTokens: [],
};

export function getSourceRegionalEligibilityPolicy(
  source?: string,
): SourceRegionalEligibility {
  if (!source) {
    return DEFAULT_SOURCE_REGIONAL_ELIGIBILITY;
  }

  const sourceKey = resolveSourceProfileKey(source);
  const normalizedInput = normalizeSourceKey(source);
  const aliasedInput = SOURCE_ALIASES[normalizedInput] ?? source;

  const policyInput =
    (sourceKey
      ? REGIONAL_POLICY_BY_KEY.get(normalizeSourceKey(sourceKey))
      : undefined) ??
    REGIONAL_POLICY_BY_KEY.get(normalizedInput) ??
    REGIONAL_POLICY_BY_KEY.get(normalizeSourceKey(aliasedInput));

  if (!policyInput || policyInput.scope !== "regional") {
    return DEFAULT_SOURCE_REGIONAL_ELIGIBILITY;
  }

  return {
    scope: "regional",
    regionKey: policyInput.regionKey,
    favoriteEligible: policyInput.favoriteEligible === true,
    favoriteEntityIds: toUniqueStrings(
      policyInput.favoriteEntityIds,
      (value) => value.trim().toLowerCase(),
    ),
    favoriteTokens: toUniqueStrings(
      policyInput.favoriteTokens,
      (value) => value.trim().toLowerCase(),
    ),
  };
}
