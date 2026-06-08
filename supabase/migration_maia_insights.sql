-- Histórico de insights gerados pela M.A.I.A
CREATE TABLE IF NOT EXISTS public.maia_insights (
  id         UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo       TEXT    NOT NULL,
  titulo     TEXT    NOT NULL,
  briefing   TEXT    NOT NULL,
  acao       TEXT    NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maia_insights_created ON public.maia_insights (created_at DESC);
