'use client'

import React, { useEffect, useMemo, useState } from 'react'

import { useRouter } from 'next/navigation'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'

import { supabase, isAdmin, getAdminOrgs } from '@/libs/supabaseAuth'

function KpiCard({ title, value, subtitle }) {
  return (
    <Card>
      <CardHeader title={title} subheader={subtitle} />
      <CardContent>
        <Typography variant='h3' fontWeight={900}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  )
}

export default function AcademicoDashboardPage() {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [orgs, setOrgs] = useState([])

  const [eventsCount, setEventsCount] = useState(0)
  const [regs30d, setRegs30d] = useState(0)
  const [favs30d, setFavs30d] = useState(0)
  const [upcoming, setUpcoming] = useState([])

  useEffect(() => {
    ;(async () => {
      const ok = await isAdmin()

      setAllowed(ok)

      if (!ok) {
        setLoading(false)

        return
      }

      const list = await getAdminOrgs()

      setOrgs(list)

      const nowIso = new Date().toISOString()
      const from30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // Contagem de eventos (RLS já restringe por org onde é admin)
      const ev = await supabase.from('events').select('id', { count: 'exact', head: true })

      setEventsCount(ev?.count || 0)

      // Inscrições 30 dias
      const r = await supabase
        .from('event_registrations')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', from30)

      setRegs30d(r?.count || 0)

      // Favoritos 30 dias
      const f = await supabase
        .from('event_favorites')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', from30)

      setFavs30d(f?.count || 0)

      // Próximos 5 eventos
      const { data: up } = await supabase
        .from('events')
        .select('id, title, starts_at, location, published')
        .gte('starts_at', nowIso)
        .order('starts_at', { ascending: true })
        .limit(5)

      setUpcoming(up || [])

      setLoading(false)
    })()
  }, [])

  if (loading) {
    return (
      <Grid container spacing={3}>
        {[...Array(3)].map((_, i) => (
          <Grid item xs={12} md={4} key={i}>
            <Skeleton variant='rounded' height={140} />
          </Grid>
        ))}
        <Grid item xs={12}>
          <Skeleton variant='rounded' height={300} />
        </Grid>
      </Grid>
    )
  }

  if (!allowed) {
    return (
      <Card>
        <CardHeader title='Acesso restrito' />
        <CardContent>
          <Typography>Esta área é exclusiva para professores/administradores.</Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <KpiCard title='Eventos' value={eventsCount} subtitle='Total visível para sua organização' />
      </Grid>
      <Grid item xs={12} md={4}>
        <KpiCard title='Inscrições (30d)' value={regs30d} subtitle='Novas inscrições nos últimos 30 dias' />
      </Grid>
      <Grid item xs={12} md={4}>
        <KpiCard title='Favoritos (30d)' value={favs30d} subtitle='Eventos marcados como favorito' />
      </Grid>

      <Grid item xs={12}>
        <Card>
          <CardHeader
            title='Próximos eventos'
            subheader='Top 5 por data'
            action={
              <Button onClick={() => router.push('/admin/eventos/new')} variant='contained'>
                Criar evento
              </Button>
            }
          />
          <CardContent>
            {upcoming.length === 0 ? (
              <Typography>Nenhum evento futuro. Que tal criar um agora?</Typography>
            ) : (
              <List>
                {upcoming.map(ev => (
                  <React.Fragment key={ev.id}>
                    <ListItem
                      secondaryAction={
                        <Stack direction='row' spacing={1}>
                          <Chip
                            size='small'
                            label={ev.published ? 'Publicado' : 'Rascunho'}
                            color={ev.published ? 'success' : 'warning'}
                          />
                          <Button
                            size='small'
                            variant='outlined'
                            onClick={() => router.push(`/admin/eventos/${ev.id}`)}
                          >
                            Abrir
                          </Button>
                        </Stack>
                      }
                    >
                      <ListItemText
                        primary={<span style={{ fontWeight: 700 }}>{ev.title}</span>}
                        secondary={`${new Date(ev.starts_at).toLocaleString()} — ${ev.location || 'Sem local'}`}
                      />
                    </ListItem>
                    <Divider component='li' />
                  </React.Fragment>
                ))}
              </List>
            )}
            <Box mt={2}>
              <Stack direction='row' spacing={1} alignItems='center'>
                <Typography variant='body2' color='text.secondary'>
                  Organizações:
                </Typography>
                {orgs?.length ? (
                  orgs.map(o => <Chip key={o.id} label={o.name || o.slug || o.id} size='small' />)
                ) : (
                  <Chip label='default' size='small' />
                )}
              </Stack>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
