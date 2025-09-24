// src/app/api/send-precadastro/route.js
import { NextResponse } from 'next/server'

import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY // não expor no client

  if (!url || !key) return null

  return createClient(url, key, { auth: { persistSession: false } })
})()

export async function POST(req) {
  try {
    const body = await req.json()

    const { fromName, fromEmail, replyTo, subject, template, linkCadastro, recipients, testMode, testEmail } =
      body || {}

    if (!process.env.UMBLER_SMTP_USER || !process.env.UMBLER_SMTP_PASS) {
      return NextResponse.json({ error: 'Credenciais SMTP ausentes' }, { status: 500 })
    }

    const transporter = nodemailer.createTransport({
      host: process.env.UMBLER_SMTP_HOST || 'smtp.umbler.com',
      port: Number(process.env.UMBLER_SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.UMBLER_SMTP_USER,
        pass: process.env.UMBLER_SMTP_PASS
      }
    })

    const list = Array.isArray(recipients) ? recipients : []
    const targetList = testMode && testEmail ? [{ name: 'Teste', email: testEmail, category: 'TEST' }] : list

    const sleep = ms => new Promise(r => setTimeout(r, ms))

    let sent = 0
    let failed = 0
    const report = []

    for (const r of targetList) {
      const name = r && r.name ? r.name : 'Aluno'
      const email = r && r.email ? r.email : null
      const category = r && r.category ? r.category : null

      if (!email) {
        failed += 1
        report.push('❌ (sem e-mail)')

        if (supabaseAdmin) {
          await supabaseAdmin.from('mail_logs').insert({
            recipient_email: null,
            recipient_name: name,
            subject: subject || '[GameFy] Pré-cadastro de aluno',
            from_email: fromEmail || process.env.UMBLER_SMTP_USER,
            category,
            status: 'FAILED',
            error_message: 'E-mail ausente',
            payload: { testMode, linkCadastro }
          })
        }

        continue
      }

      const personalize = str =>
        (str || '')
          .split('{{name}}')
          .join(name)
          .split('{{link}}')
          .join(linkCadastro || '')

      try {
        await transporter.sendMail({
          from: `${fromName || 'GameFy'} <${fromEmail || process.env.UMBLER_SMTP_USER}>`,
          to: email,
          subject: subject || '[GameFy] Pré-cadastro de aluno',
          text: personalize(template),
          replyTo: replyTo || fromEmail || process.env.UMBLER_SMTP_USER,
          envelope: {
            from: fromEmail || process.env.UMBLER_SMTP_USER,
            to: [email]
          }
        })

        sent += 1
        report.push(`✔️ ${email}`)

        if (supabaseAdmin) {
          await supabaseAdmin.from('mail_logs').insert({
            recipient_email: email,
            recipient_name: name,
            subject: subject || null,
            from_email: fromEmail || process.env.UMBLER_SMTP_USER,
            category,
            status: 'SENT',
            payload: { testMode, linkCadastro }
          })
        }
      } catch (e) {
        failed += 1
        const msg = e && e.message ? e.message : 'erro'

        report.push(`❌ ${email} → ${msg}`)

        if (supabaseAdmin) {
          await supabaseAdmin.from('mail_logs').insert({
            recipient_email: email,
            recipient_name: name,
            subject: subject || null,
            from_email: fromEmail || process.env.UMBLER_SMTP_USER,
            category,
            status: 'FAILED',
            error_message: msg,
            payload: { testMode, linkCadastro }
          })
        }
      }

      const delay = Number(process.env.UMBLER_SEND_DELAY_MS || 400)

      if (delay > 0) await sleep(delay)
    }

    return NextResponse.json({ ok: true, sent, failed, report: report.join('\n') })
  } catch (e) {
    return NextResponse.json({ error: e && e.message ? e.message : 'Erro inesperado' }, { status: 500 })
  }
}
