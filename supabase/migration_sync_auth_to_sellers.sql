-- Sincroniza usuários do Supabase Auth que não têm linha na tabela sellers.
-- Útil quando logins foram criados diretamente no painel do Supabase
-- sem passar pelo formulário de equipe da aplicação.
--
-- Execute no SQL Editor do Supabase.

INSERT INTO public.sellers (id, name, email, status, is_admin, role)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)) AS name,
  u.email,
  'Ativo'          AS status,
  false            AS is_admin,
  'Vendedor Pleno' AS role
FROM auth.users u
LEFT JOIN public.sellers s ON s.id = u.id
WHERE s.id IS NULL
ON CONFLICT (id) DO NOTHING;
