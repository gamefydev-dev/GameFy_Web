// /middleware.js
import { NextResponse } from 'next/server'

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

// ====== Rotas públicas ======
const PUBLIC_PREFIXES = ['/login', '/register', '/auth', '/api/public']

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

// ====== Áreas protegidas gerais ======
function isProtectedRoute(pathname) {
  return pathname.startsWith('/app') || pathname.startsWith('/dashboard')
}

// ====== Rotas proibidas para alunos ======
const BLOCKED_FOR_STUDENTS = [
  '/precadastro',
  '/professores/documentos',
  '/atribuir',
  '/precadastro-professores',
  '/forms'
]

function isBlockedForStudents(pathname) {
  return BLOCKED_FOR_STUDENTS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// ====== Páginas permitidas ao aluno dentro de /app (evitar loop) ======
const ALLOW_STUDENT_PAGES = ['/app/blocked_page']

function isAllowedStudentPage(pathname) {
  return ALLOW_STUDENT_PAGES.includes(pathname)
}

export async function middleware(req) {
  const { nextUrl } = req
  const pathname = nextUrl.pathname || '/'

  // 1) Libera assets e rotas públicas
  if (isStaticPath(pathname) || isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // 2) Decide se precisa aplicar guarda (rotas protegidas, bloqueios de aluno ou a HOME "/")
  const needsGuard = pathname === '/' || isProtectedRoute(pathname) || isBlockedForStudents(pathname)

  if (!needsGuard) return NextResponse.next()

  // 3) Supabase
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // 4) Sessão
  let session = null

  try {
    const { data, error } = await supabase.auth.getSession()

    if (error) console.error('Supabase getSession error (middleware):', error)
    session = data?.session ?? null
  } catch (e) {
    console.error('Exceção ao obter sessão no middleware:', e)
  }

  res.headers.set('x-mw-session', session?.user?.id ? 'present' : 'absent')

  // ====== REGRA DE HOME: "/" ======
  if (pathname === '/') {
    // Sem sessão → manda para login
    if (!session?.user?.id) {
      const to = new URL('/login', req.url)

      to.searchParams.set('redirect', '/')

      return NextResponse.redirect(to)
    }

    // Com sessão → descobre o papel para direcionar
    let role = null

    try {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle()

      role = prof?.role ?? null

      if (!role) {
        const { data: teacher } = await supabase.from('professors').select('id').eq('id', session.user.id).maybeSingle()

        if (teacher?.id) role = 'professor'
      }
    } catch (e) {
      console.error('Erro ao resolver papel do usuário no middleware (/):', e)
    }

    // Redireciona por perfil logado
    const url = req.nextUrl.clone()

    if (role === 'student') {
      url.pathname = '/alunos/notas'
    } else {
      url.pathname = '/dashboard' // ajuste se preferir '/app' ou outra
    }

    return NextResponse.redirect(url)
  }

  // 5) Para outras rotas: se não logado → login
  if (!session?.user?.id) {
    const to = new URL('/login', req.url)
    const dest = pathname + (nextUrl.search || '')

    to.searchParams.set('redirect', dest)

    return NextResponse.redirect(to)
  }

  // 6) Resolve papel para regras de aluno
  let role = null

  try {
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle()

    role = prof?.role ?? null

    if (!role) {
      const { data: teacher } = await supabase.from('professors').select('id').eq('id', session.user.id).maybeSingle()

      if (teacher?.id) role = 'professor'
    }
  } catch (e) {
    console.error('Erro ao resolver papel do usuário no middleware:', e)
  }

  res.headers.set('x-mw-role', role || 'unknown')

  // 7) Regras de aluno
  if (role === 'student') {
    if (isAllowedStudentPage(pathname)) return res

    if (isBlockedForStudents(pathname)) {
      const url = req.nextUrl.clone()

      url.pathname = '/app/blocked_page'
      url.searchParams.set('from', pathname)

      return NextResponse.redirect(url)
    }
  }

  // 8) OK
  return res
}

// 9) Matcher: inclui "/" para aplicar a regra de home
export const config = {
  matcher: [
    '/', // regra de home
    '/app/:path*',
    '/dashboard/:path*',
    '/precadastro',
    '/precadastro/:path*',
    '/professores/documentos',
    '/professores/documentos/:path*',
    '/atribuir',
    '/atribuir/:path*',
    '/precadastro-professores',
    '/precadastro-professores/:path*',
    '/forms',
    '/forms/:path*'
  ]
}
