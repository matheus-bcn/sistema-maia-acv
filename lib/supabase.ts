import { createClient } from "@/lib/supabase/client";

/** Cliente Supabase no browser (singleton) */
export const supabase = createClient();
