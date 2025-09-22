'use client'

import React, { useEffect, useState } from 'react'

import Link from 'next/link'

import {
  Grid,
  Card,
  CardHeader,
  CardContent,
  Typography,
  Stack,
  Button,
  Chip,
  Tooltip,
  Divider,
  IconButton,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem
} from '@mui/material'

import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import LinkIcon from '@mui/icons-material/Link'
import AddLinkIcon from '@mui/icons-material/AddLink'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

// ======= Supabase client (mantive suas envs) =======
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_URL
const supabaseKey = process.env.NEXT_PUBLIC_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// ======= Atalhos fixos (seus links) =======
const RECURSOS_FIXOS = [
  {
    title: 'Visualização de Todos os Cursos (ADS e CCOMP)',
    description: 'Pasta geral no Google Drive com materiais e entregas.',
    url: 'https://drive.google.com/drive/folders/1hLKktS-Zln01qIGjK9T6sI1uaSOVakLN?usp=sharing',
    tag: 'Drive'
  },
  {
    title: 'Organização PI – Entregas CCOMP 2025/2',
    description: 'Planilha com a organização das entregas de CCOMP.',
    url: 'https://docs.google.com/spreadsheets/d/1Heu-AUW--OvS-Y5BrfGotMegwy9ekaOfcmOTsLaMHGk/edit?usp=sharing',
    tag: 'Sheet'
  },
  {
    title: 'Organização PI – Entregas ADS 2025/2',
    description: 'Planilha com a organização das entregas de ADS.',
    url: 'https://docs.google.com/spreadsheets/d/1eRZvv2PrOEa5SVAzbTxiMCFJsNbF6wWJ_dqd4_ab0UY/edit?usp=sharing',
    tag: 'Sheet'
  }
]

