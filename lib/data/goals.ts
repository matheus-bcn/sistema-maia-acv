import type { SupabaseClient } from "@supabase/supabase-js";
import type { Goal } from "@/types";

export async function getTeamGoal(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.from("goals").select("target_value").eq("type", "equipe").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return 150000;
  return Number(data.target_value);
}

export async function getIndividualBaseGoal(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.from("goals").select("target_value").eq("type", "individual").is("seller_id", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ? Number(data.target_value) : 25000;
}

export async function upsertTeamGoal(supabase: SupabaseClient, targetValue: number): Promise<{ error: string | null }> {
  const { error } = await supabase.from("goals").insert({ type: "equipe", target_value: targetValue, seller_id: null });
  return { error: error?.message ?? null };
}

export async function upsertIndividualBaseGoal(supabase: SupabaseClient, targetValue: number): Promise<{ error: string | null }> {
  const { error } = await supabase.from("goals").insert({ type: "individual", target_value: targetValue, seller_id: null });
  return { error: error?.message ?? null };
}

export async function listRecentGoals(supabase: SupabaseClient): Promise<Goal[]> {
  const { data, error } = await supabase.from("goals").select("*").order("created_at", { ascending: false }).limit(20);
  if (error || !data) return [];
  return data as Goal[];
}