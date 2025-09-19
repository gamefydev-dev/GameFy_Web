'use client'

// React
import { useEffect, useMemo, useState } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'

// Components Imports
import OptionMenu from '@core/components/option-menu'
import CustomAvatar from '@core/components/mui/Avatar'

// Supabase
import { supabase } from '@/libs/supabaseAuth'

// ---------- Config ----------
const ONLINE_WINDOW_SECONDS = 120 // considera online se viu o app nos últimos 2 min

// Helpers de data (hoje)
function startOfDay(d = new Date()) {
  const x = new Date(d)

  x.setHours(0, 0, 0, 0)

  return x
}

function endOfDay(d = new Date()) {
  const x = new Date(d)

  x.setHours(23, 59, 59, 999)

  return x
}

const Transactions = () => {
  const [loading, setLoading] = useState(true)

  const [metrics, setMetrics] = useState({
    onlineStudents: 0,
    projectsEvaluatedToday: 0,
    formsAnsweredToday: 0
  })

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)

        // -------- 1) Alunos (students) + presença (user_presence) --------
        const { data: alunos, error: errUsers } = await supabase
          .from('professors')
          .select('id, role')
          .or('role.ilike.%aluno%,role.ilike.%aluna%,role.ilike.%student%')

        if (errUsers) throw errUsers

        let onlineCount = 0

        if (alunos?.length) {
          const ids = alunos.map(u => u.id).filter(Boolean)

          try {
            const { data: pres } = await supabase
              .from('user_presence')
              .select('user_id, status, last_seen')
              .in('user_id', ids)

            const now = Date.now()

            for (const p of pres || []) {
              const isOnlineFlag = String(p.status || '').toLowerCase() === 'online'
              const isRecent = p.last_seen && now - new Date(p.last_seen).getTime() <= ONLINE_WINDOW_SECONDS * 1000

              if (isOnlineFlag || isRecent) onlineCount += 1
            }
          } catch {
            // se user_presence ainda não existir, assume 0 online
            onlineCount = 0
          }
        }

        // -------- 2) Projetos avaliados hoje (evaluations) --------
        // Conta DISTINCT group_id com created_at == hoje
        const from = startOfDay()
        const to = endOfDay()

        let projectsEvaluatedToday = 0

        try {
          const { data: evalsToday } = await supabase
            .from('evaluations')
            .select('group_id, created_at')
            .gte('created_at', from.toISOString())
            .lte('created_at', to.toISOString())

          const distinct = new Set((evalsToday || []).map(e => e.group_id).filter(Boolean))

          projectsEvaluatedToday = distinct.size
        } catch {
          projectsEvaluatedToday = 0
        }

        // -------- 3) Formulários respondidos hoje (form_responses) --------
        // Ajuste a tabela/coluna se usar nomes diferentes
        let formsAnsweredToday = 0

        try {
          const { data: forms } = await supabase
            .from('form_responses')
            .select('id, created_at')
            .gte('created_at', from.toISOString())
            .lte('created_at', to.toISOString())

          formsAnsweredToday = (forms || []).length
        } catch {
          formsAnsweredToday = 0
        }

        setMetrics({
          onlineStudents: onlineCount,
          projectsEvaluatedToday,
          formsAnsweredToday
        })
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const cards = useMemo(
    () => [
      {
        stats: String(metrics.onlineStudents),
        title: 'Alunos online',
        color: 'success',
        icon: 'ri-wifi-line'
      },
      {
        stats: String(metrics.projectsEvaluatedToday),
        title: 'Projetos avaliados (hoje)',
        color: 'primary',
        icon: 'ri-trophy-line'
      },
      {
        stats: String(metrics.formsAnsweredToday),
        title: 'Formulários respondidos (hoje)',
        color: 'info',
        icon: 'ri-survey-line'
      }
    ],
    [metrics]
  )

  return (
    <Card className='bs-full'>
      <CardHeader
        title='Visão Rápida'
        action={<OptionMenu iconClassName='text-textPrimary' options={['Recarregar', 'Compartilhar', 'Atualizar']} />}
        subheader={
          <p className='mbs-3'>
            <span className='font-medium text-textPrimary'>Indicadores do dia</span>{' '}
            <span className='text-textSecondary'>(atualiza ao abrir a página)</span>
          </p>
        }
      />
      <CardContent className='!pbs-5'>
        {loading ? (
          <LinearProgress />
        ) : (
          <Grid container spacing={2}>
            {cards.map((item, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <div className='flex items-center gap-3'>
                  <CustomAvatar variant='rounded' color={item.color} className='shadow-xs'>
                    <i className={item.icon}></i>
                  </CustomAvatar>
                  <div>
                    <Typography>{item.title}</Typography>
                    <Typography variant='h5'>{item.stats}</Typography>
                  </div>
                </div>
              </Grid>
            ))}
          </Grid>
        )}
      </CardContent>
    </Card>
  )
}

export default Transactions
