'use client'

// Next Imports
import { useMemo } from 'react'

import dynamic from 'next/dynamic'

// MUI Imports
import Card from '@mui/material/Card'
import Button from '@mui/material/Button'
import { useTheme } from '@mui/material/styles'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import CardContent from '@mui/material/CardContent'

// Components Imports
import OptionsMenu from '@core/components/option-menu'

// Styled Component Imports
const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'), { ssr: false })

const WeeklyOverview = () => {
  const theme = useTheme()

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
          columnWidth: '44%' // um pouco mais “respirado”
          // distributed: false  // <- removido para evitar bug visual
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
      colors: ['var(--mui-palette-primary-main)'], // cor única consistente
      states: {
        hover: { filter: { type: 'none' } },
        active: { filter: { type: 'none' } }
      },
      xaxis: {
        categories: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
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
          formatter: value => `${Number(value).toFixed(0)}` // sem “k”
        }
      },
      tooltip: {
        shared: false,
        intersect: true,
        y: {
          formatter: val => `${val}`
        }
      },
      responsive: [
        {
          breakpoint: 900,
          options: {
            plotOptions: { bar: { columnWidth: '55%' } }
          }
        },
        {
          breakpoint: 600,
          options: {
            plotOptions: { bar: { columnWidth: '65%' } },
            xaxis: {
              labels: { style: { fontSize: '11px' } }
            }
          }
        }
      ]
    }
  }, [theme])

  const series = useMemo(() => [{ name: 'Avaliações', data: [37, 57, 45, 75, 57, 40, 65] }], [])

  return (
    <Card>
      <CardHeader
        title='Visão Semanal'
        subheader='Total diário de avaliações'
        action={<OptionsMenu iconClassName='text-textPrimary' options={['Recarregar', 'Atualizar', 'Excluir']} />}
      />
      <CardContent sx={{ '& .apexcharts-xcrosshairs.apexcharts-active': { opacity: 0 } }}>
        <AppReactApexCharts type='bar' height={220} width='100%' series={series} options={options} />

        <div className='flex items-center mbe-4 gap-4'>
          <Typography variant='h4'>45%</Typography>
          <Typography>Desempenho 45% melhor que a semana passada 😎</Typography>
        </div>

        <Button fullWidth variant='contained'>
          Detalhes
        </Button>
      </CardContent>
    </Card>
  )
}

export default WeeklyOverview