export default function DocumentacaoPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [openAdd, setOpenAdd] = useState(false)

  const [form, setForm] = useState({
    course: '',
    term: '',
    class_code: '',
    discipline_name: '',
    group_code: '',
    title: '',
    document_url: ''
  })

  const [saving, setSaving] = useState(false)

  const [toast, setToast] = useState({ open: false, msg: '', sev: 'success' })

  // validação HEAD
  const [checkingId, setCheckingId] = useState(null)
  const [checkResult, setCheckResult] = useState({}) // { [id]: 'ok' | 'fail' }

  // carregar todos os documentos (sem filtros)
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError('')

      const { data, error } = await supabase
        .from('pi_delivery_links')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setError(error.message || 'Erro ao carregar documentos')
        setRows([])
      } else {
        setRows(data || [])
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text)
      setToast({ open: true, msg: 'Link copiado!', sev: 'success' })
    } catch {
      setToast({ open: true, msg: 'Não foi possível copiar.', sev: 'error' })
    }
  }

  async function handleValidateLink(id, url) {
    setCheckingId(id)

    try {
      const res = await fetch(`/api/link-check?url=${encodeURIComponent(url)}`)
      const { ok } = await res.json()

      setCheckResult(prev => ({ ...prev, [id]: ok ? 'ok' : 'fail' }))
    } catch {
      setCheckResult(prev => ({ ...prev, [id]: 'fail' }))
    } finally {
      setCheckingId(null)
    }
  }

  function openDialogAdd() {
    setForm({
      course: '',
      term: '',
      class_code: '',
      discipline_name: '',
      group_code: '',
      title: '',
      document_url: ''
    })
    setOpenAdd(true)
  }

  async function submitAdd() {
    if (
      !form.course ||
      !form.term ||
      !form.class_code ||
      !form.discipline_name ||
      !form.group_code ||
      !form.title ||
      !form.document_url
    ) {
      setToast({ open: true, msg: 'Preencha todos os campos.', sev: 'warning' })

      return
    }

    setSaving(true)

    const { error } = await supabase.from('pi_delivery_links').insert({
      course: form.course,
      term: form.term,
      class_code: form.class_code,
      discipline_name: form.discipline_name,
      group_code: form.group_code,
      title: form.title,
      document_url: form.document_url
    })

    setSaving(false)

    if (error) {
      setToast({ open: true, msg: `Erro ao salvar: ${error.message}`, sev: 'error' })
    } else {
      setOpenAdd(false)
      setToast({ open: true, msg: 'Documento adicionado!', sev: 'success' })

      const { data } = await supabase.from('pi_delivery_links').select('*').order('created_at', { ascending: false })

      setRows(data || [])
    }
  }

  return (
    <Stack spacing={4}>
      <Stack direction='row' justifyContent='space-between' alignItems='center'>
        <Typography variant='h4' fontWeight={700}>
          Documentação • Professores
        </Typography>
        <Button variant='contained' startIcon={<AddLinkIcon />} onClick={openDialogAdd}>
          Adicionar link
        </Button>
      </Stack>

      {/* Recursos Fixos */}
      <Grid container spacing={3}>
        {RECURSOS_FIXOS.map((r, idx) => (
          <Grid item xs={12} md={4} key={idx}>
            <Card variant='outlined' sx={{ height: '100%' }}>
              <CardHeader title={r.title} subheader={r.description} action={<Chip label={r.tag} size='small' />} />
              <CardContent>
                <Stack direction='row' spacing={1}>
                  <Button
                    variant='contained'
                    size='small'
                    endIcon={<OpenInNewIcon />}
                    component={Link}
                    href={r.url}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    Abrir
                  </Button>
                  <Button
                    variant='outlined'
                    size='small'
                    startIcon={<ContentCopyIcon />}
                    onClick={() => copyToClipboard(r.url)}
                  >
                    Copiar
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Divider />

      {/* Documentos do Supabase (grid de cartões, sem filtros) */}
      <Stack spacing={1}>
        <Typography variant='h6' fontWeight={700}>
          Documentos cadastrados ({loading ? 'carregando…' : rows.length})
        </Typography>
        {error && <Alert severity='error'>{error}</Alert>}
      </Stack>

      <Grid container spacing={3}>
        {!loading && rows.length === 0 && (
          <Grid item xs={12}>
            <Typography variant='body2'>Nenhum documento cadastrado ainda.</Typography>
          </Grid>
        )}

        {rows.map(row => (
          <Grid item xs={12} md={6} lg={4} key={row.id}>
            <Card variant='outlined' sx={{ height: '100%' }}>
              <CardHeader
                title={row.title}
                subheader={`${row.course} • ${row.term} • ${row.class_code} • ${row.discipline_name} • ${row.group_code}`}
              />
              <CardContent>
                <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap'>
                  <Button
                    variant='text'
                    size='small'
                    startIcon={<LinkIcon />}
                    component={Link}
                    href={row.document_url}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    Abrir documento
                  </Button>

                  <Tooltip title='Copiar link'>
                    <IconButton size='small' onClick={() => copyToClipboard(row.document_url)}>
                      <ContentCopyIcon fontSize='inherit' />
                    </IconButton>
                  </Tooltip>

                  <Button
                    size='small'
                    variant='outlined'
                    onClick={() => handleValidateLink(row.id, row.document_url)}
                    disabled={checkingId === row.id}
                  >
                    {checkingId === row.id ? 'Validando…' : 'Validar'}
                  </Button>

                  {checkResult[row.id] === 'ok' && <CheckCircleIcon color='success' fontSize='small' />}
                  {checkResult[row.id] === 'fail' && <ErrorOutlineIcon color='error' fontSize='small' />}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Dialogo Adicionar */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} fullWidth maxWidth='sm'>
        <DialogTitle>Adicionar link de documento</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                label='Curso'
                select
                fullWidth
                value={form.course}
                onChange={e => setForm({ ...form, course: e.target.value })}
              >
                <MenuItem value='ADS'>ADS</MenuItem>
                <MenuItem value='CCOMP'>CCOMP</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label='Período'
                placeholder='2025/2'
                fullWidth
                value={form.term}
                onChange={e => setForm({ ...form, term: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label='Turma'
                placeholder='ADS4-MAT'
                fullWidth
                value={form.class_code}
                onChange={e => setForm({ ...form, class_code: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label='Disciplina'
                placeholder='PI'
                fullWidth
                value={form.discipline_name}
                onChange={e => setForm({ ...form, discipline_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label='Grupo'
                placeholder='G01'
                fullWidth
                value={form.group_code}
                onChange={e => setForm({ ...form, group_code: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label='Título'
                placeholder='Entrega 1 - Documentação'
                fullWidth
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label='URL do documento'
                placeholder='https://drive.google.com/...'
                fullWidth
                value={form.document_url}
                onChange={e => setForm({ ...form, document_url: e.target.value })}
              />
            </Grid>
          </Grid>
          <Alert severity='info' sx={{ mt: 2 }}>
            Dica: defina a permissão do Drive como “Qualquer pessoa com o link pode visualizar”.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAdd(false)}>Cancelar</Button>
          <Button onClick={submitAdd} disabled={saving} variant='contained'>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast */}
      <Snackbar open={toast.open} autoHideDuration={3500} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.sev} onClose={() => setToast({ ...toast, open: false })}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Stack>
  )
}
