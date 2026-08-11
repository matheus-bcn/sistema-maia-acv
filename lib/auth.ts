import type { SupabaseClient } from "@supabase/supabase-js";

export function isAuthRequired(): boolean {
  return process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";
}

// Single source of truth for "is this user an admin?": either their email
// matches MASTER_ADMIN_EMAIL, or their sellers.is_admin flag is true.
export async function isSellerAdmin(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null
): Promise<boolean> {
  const masterEmail = (
    process.env.MASTER_ADMIN_EMAIL || process.env.NEXT_PUBLIC_MASTER_ADMIN_EMAIL
  )?.toLowerCase();
  if (masterEmail && email && email.toLowerCase() === masterEmail) return true;

  const { data } = await supabase.from("sellers").select("is_admin").eq("id", userId).maybeSingle();
  return !!data?.is_admin;
}
