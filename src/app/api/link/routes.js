import { NextResponse } from 'next/server'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ ok: false, error: 'Missing url' }, { status: 400 })
  }

  try {
    // tenta HEAD primeiro
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow' })

    // se o provedor bloquear HEAD ou vier status ruim, tenta GET sem baixar corpo inteiro (o Next faz streaming)
    if (!res.ok) {
      res = await fetch(url, { method: 'GET', redirect: 'follow' })
    }

    return NextResponse.json({ ok: res.ok })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
