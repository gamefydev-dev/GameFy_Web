'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'

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
  Alert,
  Snackbar,
  IconButton,
  InputAdornment,
  CircularProgress,
  Slider
} from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import SearchIcon from '@mui/icons-material/Search'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'

import { supabase } from '@/libs/supabaseAuth'

// -------------------- helpers --------------------
const clamp10 = n => Math.min(10, Math.max(0, Number.isFinite(n) ? n : 0))
const round2 = n => Number((Math.round(n * 100) / 100).toFixed(2))
const normalize = v => (v ?? '').toString().trim()

const formatBR = n => {
  if (n == null || Number.isNaN(n)) return ''

  return n.toLocaleString('pt-BR', { minimumFractionDigits: n % 1 ? 1 : 0, maximumFractionDigits: 2 })
}

const ROLE_LABEL = {
  delivery_1: 'Entrega 1',
  delivery_2: 'Entrega 2',
  pitch: 'Apresentação',
  system_final: 'Sistema Final'
}

// Pesos solicitados: E1: 0,06 | E2: 0,08
const W_E1 = 0.06
const W_E2 = 0.08
const MAX_E1 = round2(10 * W_E1) // 0.60
const MAX_E2 = round2(10 * W_E2) // 0.80
const MAX_TOTAL = round2(MAX_E1 + MAX_E2) // 1.40

const scoreColor = n => {
  if (n == null) return 'default'
  if (n < 6) return 'error'
  if (n < 8) return 'warning'

  return 'success'
}

const marks = Array.from({ length: 11 }, (_, i) => ({ value: i, label: i }))

const groupNumberFromName = name => {
  const m = (name || '').match(/\d+/)

  return m ? Number(m[0]) : null
}

