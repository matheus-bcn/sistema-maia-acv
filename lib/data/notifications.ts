import type { SupabaseClient } from "@supabase/supabase-js";

export interface Notification {
  id: string;
  seller_id: string | null;
  type: "meta_batida" | "meta_em_risco" | "arena_x1" | "cliente_dormente" | "ranking" | string;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

export const NOTIF_CONFIG: Record<string, { icon: string; cor: string }> = {
  meta_batida:      { icon: "mdi:trophy",           cor: "#facc15" },
  meta_em_risco:    { icon: "line-md:alert-circle-loop", cor: "#f97316" },
  arena_x1:         { icon: "mdi:sword-cross",       cor: "#ef4444" },
  cliente_dormente: { icon: "mdi:sleep",             cor: "#a78bfa" },
  ranking:          { icon: "mdi:trending-up",        cor: "#4ade80" },
};

export async function getNotifications(
  supabase: SupabaseClient,
  sellerId: string
): Promise<Notification[]> {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []) as Notification[];
}

export async function countUnread(supabase: SupabaseClient, sellerId: string): Promise<number> {
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", sellerId)
    .eq("is_read", false);
  return count ?? 0;
}

export async function markAllAsRead(supabase: SupabaseClient, sellerId: string): Promise<void> {
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("seller_id", sellerId)
    .eq("is_read", false);
}

export async function markAsRead(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase.from("notifications").update({ is_read: true }).eq("id", id);
}

export async function createNotification(
  supabase: SupabaseClient,
  data: { seller_id: string; type: string; title: string; message?: string }
): Promise<void> {
  await supabase.from("notifications").insert({
    seller_id: data.seller_id,
    type: data.type,
    title: data.title,
    message: data.message ?? null,
  });
}
