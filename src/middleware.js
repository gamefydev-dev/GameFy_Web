// /middleware.js
import { NextResponse } from 'next/server'

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

// Rotas públicas ou que PRECISAM estar livres para o login completar
const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/auth', // inclui /auth/callback e outras rotas de auth
  '/api/public' // sua API pública (se tiver)
]

// Arquivos públicos / assets
const PUBLIC_FILES = new Set([
  '/favicon.ico',
  '/manifest.webmanifest',
  '/robots.txt',
  '/sitemap.xml',
  '/site.webmanifest'
])

function isStaticPath(pathname) {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/assets/') ||
    /\.(png|jpg|jpeg|svg|ico|gif|webp|avif|css|js|txt|map|woff2?|ttf|eot)$/.test(pathname)
  )
}

function isPublicRoute(pathname) {
  if (PUBLIC_FILES.has(pathname)) return true

  return PUBLIC_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))
}

// 🔒 Diga explicitamente o que você quer proteger
// (ex.: tudo em /app e /dashboard). Isso evita bloquear login por engano.
function isProtectedRoute(pathname) {
  return pathname.startsWith('/app') || pathname.startsWith('/dashboard')
}

export async function middleware(req) {
  const { nextUrl } = req
  const pathname = nextUrl.pathname || '/'

  // 1) Libera assets, rotas públicas e tudo que não é protegido
  if (isStaticPath(pathname) || isPublicRoute(pathname) || !isProtectedRoute(pathname)) {
    return NextResponse.next()
  }

  // 2) Resposta mutável para o Supabase gravar cookies quando necessário
  const res = NextResponse.next()

  // 3) Client do Supabase (lê NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY do .env)
  const supabase = createMiddlewareClient({ req, res })

  // 4) Obtém sessão
  let session = null

  try {
    const { data, error } = await supabase.auth.getSession()

    if (error) console.error('Supabase getSession error (middleware):', error)
    session = data?.session ?? null
  } catch (e) {
    console.error('Exceção ao obter sessão no middleware:', e)
  }

  // Header de diagnóstico útil (veja no DevTools > Network)
  res.headers.set('x-mw-session', session?.user?.id ? 'present' : 'absent')

  // 5) Sem sessão → redireciona para /login?redirect=...
  if (!session?.user?.id) {
    const to = new URL('/login', req.url)
    const dest = pathname + (nextUrl.search || '')

    to.searchParams.set('redirect', dest)

    return NextResponse.redirect(to)
  }

  // 6) Sessão OK → segue
  return res
}

// 7) Matcher: execute o middleware só onde PODE haver páginas protegidas
// (economiza processamento e reduz falsos positivos)
export const config = {
  matcher: [
    // Ajuste conforme seu app. Exemplos:
    '/app/:path*',
    '/dashboard/:path*'

    // Se você tem páginas protegidas em / (home), adicione aqui:
    // '/'
  ]
}
