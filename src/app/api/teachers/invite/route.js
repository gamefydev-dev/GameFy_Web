// app/api/teachers/invite/route.js
import { NextResponse } from 'next/server'

import { createClient } from '@supabase/supabase-js'

export async function POST(req) {
  try {
    const { email, name, password } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'email_required' }, { status: 400 })
    }

    // ---- ENVs (com fallbacks e validação) ----
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL

    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE

    if (!SUPABASE_URL) {
      return NextResponse.json({ error: 'SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL is missing' }, { status: 500 })
    }

    if (!SERVICE_ROLE) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE is missing' }, { status: 500 })
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.gamefy.education/'

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // ---- MODO B: criar com senha padrão + magic link opcional ----
    if (password) {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'teacher', name }
      })

      if (createErr) {
        return NextResponse.json({ error: createErr.message }, { status: 400 })
      }

      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: `${origin}/dashboard/academico` }
      })

      return NextResponse.json({
        ok: true,
        userId: created.user?.id,
        linkPreview: linkErr ? null : linkData?.properties?.action_link || linkData?.action_link || null
      })
    }

    // ---- MODO A: convite (define senha no 1º acesso) ----
    const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: { role: 'teacher', name },
        redirectTo: `${origin}/dashboard/academico`
      }
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      linkPreview: linkData?.properties?.action_link || linkData?.action_link || null
    })
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
}
