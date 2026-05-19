import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // Inicializa a resposta base
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Proteção: Se as chaves sumirem por instabilidade, não quebra o servidor
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse
  }

  // Cria o cliente Supabase corrigido para o padrão de objetos do Next.js
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // CORREÇÃO AQUI: Passando o objeto completo (...options) para não quebrar os pedaços do token
          cookiesToSet.forEach(({ name, value, options }) => 
            request.cookies.set({ name, value, ...options })
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set({ name, value, ...options })
          )
        },
      },
    }
  )

  // Bloco de segurança para interceptar qualquer erro de rede ou sessão
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const isLoginPage = request.nextUrl.pathname.startsWith('/login')

    // REGRA 1: Sem utilizador -> vai para o Login
    if (!user && !isLoginPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // REGRA 2: Já está logado e tenta ir ao Login -> vai para o Dashboard
    if (user && isLoginPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  } catch (error) {
    console.error('Erro de autenticação no Middleware:', error)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Vigia todas as rotas da aplicação, exceto arquivos estáticos e imagens
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}