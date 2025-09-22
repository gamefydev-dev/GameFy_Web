// /middleware.js ou /src/middleware.js
import { NextResponse } from 'next/server'

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

// Rotas públicas (prefixos)
const PUBLIC_PREFIXES = ['/login', '/register']

// Arquivos públicos
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

function isApiUnprotected(pathname) {
  return pathname.startsWith('/api/public')
}

function isPublicRoute(pathname) {
  if (PUBLIC_FILES.has(pathname)) return true

  return PUBLIC_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))
}

export async function middleware(req) {
  const { nextUrl } = req
  const pathname = nextUrl.pathname || '/'

  // Libera estáticos, arquivos e rotas públicas
  if (isStaticPath(pathname) || isApiUnprotected(pathname) || isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // ✅ Use as VARS PÚBLICAS (NÃO use SERVICE_ROLE no middleware)
  const supabaseUrl = process.env.NEXT_PUBLIC_URL
  const supabaseKey = process.env.NEXT_PUBLIC_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase ENV faltando: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env')
    const to = new URL('/login', req.url)
    const dest = pathname + (nextUrl.search || '')

    to.searchParams.set('redirect', dest)

    return NextResponse.redirect(to)
  }

  const res = NextResponse.next()

  // ✅ Passe URL + ANON KEY
  const supabase = createMiddlewareClient({ req, res }, { supabaseUrl, supabaseKey })

  // Obtém sessão com segurança
  let session = null

  try {
    const { data } = await supabase.auth.getSession()

    session = data?.session ?? null
  } catch (e) {
    console.error('Erro ao obter sessão no middleware:', e)
    session = null
  }

  // Se não logado → /login?redirect=...
  if (!session?.user?.id) {
    const to = new URL('/login', req.url)
    const dest = pathname + (nextUrl.search || '')

    to.searchParams.set('redirect', dest)

    return NextResponse.redirect(to)
  }

  // Logado em rota protegida → segue
  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|ico|gif|webp|avif|css|js|txt|map|woff2?|ttf|eot)).*)'
  ]
}
