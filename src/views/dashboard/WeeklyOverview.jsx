'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import dynamic from 'next/dynamic'

import Card from '@mui/material/Card'
import Button from '@mui/material/Button'
import { useTheme } from '@mui/material/styles'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import CardContent from '@mui/material/CardContent'

import OptionsMenu from '@core/components/option-menu'
import { supabase } from '@/libs/supabaseAuth'

// Evita SSR do Apex
const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'), { ssr: false })

// Helpers de datas (TZ do navegador)
const startOfWeekSunday = d => {
  const date = new Date(d)
  const day = date.getDay() // 0 = Dom

  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - day)

  return date
}

const endOfWeekSaturday = d => {
  const start = startOfWeekSunday(d)
  const end = new Date(start)

  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return end
}

const PT_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function WeeklyOverview() {
  const theme = useTheme()
  const [dataByDay, setDataByDay] = useState([0, 0, 0, 0, 0, 0, 0])
  const [loading, setLoading] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)

    try {
      // Janela: semana atual (Dom..Sáb) no fuso local
      const now = new Date()
      const weekStart = startOfWeekSunday(now)
      const weekEnd = endOfWeekSaturday(now)

      // Para o filtro no banco (timestampz), mandamos em ISO (UTC)
      const isoFrom = new Date(weekStart.getTime() - weekStart.getTimezoneOffset() * 60000).toISOString()
      const isoTo = new Date(weekEnd.getTime() - weekEnd.getTimezoneOffset() * 60000).toISOString()

      // 1) evaluations (grupo)
      const { data: evs, error: errE } = await supabase
        .from('evaluations')
        .select('created_at')
        .gte('created_at', isoFrom)
        .lte('created_at', isoTo)

      if (errE) throw errE

      // 2) students_evaluation (individuais)
      const { data: sevs, error: errS } = await supabase
        .from('students_evaluation')
        .select('created_at')
        .gte('created_at', isoFrom)
        .lte('created_at', isoTo)

      if (errS) throw errS

      // Agrega por dia local (0..6 = Dom..Sáb)
      const buckets = [0, 0, 0, 0, 0, 0, 0]

      const bump = iso => {
        const d = new Date(iso) // convertido para local automaticamente
        const idx = d.getDay()

        buckets[idx] += 1
      }

      ;(evs || []).forEach(r => bump(r.created_at))
      ;(sevs || []).forEach(r => bump(r.created_at))

      setDataByDay(buckets)
    } catch (e) {
      setDataByDay([0, 0, 0, 0, 0, 0, 0])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData, reloadKey])

  const options = useMemo(() => {
    const divider = 'var(--mui-palette-divider)'
    const textDisabled = 'var(--mui-palette-text-disabled)'

    return {
      chart: {
        parentHeightOffset: 0,
        toolbar: { show: false },
        animations: { enabled: true }
      },
      plotOptions: {
        bar: {
          borderRadius: 8,
          columnWidth: '44%'
        }
      },
      stroke: {
        width: 2,
        colors: ['var(--mui-palette-background-paper)']
      },
      legend: { show: false },
      grid: {
        borderColor: divider,
        strokeDashArray: 6,
        padding: { left: 0, right: 6, top: 0, bottom: 6 },
        xaxis: { lines: { show: false } }
      },
      dataLabels: { enabled: false },
      colors: ['var(--mui-palette-primary-main)'],
      states: {
        hover: { filter: { type: 'none' } },
        active: { filter: { type: 'none' } }
      },
      xaxis: {
        categories: PT_DAYS,
        tickPlacement: 'on',
        labels: {
          show: true,
          style: { colors: textDisabled, fontSize: theme.typography.body2.fontSize }
        },
        axisTicks: { show: false },
        axisBorder: { show: false }
      },
      yaxis: {
        min: 0,
        tickAmount: 4,
        forceNiceScale: true,
        labels: {
          offsetY: 2,
          offsetX: -8,
          style: { colors: textDisabled, fontSize: theme.typography.body2.fontSize },
          formatter: value => `${Number(value).toFixed(0)}`
        }
      },
      tooltip: {
        shared: false,
        intersect: true,
        y: { formatter: val => `${val}` }
      },
      responsive: [
        { breakpoint: 900, options: { plotOptions: { bar: { columnWidth: '55%' } } } },
        {
          breakpoint: 600,
          options: {
            plotOptions: { bar: { columnWidth: '65%' } },
            xaxis: { labels: { style: { fontSize: '11px' } } }
          }
        }
      ]
    }
  }, [theme])

  // Série do gráfico vinda do banco
  const series = useMemo(() => [{ name: 'Avaliações', data: dataByDay }], [dataByDay])
  const totalSemana = useMemo(() => dataByDay.reduce((a, b) => a + b, 0), [dataByDay])

  return (
    <Card>
      <CardHeader
        title='Visão Semanal'
        subheader='Total diário de avaliações'
        action={
          <OptionsMenu
            iconClassName='text-textPrimary'
            options={['Recarregar']}
            onClickMenuItem={opt => {
              if (opt === 'Recarregar') setReloadKey(k => k + 1)
            }}
          />
        }
      />
      <CardContent sx={{ '& .apexcharts-xcrosshairs.apexcharts-active': { opacity: 0 } }}>
        <AppReactApexCharts type='bar' height={220} width='100%' series={series} options={options} />

        <div className='flex items-center mbe-4 gap-4'>
          <Typography variant='h4'>{loading ? '...' : totalSemana}</Typography>
          <Typography>Total de lançamentos nesta semana</Typography>
        </div>

        <Button fullWidth variant='contained' onClick={() => setReloadKey(k => k + 1)} disabled={loading}>
          {loading ? 'Carregando...' : 'Detalhes / Recarregar'}
        </Button>
      </CardContent>
    </Card>
  )
}
