-- Adiciona taxa de comissão na configuração da empresa
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS commission_rate     NUMERIC(5,2) DEFAULT 2.50,
  ADD COLUMN IF NOT EXISTS commission_rate_bonus NUMERIC(5,2) DEFAULT 4.00;

-- Adiciona campos de resultado na tabela de batalhas X1
ALTER TABLE public.x1_battles
  ADD COLUMN IF NOT EXISTS winner_id   UUID REFERENCES public.sellers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS winner_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS loser_amount  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS finished_at  TIMESTAMPTZ;
