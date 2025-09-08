'use client'
import React, { useEffect, useState, useMemo } from 'react'

import { useRouter } from 'next/navigation'

import {
  Box,
  Stack,
  Typography,
  Button,
  TextField,
  Chip,
  Card,
  CardContent,
  CardHeader,
  IconButton
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import VisibilityIcon from '@mui/icons-material/Visibility'
import PublishIcon from '@mui/icons-material/Publish'
import UnpublishedIcon from '@mui/icons-material/Unpublished'

import { supabase, isAdmin } from '../../../libs/supabaseAuth'

export default function EventosAdminPage() {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [q, setQ] = useState('')

  useEffect(() => {
    ;(async () => {
      const ok = await isAdmin()

      setAllowed(ok)
      setLoading(false)
      if (ok) loadEvents()
    })()
  }, [])

  async function loadEvents() {
    const { data, error } = await supabase.from('events').select('*').order('starts_at', { ascending: false })

    if (!error) setEvents(data || [])
  }

  async function togglePublish(ev) {
    const { data, error } = await supabase
      .from('events')
      .update({ published: !ev.published })
      .eq('id', ev.id)
      .select()
      .single()

    if (!error) setEvents(prev => prev.map(x => (x.id === ev.id ? data : x)))
  }

  const filtered = useMemo(() => {
    const n = s =>
      (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')

    const term = n(q)

    return events.filter(e => [e.title, e.description, e.location, e.category].some(v => n(v).includes(term)))
  }, [events, q])

  if (loading) return <Typography>Carregando…</Typography>
  if (!allowed)
    return (
      <Box>
        <Typography variant='h5' fontWeight={900}>
          Acesso restrito
        </Typography>
        <Typography>Esta área é exclusiva para professores/administradores.</Typography>
      </Box>
    )

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent='space-between'
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Typography variant='h4' fontWeight={900}>
          Eventos
        </Typography>
        <Stack direction='row' spacing={1}>
          <TextField size='small' placeholder='Buscar…' value={q} onChange={e => setQ(e.target.value)} />
          <Button variant='contained' startIcon={<AddIcon />} onClick={() => router.push('/admin/eventos/new')}>
            Novo evento
          </Button>
        </Stack>
      </Stack>

      {filtered.length === 0 ? (
        <Card>
          <CardContent>
            <Typography>Nenhum evento encontrado.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {filtered.map(ev => (
            <Card key={ev.id}>
              <CardHeader
                title={
                  <Stack direction='row' alignItems='center' spacing={1}>
                    <Typography fontWeight={900}>{ev.title}</Typography>
                    {ev.published ? (
                      <Chip color='success' size='small' label='Publicado' />
                    ) : (
                      <Chip color='warning' size='small' label='Rascunho' />
                    )}
                  </Stack>
                }
                subheader={`${new Date(ev.starts_at).toLocaleString()} — ${ev.location || 'Sem local'}`}
                action={
                  <Stack direction='row' spacing={1} alignItems='center'>
                    <IconButton title='Ver' onClick={() => router.push(`/admin/eventos/${ev.id}`)}>
                      <VisibilityIcon />
                    </IconButton>
                    <IconButton title='Editar' onClick={() => router.push(`/admin/eventos/${ev.id}`)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton title={ev.published ? 'Despublicar' : 'Publicar'} onClick={() => togglePublish(ev)}>
                      {ev.published ? <UnpublishedIcon /> : <PublishIcon />}
                    </IconButton>
                  </Stack>
                }
              />
              <CardContent>
                <Typography variant='body2' color='text.secondary'>
                  {ev.description || 'Sem descrição'}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  )
}
