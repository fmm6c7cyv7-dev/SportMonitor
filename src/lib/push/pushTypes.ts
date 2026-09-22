// src/lib/push/pushTypes.ts

/* ==========================================================================
   CORE ROW TYPES
   ========================================================================== */

export type NewsRow = {
  id: string;
  title: string;
  url: string | null;
  tags: string[] | null;
  sport: string | null;
  fetched_at: string;
};

export type PushEntity = {
  id: string;
  name: string;
  type: "team" | "player" | "league";
  team_id?: string | null;
  league_id?: string | null;
};

export type PushSubscriptionRow = {
  id: string;
  device_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
};

export type FavoriteRow = {
  device_id: string;
  entity_id: string;
};

export type NewsEntityRow = {
  entity_id: string;
};

export type DeliveryLogRow = {
  device_id: string;
  news_item_id: string;
  sent_at: string | null;
};

export type PushDeliveryInsertRow = {
  device_id: string;
  news_item_id: string;
  event_type: "VIP_ARTICLE" | "ARTICLE";
  sent_at: string;
};