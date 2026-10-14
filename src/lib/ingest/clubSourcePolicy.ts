import { isWomensSportContent, normalizeFilterText } from "@/lib/ingest/filterPolicy";

export type ClubSource = "The Stacey West" | "FeanOnline";
export type ClubSourceArticle = {
  title: string;
  url?: string | null;
  summary?: string | null;
  tags?: string[] | null;
};

/**
 * Conservative source-specific eligibility before entity detection.
 * These rules are dormant until source activation; they never grant ranking,
 * editorial VIP or authority on their own.
 */
export function isEligibleClubSourceArticle(source: string, item: ClubSourceArticle): boolean {
  if (source !== "The Stacey West" && source !== "FeanOnline") return true;
  const title = normalizeFilterText(item.title);
  const summary = normalizeFilterText(item.summary ?? "");
  const tags = (item.tags ?? []).map(normalizeFilterText).join(" ");
  const path = normalizeFilterText(new URL(item.url ?? "https://invalid.example").pathname);
  const all = [title, summary, tags, path].join(" ");
  const primaryIdentity = [title, path].join(" ");

  // Never let commercial, women's or academy/mixed-scope articles through.
  if (isWomensSportContent(all) ||
      /\b(vrouwen|dames|vrouwenteam|meiden|vrouwenvoetbal|eredivisie vrouwen|jeugd|academy|under 1[789]|u ?1[789]|under 2[013]|u ?2[013])\b/u.test(all) ||
      /\b(casino|bookmaker|betting|goksite|gokken|odds|weddenschappen|advertorial|gesponsord|sponsored|affiliate|bonuscode|promocode)\b/u.test(all)) return false;

  if (source === "The Stacey West") {
    // Generic Lincolnshire non-league stories are not Lincoln City FC news.
    return /\b(lincoln city|the imps|weareimps)\b/u.test(primaryIdentity);
  }

  // SC Heerenveen or a verified Swedish-player name in the club-specific feed.
  // Never infer the men's club solely from the source brand.
  return /\b(sc heerenveen|heerenveen|marcus linday|linday)\b/u.test(primaryIdentity);
}
