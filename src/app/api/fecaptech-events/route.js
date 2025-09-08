// src/app/api/fecaptech-events/route.js
import ical from 'node-ical'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ID do calendário público (extraído do link de embed que você mandou)
const CAL_ID = '23d4d40fe92788d0350669db9c72b287443f0e59c0cd8c7b9887d4c1e51794f6@group.calendar.google.com'

// URL pública ICS do Google Calendar (formato padrão p/ calendários públicos)
const ICS_URL = `https://calendar.google.com/calendar/ical/${encodeURIComponent(CAL_ID)}/public/basic.ics`

function toIso(d) {
  return new Date(d).toISOString()
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)

    // range opcional por query (?start=...&end=...). Se não vier, usa janela padrão
    const start = new Date(searchParams.get('start') || Date.now() - 30 * 864e5)
    const end = new Date(searchParams.get('end') || Date.now() + 90 * 864e5)

    // Baixa e faz parse do ICS
    const data = await ical.async.fromURL(ICS_URL)

    const out = []

    for (const key in data) {
      const ev = data[key]

      if (!ev || ev.type !== 'VEVENT') continue

      const base = {
        title: ev.summary || '',
        description: ev.description || '',
        location: ev.location || '',

        // cor opcional para diferenciar a origem:
        color: '#00bcd4'
      }

      // Duração do evento base (usada para instâncias recorrentes)
      const baseStart = ev.start
      const baseEnd = ev.end || ev.dtend || ev.start
      const durationMs = baseStart && baseEnd ? baseEnd.getTime() - baseStart.getTime() : 0

      // 1) Eventos RECORRENTES (RRULE + overrides)
      if (ev.rrule) {
        // Overrides (RECURRENCE-ID) dentro do range
        if (ev.recurrences) {
          for (const k in ev.recurrences) {
            const over = ev.recurrences[k]
            const st = over.start || over.dtstart

            if (!st || st < start || st > end) continue
            const en = over.end || new Date(st.getTime() + durationMs)

            out.push({
              id: `fecap:${over.uid || ev.uid}:${st.toISOString()}`,
              ...base,
              title: over.summary || base.title,
              start: toIso(st),
              end: toIso(en),
              allDay: over.datetype === 'date',
              extendedProps: { source: 'fecaptech' }
            })
          }
        }

        // Instâncias geradas pela RRULE, respeitando EXDATE e overrides
        const exdates = ev.exdate || {}
        const dates = ev.rrule.between(start, end, true) // inclui limites

        dates.forEach(dt => {
          const stamp = dt.toISOString()

          const excluded = Object.keys(exdates || {}).some(x => new Date(x).toISOString() === stamp)

          const hasOverride = ev.recurrences && ev.recurrences[stamp]

          if (excluded || hasOverride) return

          const en = new Date(dt.getTime() + durationMs)

          out.push({
            id: `fecap:${ev.uid || ev.summary}:${stamp}`,
            ...base,
            start: toIso(dt),
            end: toIso(en),
            allDay: ev.datetype === 'date',
            extendedProps: { source: 'fecaptech' }
          })
        })

        continue
      }

      // 2) Eventos SIMPLES
      if (ev.start) {
        if (baseEnd < start || baseStart > end) continue
        out.push({
          id: `fecap:${ev.uid || ev.summary}:${baseStart.toISOString()}`,
          ...base,
          start: toIso(baseStart),
          end: toIso(baseEnd),
          allDay: ev.datetype === 'date',
          extendedProps: { source: 'fecaptech' }
        })
      }
    }

    return new Response(JSON.stringify({ events: out }), {
      headers: {
        'content-type': 'application/json',

        // cache em edge/CDN por 5 min
        'cache-control': 'public, s-maxage=300, stale-while-revalidate=60'
      }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    })
  }
}
