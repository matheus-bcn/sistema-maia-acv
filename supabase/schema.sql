-- ==============================================================================
-- MAIA-ACV — Schema, RLS e RBAC (Role-Based Access Control)
-- Execute no SQL Editor do Supabase
-- ==============================================================================

-- 1. Criação das Tabelas
-- ------------------------------------------------------------------------------

-- Vendedores
CREATE TABLE IF NOT EXISTS sellers (
  id UUID PRIMARY KEY DEFAULT auth.uid(), -- Vinculado ao UUID do Auth do Supabase
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'Vendedor Pleno',
  status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
  avatar TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vendas
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES sellers(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'Aprovado' CHECK (status IN ('Aprovado', 'Pendente', 'Cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_seller_id ON sales(seller_id);

-- Metas
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('equipe', 'individual')),
  target_value NUMERIC(12, 2) NOT NULL CHECK (target_value > 0),
  seller_id UUID REFERENCES sellers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_type ON goals(type, created_at DESC);

-- Eventos do calendário
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('reuniao', 'campanha', 'fechamento')),
  event_day INT NOT NULL CHECK (event_day BETWEEN 1 AND 31),
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Habilitação do Row Level Security (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;


-- 3. Função Helper para o RBAC (Verifica se o usuário é Admin)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sellers
    WHERE id = auth.uid() AND is_admin = true
  );
$$ LANGUAGE sql SECURITY DEFINER;


-- 4. Limpeza das Políticas Antigas e Inseguras (P1)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "sellers_select_auth" ON sellers;
DROP POLICY IF EXISTS "sales_select_auth" ON sales;
DROP POLICY IF EXISTS "goals_select_auth" ON goals;
DROP POLICY IF EXISTS "events_select_auth" ON calendar_events;

DROP POLICY IF EXISTS "sellers_all_auth" ON sellers;
DROP POLICY IF EXISTS "sales_all_auth" ON sales;
DROP POLICY IF EXISTS "goals_all_auth" ON goals;
DROP POLICY IF EXISTS "events_all_auth" ON calendar_events;

DROP POLICY IF EXISTS "sales_anon_dev" ON sales;
DROP POLICY IF EXISTS "goals_anon_dev" ON goals;
DROP POLICY IF EXISTS "sellers_anon_dev" ON sellers;
DROP POLICY IF EXISTS "events_anon_dev" ON calendar_events;


-- 5. Novas Políticas com Autenticação e RBAC (P2)
-- ------------------------------------------------------------------------------

-- SELLERS (Vendedores)
-- Leitura: Qualquer membro autenticado
CREATE POLICY "sellers_select_auth" ON sellers FOR SELECT TO authenticated USING (true);
-- Escrita/Modificação: Apenas administradores
CREATE POLICY "sellers_insert_admin" ON sellers FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "sellers_update_admin" ON sellers FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "sellers_delete_admin" ON sellers FOR DELETE TO authenticated USING (public.is_admin());

-- SALES (Vendas)
-- Leitura: Qualquer membro autenticado
CREATE POLICY "sales_select_auth" ON sales FOR SELECT TO authenticated USING (true);
-- Inserção: Qualquer membro autenticado pode lançar uma venda
CREATE POLICY "sales_insert_auth" ON sales FOR INSERT TO authenticated WITH CHECK (true);
-- Modificação/Exclusão (Auditoria): Apenas administradores
CREATE POLICY "sales_update_admin" ON sales FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "sales_delete_admin" ON sales FOR DELETE TO authenticated USING (public.is_admin());

-- GOALS (Metas)
-- Leitura: Qualquer membro autenticado
CREATE POLICY "goals_select_auth" ON goals FOR SELECT TO authenticated USING (true);
-- Escrita/Modificação: Apenas administradores
CREATE POLICY "goals_insert_admin" ON goals FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "goals_update_admin" ON goals FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "goals_delete_admin" ON goals FOR DELETE TO authenticated USING (public.is_admin());

-- CALENDAR EVENTS (Eventos do Calendário)
-- Leitura: Qualquer membro autenticado
CREATE POLICY "events_select_auth" ON calendar_events FOR SELECT TO authenticated USING (true);
-- Escrita/Modificação: Apenas administradores
CREATE POLICY "events_insert_admin" ON calendar_events FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "events_update_admin" ON calendar_events FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "events_delete_admin" ON calendar_events FOR DELETE TO authenticated USING (public.is_admin());


-- 6. Seed Opcional (População Inicial)
-- ------------------------------------------------------------------------------
INSERT INTO sellers (id, name, email, phone, role, status, avatar, is_admin) VALUES
  (gen_random_uuid(), 'João Silva', 'joao.silva@maia.com', '(11) 98765-4321', 'Vendedor Sênior', 'Ativo', 'JS', false),
  (gen_random_uuid(), 'Ana Costa', 'ana.costa@maia.com', '(11) 91234-5678', 'Gerente Comercial', 'Ativo', 'AC', true),
  (gen_random_uuid(), 'Carlos Souza', 'carlos.souza@maia.com', '(11) 99876-5432', 'Vendedor Pleno', 'Ativo', 'CS', false),
  (gen_random_uuid(), 'Marcos Lima', 'marcos.lima@maia.com', '(11) 98888-7777', 'Vendedor Júnior', 'Ativo', 'ML', false),
  (gen_random_uuid(), 'Fernanda Alves', 'fernanda.alves@maia.com', '(11) 97777-6666', 'Vendedor Pleno', 'Inativo', 'FA', false)
ON CONFLICT (email) DO NOTHING;

INSERT INTO goals (type, target_value) VALUES ('equipe', 150000)
ON CONFLICT DO NOTHING;