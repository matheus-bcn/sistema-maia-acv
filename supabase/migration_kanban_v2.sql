-- ============================================================
-- MAIA-ACV — Kanban "Rotina" v2 — Cores, Prioridade e Prazo
-- Execute no SQL Editor do Supabase APÓS migration_kanban.sql
-- ============================================================

-- Cor da lista (violet, blue, emerald, yellow, orange, red, pink, cyan)
ALTER TABLE public.kanban_lists
  ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT 'violet';

-- Prioridade do cartão (Baixa, Normal, Alta)
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'Normal';

-- Prazo do cartão
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS due_date DATE;
