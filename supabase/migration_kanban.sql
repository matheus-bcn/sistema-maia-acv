-- ============================================================
-- MAIA-ACV — Kanban "Rotina"
-- Execute no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS public.kanban_lists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id  UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kanban_cards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id     UUID NOT NULL REFERENCES public.kanban_lists(id) ON DELETE CASCADE,
  seller_id   UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kanban_lists_seller  ON public.kanban_lists(seller_id, position);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_list    ON public.kanban_cards(list_id, position);

ALTER TABLE public.kanban_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;

-- Cada vendedor vê e edita apenas seu próprio kanban
CREATE POLICY "kanban_lists_select" ON public.kanban_lists FOR SELECT TO authenticated USING (seller_id = auth.uid() OR public.is_admin());
CREATE POLICY "kanban_lists_insert" ON public.kanban_lists FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());
CREATE POLICY "kanban_lists_update" ON public.kanban_lists FOR UPDATE TO authenticated USING (seller_id = auth.uid() OR public.is_admin());
CREATE POLICY "kanban_lists_delete" ON public.kanban_lists FOR DELETE TO authenticated USING (seller_id = auth.uid() OR public.is_admin());

CREATE POLICY "kanban_cards_select" ON public.kanban_cards FOR SELECT TO authenticated USING (seller_id = auth.uid() OR public.is_admin());
CREATE POLICY "kanban_cards_insert" ON public.kanban_cards FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());
CREATE POLICY "kanban_cards_update" ON public.kanban_cards FOR UPDATE TO authenticated USING (seller_id = auth.uid() OR public.is_admin());
CREATE POLICY "kanban_cards_delete" ON public.kanban_cards FOR DELETE TO authenticated USING (seller_id = auth.uid() OR public.is_admin());
