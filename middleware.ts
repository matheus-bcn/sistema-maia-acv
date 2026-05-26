import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Inicializa o cliente Supabase de forma totalmente segura para o Edge
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          
          supabaseResponse = NextResponse.next({
            request,
          })
          
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const isLoginPage = request.nextUrl.pathname.startsWith('/login')
    
    // Feature: Respeita a variável de ambiente para permitir modo demonstração/dev
    const requireAuth = process.env.NEXT_PUBLIC_REQUIRE_AUTH === 'true'

    // Se a autenticação não for exigida pelo sistema, libera todas as rotas
    if (!requireAuth) {
      return supabaseResponse
    }

    // REGRA 1: Sem sessão e fora do login -> Redireciona com memória de rota (Deep Linking)
    if (!user && !isLoginPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      // Salva a rota que o usuário tentou acessar
      url.searchParams.set('next', request.nextUrl.pathname)
      return NextResponse.redirect(url)
    }

    // REGRA 2: Com sessão e na tela de login -> Vai para o Dashboard ou recupera a rota salva
    if (user && isLoginPage) {
      const url = request.nextUrl.clone()
      const nextUrl = request.nextUrl.searchParams.get('next')
      
      url.pathname = nextUrl || '/'
      url.searchParams.delete('next')
      return NextResponse.redirect(url)
    }
  } catch (e) {
    console.error("Erro crítico de validação no middleware:", e)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}