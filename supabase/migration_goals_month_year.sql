-- Adiciona coluna month_year na tabela goals
-- Esta coluna é necessária para upsert de metas por mês (evitar duplicatas)
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS month_year TEXT;

-- Índice para buscas por tipo + mês
CREATE INDEX IF NOT EXISTS idx_goals_type_month ON public.goals (type, month_year);

-- Índice para buscas por vendedor individual
CREATE INDEX IF NOT EXISTS idx_goals_seller_month ON public.goals (seller_id, month_year)
  WHERE seller_id IS NOT NULL;
