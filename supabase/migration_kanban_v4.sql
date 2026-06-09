-- ============================================================
-- MAIA-ACV — Kanban "Rotina" v4 — Responsável pelo cartão
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Vendedor responsável pelo cartão (opcional)
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
