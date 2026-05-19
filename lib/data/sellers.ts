import type { SupabaseClient } from "@supabase/supabase-js";
import type { Seller, SellerRanking, SellerStatus } from "@/types";
import { getSalesBySeller } from "@/lib/data/sales";
import { getIndividualBaseGoal } from "@/lib/data/goals";

export async function listSellers(
  supabase: SupabaseClient,
  status?: SellerStatus | "Todos"
): Promise<Seller[]> {
  let query = supabase.from("sellers").select("*").order("name");

  if (status && status !== "Todos") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as Seller[];
}

export async function getSellerRankings(
  supabase: SupabaseClient,
  startDate?: string,
  endDate?: string
): Promise<SellerRanking[]> {
  const [sellers, salesMap] = await Promise.all([
    listSellers(supabase, "Ativo"),
    getSalesBySeller(supabase, startDate, endDate),
  ]);

  const rankings: SellerRanking[] = sellers
    .map((seller) => {
      const stats = salesMap.get(seller.id) ?? { total: 0, count: 0 };
      return {
        seller,
        totalSales: stats.total,
        salesCount: stats.count,
        position: 0,
      };
    })
    .sort((a, b) => b.totalSales - a.totalSales)
    .map((r, i) => ({ ...r, position: i + 1 }));

  return rankings;
}

export async function updateSellerStatus(
  supabase: SupabaseClient,
  id: string,
  status: SellerStatus
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("sellers")
    .update({ status })
    .eq("id", id);

  return { error: error?.message ?? null };
}

export async function createSeller(
  supabase: SupabaseClient,
  input: Omit<Seller, "id" | "created_at">
): Promise<{ seller: Seller | null; error: string | null }> {
  const { data, error } = await supabase
    .from("sellers")
    .insert(input)
    .select()
    .single();

  return { seller: (data as Seller) ?? null, error: error?.message ?? null };
}

export async function getSellerDiagnostics(
  supabase: SupabaseClient,
  startDate?: string,
  endDate?: string
): Promise<
  { nome: string; meta: number; realizado: number; status: "acima" | "no-ritmo" | "abaixo" }[]
> {
  const [rankings, baseMeta] = await Promise.all([
    getSellerRankings(supabase, startDate, endDate),
    getIndividualBaseGoal(supabase),
  ]);

  return rankings.map((r) => {
    const meta = baseMeta;
    const realizado = r.totalSales;
    const pct = meta > 0 ? realizado / meta : 0;
    let status: "acima" | "no-ritmo" | "abaixo" = "no-ritmo";
    if (pct >= 1) status = "acima";
    else if (pct < 0.7) status = "abaixo";

    return {
      nome: r.seller.name,
      meta,
      realizado,
      status,
    };
  });
}

// CORREÇÃO CRUCIAL APLICADA AQUI: 
// Trocamos `category` por `role` para bater com a estrutura do seu Supabase
export async function updateSeller(
  supabase: any,
  id: string,
  input: { name: string; email: string; role: string; password?: string }
) {
  // Prepara o objeto de atualização
  const payload: any = {
    name: input.name,
    email: input.email,
    role: input.role, // Salva corretamente na coluna 'role' do banco
  };

  // Descomente a linha abaixo se o seu banco tiver a coluna updated_at
  // payload.updated_at = new Date().toISOString();

  // (Opcional) Se você for salvar a senha pelo Supabase Auth futuramente,
  // a lógica de atualização da senha ficaria na action e não direto na tabela de sellers.

  const { data, error } = await supabase
    .from("sellers")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  return { data, error: error ? error.message : null };
}