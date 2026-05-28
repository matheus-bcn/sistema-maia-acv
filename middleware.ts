import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  // Cria a resposta inicial
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Inicializa o cliente Supabase para o Edge Runtime
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Recria a resposta com os novos cookies
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Tenta obter o usuário
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith('/login');
  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth');
  const requireAuth = process.env.NEXT_PUBLIC_REQUIRE_AUTH === 'true';

  // REGRA DE BYPASS: Se não exige autenticação ou é rota de callback do Supabase (/auth), libera
  if (!requireAuth || isAuthRoute) {
    return supabaseResponse;
  }

  // REGRA 1: Sem usuário ou erro de sessão -> Redireciona para o login
  if ((!user || authError) && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // REGRA 2: Com usuário logado tentando acessar login -> Redireciona para o Dashboard
  if (user && !authError && isLoginPage) {
    const url = request.nextUrl.clone();
    const nextUrl = request.nextUrl.searchParams.get('next');
    url.pathname = nextUrl || '/';
    url.searchParams.delete('next');
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (.svg, .png, .jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};