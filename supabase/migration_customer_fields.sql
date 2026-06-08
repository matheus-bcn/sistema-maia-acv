-- ==============================================================================
-- MIGRAÇÃO: Campos de cliente nas vendas + índices para CRM
-- Execute no SQL Editor do Supabase
-- ==============================================================================

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS pdv_number    TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_customer_name ON public.sales (customer_name);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date     ON public.sales (sale_date DESC);
