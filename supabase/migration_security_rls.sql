-- Security hardening: enable RLS on tables that were missing it
-- Run this in the Supabase SQL Editor

-- ── NOTIFICATIONS ────────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Sellers read only their own notifications
CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid());

-- Any authenticated user can insert notifications (server actions notify other users)
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Sellers update (mark as read) only their own
CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- Sellers delete their own; admins delete any
CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (
    seller_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.sellers WHERE id = auth.uid() AND is_admin = true)
  );

-- ── MAIA_INSIGHTS ────────────────────────────────────────────────────────────
ALTER TABLE public.maia_insights ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read insights
CREATE POLICY "maia_insights_select" ON public.maia_insights
  FOR SELECT TO authenticated
  USING (true);

-- AI server actions insert insights (any authenticated user via server action)
CREATE POLICY "maia_insights_insert" ON public.maia_insights
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Only admins can delete insight history
CREATE POLICY "maia_insights_delete" ON public.maia_insights
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sellers WHERE id = auth.uid() AND is_admin = true));

-- ── CUSTOMER_NOTES ───────────────────────────────────────────────────────────
-- This is a shared CRM table (no per-user ownership column); all authenticated
-- users can read and write; only admins can delete.
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_notes_select" ON public.customer_notes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "customer_notes_insert" ON public.customer_notes
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "customer_notes_update" ON public.customer_notes
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "customer_notes_delete" ON public.customer_notes
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.sellers WHERE id = auth.uid() AND is_admin = true)
  );

-- ── X1_BATTLES ───────────────────────────────────────────────────────────────
ALTER TABLE public.x1_battles ENABLE ROW LEVEL SECURITY;

-- Only participants and admins can see a battle
CREATE POLICY "x1_battles_select" ON public.x1_battles
  FOR SELECT TO authenticated
  USING (
    challenger_id = auth.uid() OR
    challenged_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.sellers WHERE id = auth.uid() AND is_admin = true)
  );

-- Challenger must be the authenticated user
CREATE POLICY "x1_battles_insert" ON public.x1_battles
  FOR INSERT TO authenticated
  WITH CHECK (challenger_id = auth.uid());

-- Participants can update (accept/refuse/finalize); admins can update any
CREATE POLICY "x1_battles_update" ON public.x1_battles
  FOR UPDATE TO authenticated
  USING (
    challenger_id = auth.uid() OR
    challenged_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.sellers WHERE id = auth.uid() AND is_admin = true)
  );

-- Only admins can delete battles
CREATE POLICY "x1_battles_delete" ON public.x1_battles
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sellers WHERE id = auth.uid() AND is_admin = true));

-- ── COMPANY_SETTINGS (if the table exists in your DB) ────────────────────────
-- Run this block only if you applied migration_commission_and_battles.sql first.
-- ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "company_settings_select" ON public.company_settings
--   FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "company_settings_update" ON public.company_settings
--   FOR UPDATE TO authenticated
--   USING (EXISTS (SELECT 1 FROM public.sellers WHERE id = auth.uid() AND is_admin = true));
