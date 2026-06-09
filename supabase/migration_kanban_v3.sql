-- ============================================================
-- MAIA-ACV — Kanban "Rotina" v3 — Fix FK seller_id
-- Execute no SQL Editor do Supabase
-- ============================================================

-- A FK original apontava para sellers(id), causando erro quando o
-- admin não tem registro na tabela sellers.
-- Corrigido para referenciar auth.users(id) diretamente.

ALTER TABLE public.kanban_lists DROP CONSTRAINT IF EXISTS kanban_lists_seller_id_fkey;
ALTER TABLE public.kanban_cards  DROP CONSTRAINT IF EXISTS kanban_cards_seller_id_fkey;

ALTER TABLE public.kanban_lists ADD CONSTRAINT kanban_lists_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.kanban_cards ADD CONSTRAINT kanban_cards_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;
