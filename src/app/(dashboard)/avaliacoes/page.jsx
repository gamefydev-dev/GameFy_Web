'use client'

import React, { useEffect, useRef, useState } from 'react'

import {
  Grid,
  Card,
  CardHeader,
  CardContent,
  Typography,
  Stack,
  Box,
  Button,
  Chip,
  Tooltip,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Slider,
  Alert,
  Snackbar
} from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'

import { supabase } from '@/libs/supabaseAuth'

const clamp10 = n => Math.min(10, Math.max(0, Number(n || 0)))
const normalize = v => (v ?? '').toString().trim()

const ROLE_LABEL = {
  delivery_1: 'Entrega 1',
  delivery_2: 'Entrega 2',
  pitch: 'Apresentação',
  system_final: 'Sistema Final'
}

export default function AvaliacoesPage() {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [excelBusy, setExcelBusy] = useState(false)

  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [classADS4, setClassADS4] = useState(false)

  const [groups, setGroups] = useState([])
  const [myScores, setMyScores] = useState(new Map()) // `${group_id}:${role}` -> {id, score, comment}

  const [dlgOpen, setDlgOpen] = useState(false)
  const [target, setTarget] = useState(null) // {group, role}
  const [score, setScore] = useState(0)
  const [comment, setComment] = useState('')

  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' })
  const fileRef = useRef(null)
  const pickExcel = () => fileRef.current?.click()

  // -------- auth + admin
  useEffect(() => {
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()

      setUser(u?.user || null)

      const { data: isAdm } = await supabase.rpc('is_admin')

      setIsAdmin(!!isAdm)

      const { data: cls } = await supabase
        .from('classes')
        .select('id, name, semester, is_ads4')
        .order('name', { ascending: true })

      setClasses(cls || [])

      if ((cls || []).length) {
        setClassId(String(cls[0].id))
        setClassADS4(!!cls[0].is_ads4)
      }

      setLoading(false)
    })()
  }, [])

  // -------- ao trocar turma
  useEffect(() => {
    ;(async () => {
      if (!classId || !user) return
      setLoading(true)

      const meta = classes.find(c => String(c.id) === String(classId))

      setClassADS4(!!meta?.is_ads4)

      const { data: gs } = await supabase
        .from('pi_groups')
        .select('id, name, code')
        .eq('class_id', classId)
        .order('name', { ascending: true })

      setGroups(gs || [])

      const ids = (gs || []).map(g => g.id)
      let map = new Map()

      if (ids.length) {
        // busca notas lançadas por ESTE avaliador (professor logado)
        const { data: evs } = await supabase
          .from('evaluations')
          .select('id, group_id, evaluator_id, evaluator_role, score, comment')
          .eq('evaluator_id', user.id)
          .in('group_id', ids)

        ;(evs || []).forEach(r => {
          map.set(`${r.group_id}:${r.evaluator_role}`, { id: r.id, score: r.score, comment: r.comment })
        })
      }

      setMyScores(map)

      setLoading(false)
    })()
  }, [classId, user, classes])

  // -------- importar excel (admin) p/ criar grupos faltantes
  const handleExcel = async ev => {
    const file = ev.target.files?.[0]

    if (!file) return
    if (!classId) return setSnack({ open: true, msg: 'Selecione uma turma.', sev: 'warning' })
    if (!isAdmin) return setSnack({ open: true, msg: 'Apenas administradores.', sev: 'warning' })

    try {
      setExcelBusy(true)
      const data = await file.arrayBuffer()
      const XLSX = await import('xlsx')
      const wb = XLSX.read(data, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })

      const COL_GROUP_NAME = 'Nome do Grupo'

      if (!rows.length || !Object.keys(rows[0]).includes(COL_GROUP_NAME)) {
        setSnack({ open: true, msg: 'Planilha precisa da coluna "Nome do Grupo".', sev: 'error' })

        return
      }

      const names = Array.from(new Set(rows.map(r => normalize(r[COL_GROUP_NAME])).filter(Boolean)))

      const { data: existing } = await supabase.from('pi_groups').select('name').eq('class_id', classId)

      const have = new Set((existing || []).map(g => normalize(g.name)))
      const toInsert = names.filter(n => !have.has(normalize(n))).map(n => ({ class_id: classId, name: n }))

      if (toInsert.length) {
        const { error } = await supabase.from('pi_groups').insert(toInsert)

        if (error) throw error
        setSnack({ open: true, msg: `Criados ${toInsert.length} grupo(s).`, sev: 'success' })
      } else {
        setSnack({ open: true, msg: 'Todos os grupos já existem nesta turma.', sev: 'info' })
      }

      // reload
      const { data: gs } = await supabase
        .from('pi_groups')
        .select('id, name, code')
        .eq('class_id', classId)
        .order('name', { ascending: true })

      setGroups(gs || [])
    } catch (e) {
      console.error(e)
      setSnack({ open: true, msg: 'Falha ao importar Excel.', sev: 'error' })
    } finally {
      setExcelBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // -------- abrir dialog
  const openDialog = (group, role) => {
    const prev = myScores.get(`${group.id}:${role}`)

    setTarget({ group, role })
    setScore(prev?.score ?? 0)
    setComment(prev?.comment ?? '')
    setDlgOpen(true)
  }

  // -------- salvar avaliação (upsert manual)
  const saveEvaluation = async () => {
    if (!user || !target?.group) return

    if (!isAdmin) {
      setSnack({ open: true, msg: 'Apenas professores podem lançar notas.', sev: 'warning' })

      return
    }

    const key = `${target.group.id}:${target.role}`

    const { data: existing } = await supabase
      .from('evaluations')
      .select('id')
      .eq('group_id', target.group.id)
      .eq('evaluator_id', user.id)
      .eq('evaluator_role', target.role)
      .maybeSingle()

    if (existing?.id) {
      const { error } = await supabase
        .from('evaluations')
        .update({ score: clamp10(score), comment: comment || null })
        .eq('id', existing.id)

      if (error) return setSnack({ open: true, msg: 'Erro ao atualizar.', sev: 'error' })

      const next = new Map(myScores)

      next.set(key, { id: existing.id, score: clamp10(score), comment: comment || null })
      setMyScores(next)
    } else {
      const payload = {
        group_id: target.group.id,
        evaluator_id: user.id,
        evaluator_role: target.role,
        score: clamp10(score),
        comment: comment || null
      }

      const { data, error } = await supabase.from('evaluations').insert(payload).select('id').single()

      if (error) return setSnack({ open: true, msg: 'Erro ao inserir.', sev: 'error' })

      const next = new Map(myScores)

      next.set(key, { id: data.id, score: payload.score, comment: payload.comment })
      setMyScores(next)
    }

    setDlgOpen(false)
    setSnack({ open: true, msg: 'Avaliação salva!', sev: 'success' })
  }

  // -------- UI de cada bloco
  const renderBlock = (g, role, hint = '') => {
    const k = `${g.id}:${role}`
    const row = myScores.get(k)

    return (
      <Stack spacing={1}>
        <Typography variant='subtitle1' fontWeight={700}>
          {ROLE_LABEL[role]}
        </Typography>
        {hint ? (
          <Typography variant='caption' color='text.secondary'>
            {hint}
          </Typography>
        ) : null}
        <Stack direction='row' spacing={1} alignItems='center'>
          <Chip
            size='small'
            label={row?.score != null ? `Sua nota: ${row.score}` : 'Sem nota'}
            color={row?.score != null ? 'primary' : 'default'}
          />
          <Button variant='contained' onClick={() => openDialog(g, role)}>
            {row?.score != null ? 'Editar' : 'Avaliar'}
          </Button>
        </Stack>
      </Stack>
    )
  }

  // -------- Gate: somente admin/prof
  if (!isAdmin) {
    return (
      <Card>
        <CardHeader title='Acesso restrito' />
        <CardContent>
          <Alert severity='warning'>
            Esta área é exclusiva de professores/administradores. A Avaliação 360 é feita pelos alunos no aplicativo.
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const body = loading ? (
    <Grid container spacing={3}>
      {[...Array(3)].map((_, i) => (
        <Grid key={i} item xs={12}>
          <Skeleton variant='rounded' height={120} />
        </Grid>
      ))}
    </Grid>
  ) : groups.length === 0 ? (
    <Alert severity='info'>Nenhum grupo nesta turma.</Alert>
  ) : (
    <Grid container spacing={3}>
      {groups.map(g => (
        <Grid key={g.id} item xs={12}>
          <Card>
            <CardHeader
              title={
                <Stack direction='row' spacing={1} alignItems='center'>
                  <Typography variant='h6' fontWeight={800}>
                    {g.name}
                  </Typography>
                  {g.code ? <Chip size='small' label={`Código: ${g.code}`} /> : null}
                </Stack>
              }
              subheader={
                classADS4
                  ? 'ADS4: Entregas (3+4), Sistema Final (1) e Apresentação (2).'
                  : 'Padrão: Entregas (3+4) e Apresentação (3).'
              }
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  {renderBlock(g, 'delivery_1', 'Até 3 pontos (0-10 escalado).')}
                </Grid>
                <Grid item xs={12} md={3}>
                  {renderBlock(g, 'delivery_2', 'Até 4 pontos (0-10 escalado).')}
                </Grid>
                <Grid item xs={12} md={3}>
                  {renderBlock(g, 'pitch', classADS4 ? 'Até 2 pontos (ADS4)' : 'Até 3 pontos (padrão)')}
                </Grid>
                {classADS4 && (
                  <Grid item xs={12} md={3}>
                    {renderBlock(g, 'system_final', 'Até 1 ponto (ADS4).')}
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )

  return (
    <Box>
      {/* Toolbar */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ mb: 3 }}
      >
        <Typography variant='h4' fontWeight={900}>
          Avaliações de PI
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <TextField
          select
          size='small'
          label='Turma'
          value={classId}
          onChange={e => setClassId(e.target.value)}
          sx={{ minWidth: 280 }}
        >
          {classes.map(c => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
              {c.semester ? ` — ${c.semester}º` : ''}
              {c.is_ads4 ? ' • ADS4' : ''}
            </MenuItem>
          ))}
        </TextField>

        {/* Importar Excel (admin) */}
        <>
          <input
            type='file'
            accept='.xlsx,.xls,.csv'
            ref={fileRef}
            style={{ display: 'none' }}
            onChange={handleExcel}
          />
          <Tooltip title='Importar planilha (coluna "Nome do Grupo") e criar grupos faltantes'>
            <span>
              <Button
                size='small'
                startIcon={<CloudUploadIcon />}
                variant='outlined'
                disabled={!classId || excelBusy}
                onClick={pickExcel}
              >
                {excelBusy ? 'Importando...' : 'Importar Excel (criar grupos)'}
              </Button>
            </span>
          </Tooltip>
        </>
      </Stack>

      {body}

      {/* Dialog de avaliação */}
      <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>
          {ROLE_LABEL[target?.role || 'delivery_1']} — {target?.group?.name}
        </DialogTitle>
        <DialogContent dividers>
          <Box py={1}>
            <Typography gutterBottom>Nota (0 a 10)</Typography>
            <Slider min={0} max={10} step={0.5} value={score} onChange={(e, v) => setScore(v)} valueLabelDisplay='on' />
          </Box>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label='Comentários (opcional)'
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
          <Alert severity='info' sx={{ mt: 2 }}>
            As notas serão convertidas para os pesos da turma (regras no cabeçalho).
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgOpen(false)}>Cancelar</Button>
          <Button variant='contained' onClick={saveEvaluation}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert onClose={() => setSnack(s => ({ ...s, open: false }))} severity={snack.sev} sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}
