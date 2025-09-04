'use client'

// Next Imports
import { useEffect, useMemo, useState } from 'react'

import dynamic from 'next/dynamic'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Chip from '@mui/material/Chip'

// Styled Component Imports
const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'), { ssr: false })

// Supabase
import { supabase } from '@/libs/supabaseAuth'

// Helpers
const startOfDay = d => {
  const x = new Date(d)

  x.setHours(0, 0, 0, 0)

  return x
}

const addDays = (d, n) => {
  const x = new Date(d)

  x.setDate(x.getDate() + n)

  return x
}

const fmtLabel = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const LineChart = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [labels, setLabels] = useState([])
  const [counts, setCounts] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError('')

        const today = startOfDay(new Date())
        const from = addDays(today, -13) // 14 dias incluindo hoje
        const daysArr = Array.from({ length: 14 }, (_, i) => addDays(from, i))
        const dayKeys = daysArr.map(d => d.toISOString().slice(0, 10)) // yyyy-mm-dd

        // 🔎 TROQUE AQUI se sua tabela/colunas tiverem outro nome:
        // Tabela: checkins
        // Colunas usadas: checked_at (timestamp do checkin), student_id (id do aluno)
        const { data, error: err } = await supabase
          .from('checkins')
          .select('checked_at, student_id')
          .gte('checked_at', from.toISOString())

        if (err) throw err

        // Conta check-ins por dia (alunos presentes)
        const buckets = Object.fromEntries(dayKeys.map(k => [k, 0]))

        for (const row of data || []) {
          const key = startOfDay(row.checked_at).toISOString().slice(0, 10)

          if (buckets[key] !== undefined) buckets[key] += 1
        }

        setCounts(dayKeys.map(k => buckets[k] || 0))
        setLabels(daysArr.map(fmtLabel))
      } catch (e) {
        setError('Não foi possível carregar os check-ins.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  // Métricas de variação
  const last = counts[counts.length - 1] ?? 0
  const prev = counts[counts.length - 2] ?? 0
  const delta = last - prev
  const pct = prev > 0 ? (delta / prev) * 100 : last > 0 ? 100 : 0
  const up = delta > 0
  const same = delta === 0

  // Cores dinâmicas para o último ponto
  const primary = 'var(--mui-palette-primary-main)'
  const upColor = 'var(--mui-palette-success-main)'
  const downColor = 'var(--mui-palette-error-main)'
  const endPointColor = same ? primary : up ? upColor : downColor

  const series = useMemo(() => [{ name: 'Check-ins (Alunos presentes)', data: counts }], [counts])

  // Opções (mantém seu estilo minimalista, mas com legibilidade melhor)
  const options = useMemo(
    () => ({
      chart: {
        parentHeightOffset: 0,
        toolbar: { show: false },
        animations: { enabled: true }
      },
      grid: {
        strokeDashArray: 6,
        borderColor: 'var(--mui-palette-divider)',
        xaxis: { lines: { show: true } },
        yaxis: { lines: { show: false } },
        padding: { top: 0, left: 6, right: 6, bottom: 0 }
      },
      tooltip: {
        enabled: true,
        x: { show: true },
        y: { formatter: val => `${val} presente${val === 1 ? '' : 's'}` }
      },
      stroke: {
        width: 3,
        curve: 'smooth'
      },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 0.2,
          opacityFrom: 0.3,
          opacityTo: 0.05,
          stops: [0, 90, 100]
        }
      },
      colors: [primary],
      markers: {
        size: 0,
        strokeWidth: 3,
        colors: ['transparent'],
        strokeColors: 'transparent',
        discrete: counts.length
          ? [
              {
                seriesIndex: 0,
                dataPointIndex: counts.length - 1,
                size: 6,
                fillColor: 'var(--mui-palette-background-paper)',
                strokeColor: endPointColor
              }
            ]
          : []
      },
      xaxis: {
        categories: labels,
        labels: {
          show: true,
          style: { colors: 'var(--mui-palette-text-disabled)', fontSize: '12px' }
        },
        axisTicks: { show: false },
        axisBorder: { show: false }
      },
      yaxis: {
        min: 0,
        labels: {
          show: true,
          style: { colors: 'var(--mui-palette-text-disabled)', fontSize: '12px' }
        }
      }
    }),
    [labels, counts.length, endPointColor]
  )

  return (
    <Card>
      <CardContent>
        <div className='flex items-center justify-between gap-2 mbe-2'>
          <Typography variant='h6'>Presenças por dia (Check-ins)</Typography>
          <Chip
            size='small'
            icon={<i className={up ? 'ri-arrow-up-s-line' : same ? 'ri-subtract-line' : 'ri-arrow-down-s-line'} />}
            color={same ? 'secondary' : up ? 'success' : 'error'}
            variant='tonal'
            label={`${up ? '+' : ''}${delta} (${isFinite(pct) ? pct.toFixed(1) : '0.0'}%)`}
          />
        </div>

        {loading ? (
          <LinearProgress />
        ) : error ? (
          <Typography color='error'>{error}</Typography>
        ) : (
          <AppReactApexCharts type='area' height={220} width='100%' series={series} options={options} />
        )}

        <div className='flex items-center justify-between mt-3'>
          <Typography variant='body2' color='text.secondary'>
            Últimos 14 dias
          </Typography>
          <Typography variant='body2'>
            Hoje: <b>{last}</b> • Ontem: <b>{prev}</b>
          </Typography>
        </div>
      </CardContent>
    </Card>
  )
}

export default LineChart
