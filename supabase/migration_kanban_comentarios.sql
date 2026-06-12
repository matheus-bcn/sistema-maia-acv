-- ============================================================
-- MAIA-ACV — Kanban comentários por cartão
-- Execute no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS public.kanban_card_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kanban_comments_card ON public.kanban_card_comments(card_id, created_at);

ALTER TABLE public.kanban_card_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select" ON public.kanban_card_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments_insert" ON public.kanban_card_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "comments_delete" ON public.kanban_card_comments FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_admin());
