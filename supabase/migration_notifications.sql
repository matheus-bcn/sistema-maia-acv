-- Tabela de notificações in-app por vendedor
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id  UUID    REFERENCES public.sellers(id) ON DELETE CASCADE,
  type       TEXT    NOT NULL, -- 'meta_batida' | 'meta_em_risco' | 'arena_x1' | 'cliente_dormente' | 'ranking'
  title      TEXT    NOT NULL,
  message    TEXT,
  is_read    BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_seller ON public.notifications (seller_id, is_read, created_at DESC);
