import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarEvent } from "@/types";

export async function listCalendarEvents(
  supabase: SupabaseClient,
  month: number,
  year: number
): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("month", month)
    .eq("year", year)
    .order("event_day");

  if (error || !data) return [];
  return data as CalendarEvent[];
}