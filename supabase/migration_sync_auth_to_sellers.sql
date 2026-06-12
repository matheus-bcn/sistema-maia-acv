-- PASSO 1: Cria linhas na tabela sellers para usuários que só existem no Auth
INSERT INTO public.sellers (id, name, email, phone, status, is_admin, role)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)) AS name,
  u.email,
  ''               AS phone,
  'Ativo'          AS status,
  false            AS is_admin,
  'Vendedor Pleno' AS role
FROM auth.users u
LEFT JOIN public.sellers s ON s.id = u.id
WHERE s.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- PASSO 2: Marca o admin como is_admin = true
-- Troque pelo e-mail real do admin se necessário
UPDATE public.sellers
SET is_admin = true
WHERE email = 'matheusandrade050@gmail.com';
