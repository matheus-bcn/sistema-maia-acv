import type { SupabaseClient } from "@supabase/supabase-js";

export function isAuthRequired(): boolean {
  return process.env.NEXT_PUBLIC_REQUIRE_AUTH === "true";
}

// Client-safe check for the master-admin email (UI gating only — the real
// authorization check is isSellerAdmin below, enforced server-side and by RLS).
export function isMasterAdminEmail(email?: string | null): boolean {
  const masterEmail = process.env.NEXT_PUBLIC_MASTER_ADMIN_EMAIL?.toLowerCase();
  return !!masterEmail && !!email && email.toLowerCase() === masterEmail;
}

// Single source of truth for "is this user an admin?": either their email
// matches a master-admin email, or their sellers.is_admin flag is true.
export async function isSellerAdmin(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null
): Promise<boolean> {
  const serverMasterEmail = process.env.MASTER_ADMIN_EMAIL?.toLowerCase();
  if (serverMasterEmail && email && email.toLowerCase() === serverMasterEmail) return true;
  if (isMasterAdminEmail(email)) return true;

  const { data } = await supabase.from("sellers").select("is_admin").eq("id", userId).maybeSingle();
  return !!data?.is_admin;
}
