import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // Inicializa a resposta que o middleware vai retornar
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Cria um cliente Supabase específico para o Middleware
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

  // Pergunta ao Supabase: "Quem é esse utilizador que está a tentar aceder à página?"
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoginPage = request.nextUrl.pathname.startsWith('/login')

  // REGRA 1: Se NÃO tem utilizador logado e ele NÃO está na página de login -> Manda para o Login
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // REGRA 2: Se TEM utilizador logado e ele tenta aceder à página de login -> Manda para o Dashboard
  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Se passou pelas regras, deixa o utilizador seguir o caminho normalmente
  return supabaseResponse
}

// Configuração de quais rotas o "guarda-costas" deve vigiar
export const config = {
  matcher: [
    /*
     * Vigia todas as rotas da aplicação, EXCETO:
     * - _next/static (ficheiros estáticos de código)
     * - _next/image (ficheiros de otimização de imagem)
     * - favicon.ico (ícone do site)
     * - Qualquer ficheiro com extensão de imagem/vetor (.svg, .png, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}