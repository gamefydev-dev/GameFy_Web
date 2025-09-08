'use client'
import React, { useEffect, useMemo, useState } from 'react'

import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Grid,
  TextField,
  Button,
  MenuItem,
  Switch,
  FormControlLabel,
  Stack,
  Typography,
  Alert
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import QrCode2Icon from '@mui/icons-material/QrCode2'

import { supabase, getAdminOrgs } from '../../libs/supabaseAuth'
import QRPreview from './QRPreview'

const CATEGORIES = [
  { id: 'workshop', label: 'Workshop' },
  { id: 'competition', label: 'Competição' },
  { id: 'lecture', label: 'Palestra' },
  { id: 'festival', label: 'Festival' },
  { id: 'concert', label: 'Show' },
  { id: 'sports', label: 'Esportes' }
]

function slugify(str = '') {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
}

export default function EventForm({ initial = null, onSaved }) {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [organizationId, setOrganizationId] = useState(initial?.organization_id || '')
  const [title, setTitle] = useState(initial?.title || '')
  const [theme, setTheme] = useState(initial?.theme || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [location, setLocation] = useState(initial?.location || '')
  const [date, setDate] = useState(initial?.starts_at ? new Date(initial.starts_at).toISOString().slice(0, 10) : '')

  const [timeStart, setTimeStart] = useState(
    initial?.starts_at ? new Date(initial.starts_at).toISOString().slice(11, 16) : ''
  )

  const [timeEnd, setTimeEnd] = useState(initial?.ends_at ? new Date(initial.ends_at).toISOString().slice(11, 16) : '')
  const [limit, setLimit] = useState(initial?.participants_limit ?? 0)
  const [price, setPrice] = useState(initial?.price ?? 0)
  const [category, setCategory] = useState(initial?.category || 'lecture')
  const [organizer, setOrganizer] = useState(initial?.organizer || '')
  const [website, setWebsite] = useState(initial?.website || '')
  const [published, setPublished] = useState(initial?.published ?? false)

  const [qrNonce, setQrNonce] = useState(initial?.qr_nonce || '')

  const qrPayload = useMemo(() => {
    if (!qrNonce) return ''

    return JSON.stringify({ t: 'evt', v: 1, slug: slugify(title || 'evento'), nonce: qrNonce })
  }, [qrNonce, title])

  useEffect(() => {
    ;(async () => {
      const list = await getAdminOrgs()

      setOrgs(list)
      if (!organizationId && list[0]) setOrganizationId(list[0].id)
    })()
  }, [])

  const handleGenerateQR = () => {
    setQrNonce(crypto.randomUUID())
  }

  const toDateTime = (d, t) => {
    if (!d || !t) return null

    // monta ISO local (assume fuso do navegador)
    const [hh, mm] = t.split(':')
    const dt = new Date(d)

    dt.setHours(Number(hh || 0), Number(mm || 0), 0, 0)

    return dt.toISOString()
  }

  const handleSubmit = async e => {
    e?.preventDefault?.()
    setErrorMsg('')

    if (!organizationId) return setErrorMsg('Selecione a organização.')
    if (!title.trim()) return setErrorMsg('Informe um título.')
    if (!location.trim()) return setErrorMsg('Informe o local.')
    const starts_at = toDateTime(date, timeStart)
    const ends_at = timeEnd ? toDateTime(date, timeEnd) : null

    if (!starts_at) return setErrorMsg('Informe data e horário de início.')
    if (!qrNonce) return setErrorMsg('Gere o QR do evento antes de salvar.')

    const payload = {
      organization_id: organizationId,
      title,
      theme,
      description,
      location,
      starts_at,
      ends_at,
      participants_limit: Number(limit || 0),
      price: Number(price || 0),
      category,
      organizer,
      website,
      published,
      qr_nonce: qrNonce,
      qr_payload: qrPayload
    }

    try {
      setLoading(true)

      if (initial?.id) {
        const { data, error } = await supabase.from('events').update(payload).eq('id', initial.id).select().single()

        if (error) throw error
        onSaved?.(data)
      } else {
        const { data, error } = await supabase.from('events').insert([payload]).select().single()

        if (error) throw error
        onSaved?.(data)
      }
    } catch (err) {
      const msg = err?.message || String(err)

      if (/row-level security/i.test(msg)) {
        setErrorMsg('Permissão negada: apenas administradores podem salvar eventos nesta organização.')
      } else {
        setErrorMsg(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box component='form' onSubmit={handleSubmit}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader
              title={initial?.id ? 'Editar evento' : 'Novo evento'}
              subheader='Preencha as informações principais'
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    select
                    label='Organização'
                    value={organizationId}
                    onChange={e => setOrganizationId(e.target.value)}
                    fullWidth
                  >
                    {orgs.map(o => (
                      <MenuItem key={o.id} value={o.id}>
                        {o.name || o.slug || o.id}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label='Título' value={title} onChange={e => setTitle(e.target.value)} fullWidth />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label='Tema' value={theme} onChange={e => setTheme(e.target.value)} fullWidth />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label='Local' value={location} onChange={e => setLocation(e.target.value)} fullWidth />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label='Descrição'
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    fullWidth
                    multiline
                    minRows={4}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Box height={12} />

          <Card>
            <CardHeader title='Data e capacidade' subheader='Defina data/horários e limite de participantes' />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    type='date'
                    label='Data'
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    type='time'
                    label='Início'
                    value={timeStart}
                    onChange={e => setTimeStart(e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    type='time'
                    label='Fim (opcional)'
                    value={timeEnd}
                    onChange={e => setTimeEnd(e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    type='number'
                    label='Capacidade (participantes)'
                    value={limit}
                    onChange={e => setLimit(e.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    type='number'
                    label='Preço (R$)'
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    select
                    label='Categoria'
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    fullWidth
                  >
                    {CATEGORIES.map(c => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label='Website (opcional)'
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label='Organizador (ex.: Prof. João, Coordenação, Faculdade)'
                    value={organizer}
                    onChange={e => setOrganizer(e.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Switch checked={published} onChange={e => setPublished(e.target.checked)} />}
                    label='Publicado (visível aos alunos)'
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Box height={12} />

          {errorMsg && (
            <Alert severity='error' sx={{ mb: 2 }}>
              {errorMsg}
            </Alert>
          )}

          <Stack direction='row' spacing={2}>
            <Button type='submit' variant='contained' startIcon={<SaveIcon />} disabled={loading}>
              {initial?.id ? 'Salvar alterações' : 'Salvar evento'}
            </Button>
            <Button variant='outlined' color='secondary' startIcon={<QrCode2Icon />} onClick={handleGenerateQR}>
              {qrNonce ? 'Regenerar QR' : 'Gerar QR'}
            </Button>
          </Stack>

          {initial?.id && (
            <Typography variant='body2' sx={{ mt: 1, color: 'text.secondary' }}>
              ID: {initial.id}
            </Typography>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title='QR do evento' subheader='Use para inscrição dos alunos' />
            <CardContent>
              <QRPreview value={qrPayload} />
              <Typography variant='caption' sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                O QR incorpora o tipo/versão e um nonce único. O app mobile valida esse payload.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