// -------------------- componente --------------------
export default function AvaliacoesPage() {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [excelBusy, setExcelBusy] = useState(false)

  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')

  const [groups, setGroups] = useState([])
  const [myScores, setMyScores] = useState(new Map()) // `${group_id}:${role}` -> {id, score, comment}

  const [dlgOpen, setDlgOpen] = useState(false)
  const [target, setTarget] = useState(null) // { group, role }
  const [score, setScore] = useState(0)
  const [comment, setComment] = useState('')
  const [commentTouched, setCommentTouched] = useState(false)

  const [search, setSearch] = useState('')

  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' })
  const fileRef = useRef(null)
  const pickExcel = () => fileRef.current?.click()

  const commentIsValid = normalize(comment).length > 0
  const scoreIsValid = Number.isFinite(score) && score >= 0 && score <= 10

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
      }

      setLoading(false)
    })()
  }, [])

  // -------- ao trocar turma
  useEffect(() => {
    ;(async () => {
      if (!classId || !user) return
      setLoading(true)

      const { data: gs } = await supabase
        .from('pi_groups')
        .select('id, name, code, class_id, class:classes(name, semester, is_ads4)')
        .eq('class_id', classId)
        .order('name', { ascending: true })

      setGroups(gs || [])

      const ids = (gs || []).map(g => g.id)
      const map = new Map()

      if (ids.length) {
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
        .select('id, name, code, class_id, class:classes(name, semester, is_ads4)')
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
    setCommentTouched(false)
    setDlgOpen(true)
  }

  // -------- salvar avaliação (upsert) — com validação
  const saveEvaluation = async () => {
    if (!user || !target?.group) return

    if (!isAdmin) {
      setSnack({ open: true, msg: 'Apenas professores podem lançar notas.', sev: 'warning' })

      return
    }

    const cmtOk = normalize(comment).length > 0
    const scOk = Number.isFinite(score) && score >= 0 && score <= 10

    if (!cmtOk || !scOk) {
      setCommentTouched(true)
      setSnack({
        open: true,
        msg: !cmtOk ? 'Comentários são obrigatórios.' : 'Informe uma nota de 0 a 10.',
        sev: 'warning'
      })

      return
    }

    const safeScore = round2(clamp10(score))
    const safeComment = normalize(comment)
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
        .update({ score: safeScore, comment: safeComment })
        .eq('id', existing.id)

      if (error) return setSnack({ open: true, msg: 'Erro ao atualizar.', sev: 'error' })

      const next = new Map(myScores)

      next.set(key, { id: existing.id, score: safeScore, comment: safeComment })
      setMyScores(next)
    } else {
      const payload = {
        group_id: target.group.id,
        evaluator_id: user.id,
        evaluator_role: target.role,
        score: safeScore,
        comment: safeComment
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

  // -------------------- UI helpers --------------------
  const ScoreBadge = ({ value }) => {
    if (value == null) {
      return <Chip size='small' variant='outlined' icon={<DoNotDisturbIcon fontSize='small' />} label='Sem nota' />
    }

    const col = scoreColor(value)
    const icon = col === 'success' ? <StarRoundedIcon fontSize='small' /> : <FiberManualRecordIcon fontSize='small' />

    return (
      <Chip
        size='small'
        color={col === 'default' ? 'default' : col}
        variant={col === 'success' ? 'filled' : 'outlined'}
        icon={icon}
        label={`Sua nota: ${formatBR(value)}`}
      />
    )
  }

  const Circle10 = ({ value }) => {
    const v = Math.max(0, Math.min(10, Number(value ?? 0)))

    return (
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress variant='determinate' value={(v / 10) * 100} thickness={6} size={72} />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800
          }}
        >
          {formatBR(v)}
        </Box>
      </Box>
    )
  }

  // ponderação por entrega
  const weightedFor = (g, role) => {
    const s = myScores.get(`${g.id}:${role}`)?.score ?? 0
    const w = role === 'delivery_1' ? W_E1 : role === 'delivery_2' ? W_E2 : 0

    return { value: round2(s * w), max: round2(10 * w) }
  }

  // componente de entrada numérica (0–10, decimais, vírgula aceita)
  const NumberInput = ({ value, onChange, step = 0.1 }) => {
    const inc = () => onChange(clamp10(round2(value + step)))
    const dec = () => onChange(clamp10(round2(value - step)))

    const onType = e => {
      const raw = (e.target.value ?? '').toString().replace(',', '.')
      const parsed = Number(raw)

      if (Number.isNaN(parsed)) onChange(0)
      else onChange(parsed)
    }

    return (
      <TextField
        fullWidth
        size='small'
        type='number'
        inputMode='decimal'
        inputProps={{ min: 0, max: 10, step }}
        value={value}
        onChange={onType}
        onBlur={() => onChange(clamp10(round2(value)))}
        onKeyDown={e => {
          const delta = e.shiftKey ? 0.1 : 0.5

          if (e.key === 'ArrowUp' || e.key === '+') {
            e.preventDefault()
            onChange(s => clamp10(round2(Number(s) + delta)))
          }
          if (e.key === 'ArrowDown' || e.key === '-') {
            e.preventDefault()
            onChange(s => clamp10(round2(Number(s) - delta)))
          }
          if (e.key === 'Enter') {
            e.preventDefault()
            saveEvaluation()
          }
        }}
        label='Nota (0 a 10)'
        helperText='Aceita decimais, ex.: 9,5 ou 9.5'
        sx={{ maxWidth: 260 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position='start'>
              <IconButton size='small' onClick={dec} aria-label='Diminuir nota'>
                <RemoveIcon fontSize='small' />
              </IconButton>
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position='end'>
              <Typography variant='caption' sx={{ mr: 1 }}>
                /10
              </Typography>
              <IconButton size='small' onClick={inc} aria-label='Aumentar nota'>
                <AddIcon fontSize='small' />
              </IconButton>
            </InputAdornment>
          )
        }}
      />
    )
  }

  // -------------------- cálculo da nota final (somente entregas) --------------------
  const computeFinalDeliveries = g => {
    const e1 = myScores.get(`${g.id}:delivery_1`)?.score ?? 0
    const e2 = myScores.get(`${g.id}:delivery_2`)?.score ?? 0
    const total = round2(W_E1 * e1 + W_E2 * e2) // máx 1.40

    return total
  }

  // -------------------- blocos --------------------
  const renderBlock = (g, role, hint = '') => {
    const k = `${g.id}:${role}`
    const row = myScores.get(k)
    const value = row?.score
    const w = weightedFor(g, role)
    const showWeighted = role === 'delivery_1' || role === 'delivery_2'

    return (
      <Stack
        spacing={1}
        sx={{
          p: 1.5,
          borderRadius: 2,
          border: theme => `1px solid ${theme.palette.divider}`,
          transition: 'background-color .15s ease',
          '&:hover': { backgroundColor: 'action.hover' }
        }}
      >
        <Stack direction='row' alignItems='center' spacing={1} flexWrap='wrap' useFlexGap>
          <Typography variant='subtitle1' fontWeight={800}>
            {ROLE_LABEL[role]}
          </Typography>
        </Stack>

        {hint ? (
          <Typography variant='caption' color='text.secondary'>
            {hint}
          </Typography>
        ) : null}

        <Stack direction='row' spacing={2} alignItems='center' flexWrap='wrap' useFlexGap>
          <Circle10 value={value ?? 0} />
          <ScoreBadge value={value} />
          <Button variant='contained' onClick={() => openDialog(g, role)}>
            {value != null ? 'Editar' : 'Avaliar'}
          </Button>
        </Stack>

        {showWeighted && (
          <Typography variant='caption' color='text.secondary'>
            Nota ponderada: <b>{formatBR(w.value)}</b> / {formatBR(w.max)}
          </Typography>
        )}
      </Stack>
    )
  }

  const renderFinalDeliveriesBlock = g => {
    const total = computeFinalDeliveries(g)

    return (
      <Stack
        spacing={1}
        sx={{
          p: 1.5,
          borderRadius: 2,
          border: theme => `1px solid ${theme.palette.divider}`,
          transition: 'background-color .15s ease',
          '&:hover': { backgroundColor: 'action.hover' }
        }}
      >
        <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap' useFlexGap>
          <Typography variant='subtitle1' fontWeight={800}>
            Nota Final das Entregas
          </Typography>
          <Chip size='small' variant='outlined' label={`Máximo: ${formatBR(MAX_TOTAL)}`} />
        </Stack>
        <Stack direction='row' spacing={2} alignItems='center' flexWrap='wrap' useFlexGap>
          <Chip size='small' color='primary' variant='filled' label={`${formatBR(total)} / ${formatBR(MAX_TOTAL)}`} />
        </Stack>
      </Stack>
    )
  }

  // -------------------- filtro de grupos (inclui turma) --------------------
  const filteredGroups = useMemo(() => {
    const q = normalize(search).toLowerCase()

    if (!q) return groups

    return groups.filter(g => {
      const name = (g.name || '').toLowerCase()
      const code = (g.code || '').toLowerCase()
      const turma = (g.class?.name || '').toLowerCase()

      return name.includes(q) || code.includes(q) || turma.includes(q)
    })
  }, [groups, search])

  // -------------------- gate --------------------
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

  // -------------------- corpo --------------------
  const body = loading ? (
    <Grid container spacing={3}>
      {[...Array(3)].map((_, i) => (
        <Grid key={i} item xs={12}>
          <Skeleton variant='rounded' height={120} />
        </Grid>
      ))}
    </Grid>
  ) : filteredGroups.length === 0 ? (
    <Alert severity='info'>Nenhum grupo encontrado com esse filtro.</Alert>
  ) : (
    <Grid container spacing={3}>
      {filteredGroups.map((g, idx) => {
        const groupNum = groupNumberFromName(g.name) ?? idx + 1
        const periodo = g.class?.semester ? `${g.class.semester}º` : '—'

        return (
          <Grid key={g.id} item xs={12}>
            <Card>
              <CardHeader
                title={
                  <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap' useFlexGap>
                    <Typography variant='h6' fontWeight={800}>
                      {g.name}
                    </Typography>
                    {g.code ? <Chip size='small' label={`Código: ${g.code}`} /> : null}

                    {/* Turma / Período / Nº do Grupo */}
                    {g.class?.name ? <Chip size='small' variant='outlined' label={`Turma: ${g.class.name}`} /> : null}
                    <Chip size='small' variant='outlined' label={`Período: ${periodo}`} />
                    <Chip size='small' variant='outlined' label={`Grupo nº: ${groupNum}`} />
                  </Stack>
                }
                subheader='Regras: E1 (peso 0,06, máx 0,6) • E2 (peso 0,08, máx 0,8) • Final = E1 + E2 (máx 1,4)'
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    {renderBlock(g, 'delivery_1', 'Nota 0–10, pondera ×0,06')}
                  </Grid>
                  <Grid item xs={12} md={4}>
                    {renderBlock(g, 'delivery_2', 'Nota 0–10, pondera ×0,08')}
                  </Grid>

                  {/* Resumo das entregas (somatório) */}
                  <Grid item xs={12} md={4}>
                    {renderFinalDeliveriesBlock(g)}
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )
      })}
    </Grid>
  )

  // -------------------- render --------------------
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

        {/* Busca de grupos (inclui nome da turma) */}
        <TextField
          size='small'
          placeholder='Buscar por grupo, código ou turma...'
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ minWidth: { xs: '100%', md: 360 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position='start'>
                <SearchIcon fontSize='small' />
              </InputAdornment>
            ),
            'aria-label': 'Buscar grupos'
          }}
        />

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
        </>
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
      </Stack>

      {body}

      {/* Dialog de avaliação — UI de pontuação */}
      <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>
          {ROLE_LABEL[target?.role || 'delivery_1']} — {target?.group?.name}
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2}>
            {/* Anel + slider */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems='center'>
              <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                <CircularProgress variant='determinate' value={(clamp10(score) / 10) * 100} thickness={6} size={88} />
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: 24
                  }}
                >
                  {score.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                </Box>
              </Box>
              <Box sx={{ flex: 1, minWidth: 220 }}>
                <Typography variant='caption' color='text.secondary'>
                  Arraste para ajustar
                </Typography>
                <Box sx={{ px: 0.5 }}>
                  <Slider
                    value={Number(score)}
                    onChange={(_, v) => setScore(round2(clamp10(Number(v))))}
                    step={0.1}
                    min={0}
                    max={10}
                    valueLabelDisplay='on'
                    marks={marks}
                  />
                </Box>
              </Box>
            </Stack>

            {/* Comentário obrigatório */}
            <TextField
              fullWidth
              required
              error={commentTouched && !commentIsValid}
              helperText={
                commentTouched && !commentIsValid ? 'Comentários são obrigatórios.' : 'Justifique a nota em 1–2 frases.'
              }
              multiline
              minRows={3}
              label='Comentários'
              value={comment}
              onChange={e => setComment(e.target.value)}
              onBlur={() => setCommentTouched(true)}
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDlgOpen(false)}>Cancelar</Button>
          <Button
            variant='contained'
            onClick={saveEvaluation}
            disabled={!commentIsValid || !scoreIsValid}
            sx={{ px: 3, fontWeight: 800 }}
          >
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
