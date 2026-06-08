import type { SupabaseClient } from "@supabase/supabase-js";
import type { Goal } from "@/types";

function currentMonthYear(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function getTeamGoal(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.from("goals").select("target_value").eq("type", "equipe").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return 150000;
  return Number(data.target_value);
}

export async function getIndividualBaseGoal(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.from("goals").select("target_value").eq("type", "individual").is("seller_id", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ? Number(data.target_value) : 25000;
}

export async function getSellerGoal(supabase: SupabaseClient, sellerId: string): Promise<number> {
  const { data } = await supabase
    .from("goals")
    .select("target_value")
    .eq("type", "individual")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data) return Number(data.target_value);
  return getIndividualBaseGoal(supabase);
}

export async function getAllSellerGoals(supabase: SupabaseClient): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("goals")
    .select("seller_id, target_value")
    .eq("type", "individual")
    .not("seller_id", "is", null)
    .order("created_at", { ascending: false });

  if (!data) return {};
  const map: Record<string, number> = {};
  for (const g of data) {
    if (g.seller_id && !(g.seller_id in map)) {
      map[g.seller_id] = Number(g.target_value);
    }
  }
  return map;
}

export async function upsertSellerGoal(
  supabase: SupabaseClient,
  sellerId: string,
  targetValue: number
): Promise<{ error: string | null }> {
  const monthYear = currentMonthYear();
  const { data: existing } = await supabase
    .from("goals")
    .select("id")
    .eq("type", "individual")
    .eq("seller_id", sellerId)
    .eq("month_year", monthYear)
    .limit(1)
    .maybeSingle();

  const { error } = existing?.id
    ? await supabase.from("goals").update({ target_value: targetValue }).eq("id", existing.id)
    : await supabase.from("goals").insert({ type: "individual", target_value: targetValue, seller_id: sellerId, month_year: monthYear });

  return { error: error?.message ?? null };
}

export async function upsertTeamGoal(supabase: SupabaseClient, targetValue: number): Promise<{ error: string | null }> {
  const monthYear = currentMonthYear();
  const { data: existing } = await supabase.from("goals").select("id").eq("type", "equipe").eq("month_year", monthYear).limit(1).maybeSingle();
  const { error } = existing?.id
    ? await supabase.from("goals").update({ target_value: targetValue }).eq("id", existing.id)
    : await supabase.from("goals").insert({ type: "equipe", target_value: targetValue, seller_id: null, month_year: monthYear });
  return { error: error?.message ?? null };
}

export async function upsertIndividualBaseGoal(supabase: SupabaseClient, targetValue: number): Promise<{ error: string | null }> {
  const monthYear = currentMonthYear();
  const { data: existing } = await supabase.from("goals").select("id").eq("type", "individual").is("seller_id", null).eq("month_year", monthYear).limit(1).maybeSingle();
  const { error } = existing?.id
    ? await supabase.from("goals").update({ target_value: targetValue }).eq("id", existing.id)
    : await supabase.from("goals").insert({ type: "individual", target_value: targetValue, seller_id: null, month_year: monthYear });
  return { error: error?.message ?? null };
}

export async function listRecentGoals(supabase: SupabaseClient): Promise<Goal[]> {
  const { data, error } = await supabase.from("goals").select("*").order("created_at", { ascending: false }).limit(20);
  if (error || !data) return [];
  return data as Goal[];
}