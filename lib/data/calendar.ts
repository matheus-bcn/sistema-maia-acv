import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarEvent } from "@/types";

export async function listCalendarEvents(
  supabase: SupabaseClient,
  month: number,
  year: number
): Promise<CalendarEvent[]> {
  // Calcula o primeiro e último dia do mês para buscar na coluna event_date
  const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .gte("event_date", startStr)
    .lte("event_date", endStr)
    .order("event_date");

  if (error || !data) return [];
  return data as CalendarEvent[];
}