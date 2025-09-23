// app/auth/callback/route.js
import { NextResponse } from 'next/server'

import { cookies } from 'next/headers'

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function GET(req) {
  const requestUrl = new URL(req.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })

    // troca o código pela sessão e grava cookie
    await supabase.auth.exchangeCodeForSession(code)
  }

  // se tiver ?redirect no query string, redireciona pra lá
  const redirectTo = requestUrl.searchParams.get('redirect') || '/'

  return NextResponse.redirect(new URL(redirectTo, requestUrl.origin))
}
