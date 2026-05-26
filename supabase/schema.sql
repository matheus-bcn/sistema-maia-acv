-- ==============================================================================
-- MAIA-ACV — Schema, RLS e RBAC (Role-Based Access Control) Refatorado
-- Execute no SQL Editor do Supabase
-- ==============================================================================

-- 1. Criação das Tabelas
-- ------------------------------------------------------------------------------

-- Vendedores (Perfis integrados ao Supabase Auth)
CREATE TABLE IF NOT EXISTS public.sellers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'Vendedor Pleno',
  status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
  avatar TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vendas (Histórico comercial protegido)
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE RESTRICT, -- Impede deleção se houver vendas atreladas
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'Aprovado' CHECK (status IN ('Aprovado', 'Pendente', 'Cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_seller_id ON public.sales(seller_id);

-- Metas
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('equipe', 'individual')),
  target_value NUMERIC(12, 2) NOT NULL CHECK (target_value > 0),
  seller_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Garante a consistência da regra de negócio: equipe = sem seller_id, individual = com seller_id
  CONSTRAINT chk_goal_type CHECK (
    (type = 'equipe' AND seller_id IS NULL) OR 
    (type = 'individual' AND seller_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_goals_type ON public.goals(type, created_at DESC);

-- Eventos do calendário (Otimizado com tipo DATE nativo)
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('reuniao', 'campanha', 'fechamento')),
  event_date DATE NOT NULL, -- Agrupa dia, mês e ano nativamente para alta performance em queries
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_date ON public.calendar_events(event_date DESC);


-- 2. Habilitação do Row Level Security (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;


-- 3. Função Helper para o RBAC (Verifica se o usuário é Admin)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sellers
    WHERE id = auth.uid() AND is_admin = true
  );
$$ LANGUAGE sql SECURITY DEFINER;


-- 4. Limpeza de Políticas Antigas
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "sellers_select_auth" ON public.sellers;
DROP POLICY IF EXISTS "sellers_insert_admin" ON public.sellers;
DROP POLICY IF EXISTS "sellers_update_admin" ON public.sellers;
DROP POLICY IF EXISTS "sellers_delete_admin" ON public.sellers;

DROP POLICY IF EXISTS "sales_select_auth" ON public.sales;
DROP POLICY IF EXISTS "sales_insert_auth" ON public.sales;
DROP POLICY IF EXISTS "sales_update_admin" ON public.sales;
DROP POLICY IF EXISTS "sales_delete_admin" ON public.sales;

DROP POLICY IF EXISTS "goals_select_auth" ON public.goals;
DROP POLICY IF EXISTS "goals_insert_admin" ON public.goals;
DROP POLICY IF EXISTS "goals_update_admin" ON public.goals;
DROP POLICY IF EXISTS "goals_delete_admin" ON public.goals;

DROP POLICY IF EXISTS "events_select_auth" ON public.calendar_events;
DROP POLICY IF EXISTS "events_insert_admin" ON public.calendar_events;
DROP POLICY IF EXISTS "events_update_admin" ON public.calendar_events;
DROP POLICY IF EXISTS "events_delete_admin" ON public.calendar_events;


-- 5. Novas Políticas Seguras com RBAC e Proteção contra Spoofing
-- ------------------------------------------------------------------------------

-- SELLERS
CREATE POLICY "sellers_select_auth" ON public.sellers FOR SELECT TO authenticated USING (true);
CREATE POLICY "sellers_insert_admin" ON public.sellers FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "sellers_update_admin" ON public.sellers FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "sellers_delete_admin" ON public.sellers FOR DELETE TO authenticated USING (public.is_admin());

-- SALES
CREATE POLICY "sales_select_auth" ON public.sales FOR SELECT TO authenticated USING (true);
-- Segurado: Vendedor só insere para ele mesmo. Admin insere para qualquer um.
CREATE POLICY "sales_insert_auth" ON public.sales FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid() OR public.is_admin());
CREATE POLICY "sales_update_admin" ON public.sales FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "sales_delete_admin" ON public.sales FOR DELETE TO authenticated USING (public.is_admin());

-- GOALS
CREATE POLICY "goals_select_auth" ON public.goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "goals_insert_admin" ON public.goals FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "goals_update_admin" ON public.goals FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "goals_delete_admin" ON public.goals FOR DELETE TO authenticated USING (public.is_admin());

-- CALENDAR EVENTS
CREATE POLICY "events_select_auth" ON public.calendar_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "events_insert_admin" ON public.calendar_events FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "events_update_admin" ON public.calendar_events FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "events_delete_admin" ON public.calendar_events FOR DELETE TO authenticated USING (public.is_admin());


-- 6. Automação: Sincronização automática com Supabase Auth
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.sellers (id, name, email, role, is_admin, status)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), -- Usa metadado do nome ou o prefixo do email
    new.email,
    'Vendedor Pleno',
    false,
    'Ativo'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger ativa sempre que um usuário confirma o email/cadastro no Auth do Supabase
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 7. Seed de Configurações Globais (Metas de Equipe iniciais)
-- ------------------------------------------------------------------------------
-- NOTA: Vendedores reais agora devem ser criados via aba "Authentication" do Supabase
-- para disparar a trigger acima e garantir IDs válidos e funcionais.
INSERT INTO public.goals (type, target_value) 
VALUES ('equipe', 150000.00)
ON CONFLICT DO NOTHING;