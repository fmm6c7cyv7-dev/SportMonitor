import type { supabaseService } from "@/lib/supabase";

type Database = ReturnType<typeof supabaseService>;
type DeliveryRow = { device_id: string; news_item_id: string };

export function notifiedDeviceIdsForStory(
  deliveryRows: DeliveryRow[],
  otherArticleIds: ReadonlySet<string>,
): Set<string> {
  return new Set(
    deliveryRows
      .filter((row) => otherArticleIds.has(row.news_item_id))
      .map((row) => row.device_id),
  );
}

/** Reuse the event identity only to prevent a repeated notification per recipient.
 *  Never suppress new recipients simply because somebody else got an earlier push.
 */
export async function loadNotifiedStoryDevices(
  db: Database,
  newsItemId: string,
  eligibleDeviceIds: string[],
): Promise<Set<string>> {
  if (!eligibleDeviceIds.length) return new Set();
  const { data: membership, error } = await db.from("news_story_members")
    .select("story_id")
    .eq("news_item_id", newsItemId)
    .maybeSingle();
  if (error || !membership?.story_id) return new Set();

  const { data: members, error: membersError } = await db.from("news_story_members")
    .select("news_item_id")
    .eq("story_id", membership.story_id);
  if (membersError) return new Set();
  const otherIds = new Set((members ?? [])
    .map((row) => row.news_item_id)
    .filter((id) => id !== newsItemId));
  if (!otherIds.size) return new Set();

  const { data: prior, error: priorError } = await db.from("push_delivery_log")
    .select("device_id,news_item_id")
    .in("device_id", eligibleDeviceIds)
    .in("news_item_id", Array.from(otherIds))
    .gte("sent_at", new Date(Date.now() - 6 * 60 * 60_000).toISOString());
  // Fail-open; a temporary DB or lookup issue cannot block delivery.
  if (priorError) return new Set();
  return notifiedDeviceIdsForStory((prior ?? []) as DeliveryRow[], otherIds);
}
