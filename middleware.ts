import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // 1. Cria a resposta padrão
  let supabaseResponse = NextResponse.next({
    request,
  })

  // 2. Inicializa o cliente Supabase de forma totalmente segura para a Vercel
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // CORREÇÃO CRÍTICA: No 'request' passamos apenas name e value (sem as options que quebram o Edge)
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          
          supabaseResponse = NextResponse.next({
            request,
          })
          
          // No 'response' sim, passamos as opções completas de segurança
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 3. Valida a sessão do utilizador
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const isLoginPage = request.nextUrl.pathname.startsWith('/login')

    // REGRA 1: Se não está logado e não está no login -> Vai para o Login
    if (!user && !isLoginPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // REGRA 2: Se já está logado e tenta ir ao login -> Vai para o Dashboard
    if (user && isLoginPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  } catch (e) {
    // Evita que falhas temporárias de rede quebrem o carregamento da página
    console.error("Erro crítico de validação no middleware:", e)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Monitoriza todas as rotas, exceto ficheiros estáticos e imagens comuns
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}