'use client'

import React, { useEffect, useMemo, useState } from 'react'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'

// Charts (Recharts)
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts'

import { supabase, isAdmin } from '@/libs/supabaseAuth'

const dayMS = 24 * 60 * 60 * 1000
const fmtDay = d => new Date(d).toLocaleDateString()

function buildZeroSeries(from, to) {
  const out = []
  let t = from

  while (t <= to) {
    out.push({ date: new Date(t), value: 0 })
    t += dayMS
  }

  return out
}

function inc(map, key) {
  map.set(key, (map.get(key) || 0) + 1)
}

export default function MetricasDashboardPage() {
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState(30) // 7 | 30 | 90

  const [regsSeries, setRegsSeries] = useState([])
  const [favSeries, setFavSeries] = useState([])

  useEffect(() => {
    ;(async () => {
      const ok = await isAdmin()

      setAllowed(ok)
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      if (!allowed) {
        setLoading(false)

        return
      }

      setLoading(true)
      const to = Date.now()
      const from = to - range * dayMS
      const fromIso = new Date(from).toISOString()

      // registros
      const { data: regs } = await supabase.from('event_registrations').select('created_at').gte('created_at', fromIso)

      // favoritos
      const { data: favs } = await supabase.from('event_favorites').select('created_at').gte('created_at', fromIso)

      const base = buildZeroSeries(from, to)
      const mapR = new Map(base.map(p => [fmtDay(p.date), 0]))

      const mapF = new Map(base.map(p => [fmtDay(p.date), 0]))

      ;(regs || []).forEach(r => inc(mapR, fmtDay(r.created_at)))
      ;(favs || []).forEach(r => inc(mapF, fmtDay(r.created_at)))

      setRegsSeries(Array.from(mapR, ([label, value]) => ({ label, value })))
      setFavSeries(Array.from(mapF, ([label, value]) => ({ label, value })))
      setLoading(false)
    })()
  }, [allowed, range])

  if (!allowed)
    return (
      <Card>
        <CardHeader title='Acesso restrito' />
        <CardContent>
          <Typography>Área exclusiva de professores/administradores.</Typography>
        </CardContent>
      </Card>
    )

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Card>
          <CardHeader
            title='Métricas gerais'
            action={
              <ToggleButtonGroup size='small' value={range} exclusive onChange={(e, v) => v && setRange(v)}>
                <ToggleButton value={7}>7d</ToggleButton>
                <ToggleButton value={30}>30d</ToggleButton>
                <ToggleButton value={90}>90d</ToggleButton>
              </ToggleButtonGroup>
            }
          />
          <CardContent>
            {loading ? (
              <Skeleton variant='rounded' height={360} />
            ) : (
              <div style={{ width: '100%', height: 360 }}>
                <ResponsiveContainer>
                  <LineChart data={regsSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray='3 3' />
                    <XAxis dataKey='label' tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line type='monotone' dataKey='value' strokeWidth={2} name='Inscrições' />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card>
          <CardHeader title='Favoritos por dia' />
          <CardContent>
            {loading ? (
              <Skeleton variant='rounded' height={320} />
            ) : (
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={favSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray='3 3' />
                    <XAxis dataKey='label' tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey='value' name='Favoritos' />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
