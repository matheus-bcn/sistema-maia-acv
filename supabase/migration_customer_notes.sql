-- Tabela para observações por cliente (CRM)
CREATE TABLE IF NOT EXISTS public.customer_notes (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT  NOT NULL UNIQUE,
  note        TEXT    NOT NULL DEFAULT '',
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_notes_name ON public.customer_notes (customer_name);
