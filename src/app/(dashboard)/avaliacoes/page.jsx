// =============================================
// src/app/(dashboard)/dashboard/avaliacoes/page.jsx
// =============================================
'use client'

import React, { useEffect, useMemo, useState } from 'react'

import { useRouter } from 'next/navigation'

// MUI
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Skeleton from '@mui/material/Skeleton'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Slider from '@mui/material/Slider'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'

import { supabase, getUser, isAdmin } from '@/libs/supabaseAuth'

const clamp01 = n => Math.min(10, Math.max(0, Number(n || 0)))
const fmtDateTime = d => new Date(d).toLocaleString()

export default function AvaliacoesPage() {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)

  const [user, setUser] = useState(null)

  // assignments (disciplinas x turmas do professor)
  const [assigns, setAssigns] = useState([]) // {id, subject_id, subject_name, class_id, class_name, course_id, course_name, pitch_date}
  const [assignId, setAssignId] = useState('')

  // dados carregados da turma selecionada
  const [groups, setGroups] = useState([]) // [{id, name, theme, company}]
  const [deliveries, setDeliveries] = useState([]) // [{id, group_id, number, due_date, submitted_at, artifact_url}]
  const [pitchDate, setPitchDate] = useState(null)

  // avaliações do professor logado (por grupo)
  const [myDelivScores, setMyDelivScores] = useState(new Map()) // key `${group_id}:${number}` => {score, comments}
  const [myPitchScores, setMyPitchScores] = useState(new Map()) // key group_id => {...}

  // dialogs
  const [openDeliv, setOpenDeliv] = useState(false)
  const [openPitch, setOpenPitch] = useState(false)
  const [target, setTarget] = useState(null) // {type: 'delivery' | 'pitch', group}

  // form state
  const [score, setScore] = useState(0)
  const [comments, setComments] = useState('')
  const [themeScore, setThemeScore] = useState(0)
  const [companyScore, setCompanyScore] = useState(0)
  const [problemScore, setProblemScore] = useState(0)
  const [solutionScore, setSolutionScore] = useState(0)

  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' })

  useEffect(() => {
    ;(async () => {
      const ok = await isAdmin() // professores são tratados como admin no gate

      setAllowed(ok)
      const { data: u } = await supabase.auth.getUser()

      setUser(u?.user || null)

      if (!ok || !u?.user) {
        setLoading(false)

        return
      }

      // 1) busca assignments (tabela professor_subjects + joins manuais)
      const profId = u.user.id

      const { data: ps, error: e1 } = await supabase
        .from('professor_subjects')
        .select('id, subject_id, class_id')
        .eq('professor_user_id', profId)

      const subjectIds = [...new Set((ps || []).map(p => p.subject_id))]
      const classIds = [...new Set((ps || []).map(p => p.class_id))]

      const { data: subjects } = subjectIds.length
        ? await supabase.from('subjects').select('id, name, course_id').in('id', subjectIds)
        : { data: [] }

      const { data: classes } = classIds.length
        ? await supabase.from('classes').select('id, name, course_id, pitch_date').in('id', classIds)
        : { data: [] }

      const courseIds = [...new Set([...(subjects || []), ...(classes || [])].map(x => x?.course_id).filter(Boolean))]

      const { data: courses } = courseIds.length
        ? await supabase.from('courses').select('id, name').in('id', courseIds)
        : { data: [] }

      const courseById = new Map((courses || []).map(c => [c.id, c]))
      const subjectById = new Map((subjects || []).map(s => [s.id, s]))
      const classById = new Map((classes || []).map(c => [c.id, c]))

      const assembled = (ps || []).map(p => {
        const s = subjectById.get(p.subject_id) || {}
        const c = classById.get(p.class_id) || {}
        const course = courseById.get(c.course_id || s.course_id)

        return {
          id: p.id,
          subject_id: p.subject_id,
          subject_name: s?.name || '—',
          class_id: p.class_id,
          class_name: c?.name || '—',
          course_id: course?.id || s?.course_id || c?.course_id,
          course_name: course?.name || 'Curso',
          pitch_date: c?.pitch_date || null
        }
      })

      setAssigns(assembled)
      if (assembled.length) setAssignId(String(assembled[0].id))
      setLoading(false)
    })()
  }, [])

  // carrega grupos/entregas quando trocar a disciplina/turma
  useEffect(() => {
    ;(async () => {
      if (!assignId) return
      const a = assigns.find(x => String(x.id) === String(assignId))

      if (!a) return
      setLoading(true)
      setPitchDate(a.pitch_date)

      const { data: gs } = await supabase
        .from('pi_groups')
        .select('id, name, theme, company')
        .eq('class_id', a.class_id)
        .order('name', { ascending: true })

      setGroups(gs || [])

      const groupIds = (gs || []).map(g => g.id)

      const { data: ds } = groupIds.length
        ? await supabase
            .from('pi_deliveries')
            .select('id, group_id, number, due_date, submitted_at, artifact_url')
            .in('group_id', groupIds)
        : { data: [] }

      setDeliveries(ds || [])

      // avaliações do professor logado para esses grupos
      if (user) {
        const { data: dScores } = groupIds.length
          ? await supabase
              .from('pi_evaluations_delivery')
              .select('group_id, delivery_number, score, comments')
              .eq('professor_user_id', user.id)
              .in('group_id', groupIds)
          : { data: [] }

        const mapD = new Map()

        ;(dScores || []).forEach(r =>
          mapD.set(`${r.group_id}:${r.delivery_number}`, { score: r.score, comments: r.comments })
        )
        setMyDelivScores(mapD)

        const { data: pScores } = groupIds.length
          ? await supabase
              .from('pi_evaluations_pitch')
              .select('group_id, theme_score, company_score, problem_score, solution_score, overall_score, comments')
              .eq('professor_user_id', user.id)
              .in('group_id', groupIds)
          : { data: [] }

        const mapP = new Map()

        ;(pScores || []).forEach(r => mapP.set(r.group_id, r))
        setMyPitchScores(mapP)
      }

      setLoading(false)
    })()
  }, [assignId])

  const groupsWithDeliveries = useMemo(() => {
    const byGroup = new Map()

    ;(groups || []).forEach(g => byGroup.set(g.id, { group: g, d1: null, d2: null }))
    ;(deliveries || []).forEach(d => {
      const entry = byGroup.get(d.group_id)

      if (!entry) return
      if (Number(d.number) === 1) entry.d1 = d
      if (Number(d.number) === 2) entry.d2 = d
    })

    return Array.from(byGroup.values())
  }, [groups, deliveries])

  const isDeliveryOpen = d => !!(d && d.submitted_at && new Date(d.submitted_at).getTime() <= Date.now())
  const isPitchOpen = () => pitchDate && new Date(pitchDate).getTime() <= Date.now()

  const openDeliveryDialog = (g, which) => {
    setTarget({ type: 'delivery', group: g, which })
    const key = `${g.id}:${which}`
    const prev = myDelivScores.get(key)

    setScore(prev?.score ?? 0)
    setComments(prev?.comments ?? '')
    setOpenDeliv(true)
  }

  const openPitchDialog = g => {
    setTarget({ type: 'pitch', group: g })
    const prev = myPitchScores.get(g.id)

    setThemeScore(prev?.theme_score ?? 0)
    setCompanyScore(prev?.company_score ?? 0)
    setProblemScore(prev?.problem_score ?? 0)
    setSolutionScore(prev?.solution_score ?? 0)
    setComments(prev?.comments ?? '')
    setOpenPitch(true)
  }

  const saveDeliveryScore = async () => {
    if (!user || !target?.group) return
    const which = target.which

    const payload = {
      group_id: target.group.id,
      delivery_number: which,
      professor_user_id: user.id,
      score: clamp01(score),
      comments: comments || null
    }

    const { error } = await supabase
      .from('pi_evaluations_delivery')
      .upsert(payload, { onConflict: 'group_id,delivery_number,professor_user_id' })

    if (error) {
      setSnack({ open: true, msg: 'Erro ao salvar nota da entrega', sev: 'error' })

      return
    }

    const key = `${target.group.id}:${which}`
    const next = new Map(myDelivScores)

    next.set(key, { score: payload.score, comments: payload.comments })
    setMyDelivScores(next)
    setOpenDeliv(false)
    setSnack({ open: true, msg: 'Nota salva!', sev: 'success' })
  }

  const savePitchScore = async () => {
    if (!user || !target?.group) return
    const overall = (Number(themeScore) + Number(companyScore) + Number(problemScore) + Number(solutionScore)) / 4

    const payload = {
      group_id: target.group.id,
      professor_user_id: user.id,
      theme_score: clamp01(themeScore),
      company_score: clamp01(companyScore),
      problem_score: clamp01(problemScore),
      solution_score: clamp01(solutionScore),
      overall_score: clamp01(overall),
      comments: comments || null
    }

    const { error } = await supabase
      .from('pi_evaluations_pitch')
      .upsert(payload, { onConflict: 'group_id,professor_user_id' })

    if (error) {
      setSnack({ open: true, msg: 'Erro ao salvar avaliação do pitch', sev: 'error' })

      return
    }

    const next = new Map(myPitchScores)

    next.set(target.group.id, payload)
    setMyPitchScores(next)
    setOpenPitch(false)
    setSnack({ open: true, msg: 'Avaliação do pitch salva!', sev: 'success' })
  }

  if (!allowed)
    return (
      <Card>
        <CardHeader title='Acesso restrito' />
        <CardContent>
          <Typography>Área exclusiva de professores/administradores.</Typography>
        </CardContent>
      </Card>
    )

  return (
    <Box>
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
          label='Disciplina / Turma'
          value={assignId}
          onChange={e => setAssignId(e.target.value)}
          sx={{ minWidth: 320 }}
        >
          {assigns.map(a => (
            <MenuItem key={a.id} value={a.id}>
              {a.course_name} • {a.subject_name} — {a.class_name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {loading ? (
        <Grid container spacing={3}>
          {[...Array(3)].map((_, i) => (
            <Grid key={i} item xs={12}>
              <Skeleton variant='rounded' height={120} />
            </Grid>
          ))}
        </Grid>
      ) : groupsWithDeliveries.length === 0 ? (
        <Alert severity='info'>Nenhum grupo cadastrado para esta turma.</Alert>
      ) : (
        <Grid container spacing={3}>
          {groupsWithDeliveries.map(({ group, d1, d2 }) => {
            const k1 = `${group.id}:1`
            const k2 = `${group.id}:2`
            const s1 = myDelivScores.get(k1)
            const s2 = myDelivScores.get(k2)
            const p = myPitchScores.get(group.id)

            const open1 = isDeliveryOpen(d1)
            const open2 = isDeliveryOpen(d2)
            const openP = isPitchOpen()

            return (
              <Grid key={group.id} item xs={12}>
                <Card>
                  <CardHeader
                    title={
                      <Stack direction='row' spacing={1} alignItems='center'>
                        <Typography variant='h6' fontWeight={800}>
                          {group.name}
                        </Typography>
                        {group.theme ? <Chip size='small' label={`Tema: ${group.theme}`} /> : null}
                        {group.company ? <Chip size='small' label={`Empresa: ${group.company}`} /> : null}
                      </Stack>
                    }
                    subheader='Avalie as entregas quando disponíveis e, no dia do pitch, avalie a apresentação.'
                  />
                  <CardContent>
                    <Grid container spacing={2}>
                      {/* Entrega 1 */}
                      <Grid item xs={12} md={4}>
                        <Stack spacing={1}>
                          <Typography variant='subtitle1' fontWeight={700}>
                            Entrega 1
                          </Typography>
                          {d1 ? (
                            <Typography variant='body2' color='text.secondary'>
                              {d1.submitted_at
                                ? `Entregue em ${fmtDateTime(d1.submitted_at)}`
                                : `Prevista: ${fmtDateTime(d1.due_date)}`}
                            </Typography>
                          ) : (
                            <Typography variant='body2' color='text.secondary'>
                              Sem dados de entrega
                            </Typography>
                          )}
                          <Stack direction='row' spacing={1} alignItems='center'>
                            <Chip
                              size='small'
                              label={s1?.score != null ? `Sua nota: ${s1.score}` : 'Sem nota'}
                              color={s1?.score != null ? 'primary' : 'default'}
                            />
                            <Tooltip title={open1 ? '' : 'Disponível somente após a entrega'}>
                              <span>
                                <Button
                                  variant='contained'
                                  disabled={!open1}
                                  onClick={() => openDeliveryDialog(group, 1)}
                                >
                                  Avaliar
                                </Button>
                              </span>
                            </Tooltip>
                          </Stack>
                        </Stack>
                      </Grid>

                      {/* Entrega 2 */}
                      <Grid item xs={12} md={4}>
                        <Stack spacing={1}>
                          <Typography variant='subtitle1' fontWeight={700}>
                            Entrega 2
                          </Typography>
                          {d2 ? (
                            <Typography variant='body2' color='text.secondary'>
                              {d2.submitted_at
                                ? `Entregue em ${fmtDateTime(d2.submitted_at)}`
                                : `Prevista: ${fmtDateTime(d2.due_date)}`}
                            </Typography>
                          ) : (
                            <Typography variant='body2' color='text.secondary'>
                              Sem dados de entrega
                            </Typography>
                          )}
                          <Stack direction='row' spacing={1} alignItems='center'>
                            <Chip
                              size='small'
                              label={s2?.score != null ? `Sua nota: ${s2.score}` : 'Sem nota'}
                              color={s2?.score != null ? 'primary' : 'default'}
                            />
                            <Tooltip title={open2 ? '' : 'Disponível somente após a entrega'}>
                              <span>
                                <Button
                                  variant='contained'
                                  disabled={!open2}
                                  onClick={() => openDeliveryDialog(group, 2)}
                                >
                                  Avaliar
                                </Button>
                              </span>
                            </Tooltip>
                          </Stack>
                        </Stack>
                      </Grid>

                      {/* Pitch */}
                      <Grid item xs={12} md={4}>
                        <Stack spacing={1}>
                          <Typography variant='subtitle1' fontWeight={700}>
                            Pitch (apresentação)
                          </Typography>
                          <Typography variant='body2' color='text.secondary'>
                            {pitchDate ? `Data do pitch: ${fmtDateTime(pitchDate)}` : 'Sem data definida'}
                          </Typography>
                          <Stack direction='row' spacing={1} alignItems='center'>
                            <Chip
                              size='small'
                              label={p?.overall_score != null ? `Sua nota: ${p.overall_score}` : 'Sem nota'}
                              color={p?.overall_score != null ? 'primary' : 'default'}
                            />
                            <Tooltip title={openP ? '' : 'Disponível apenas no dia do pitch'}>
                              <span>
                                <Button variant='contained' disabled={!openP} onClick={() => openPitchDialog(group)}>
                                  Avaliar
                                </Button>
                              </span>
                            </Tooltip>
                          </Stack>
                        </Stack>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      )}

      {/* Dialog: Entrega */}
      <Dialog open={openDeliv} onClose={() => setOpenDeliv(false)} maxWidth='sm' fullWidth>
        <DialogTitle>
          Avaliar entrega {target?.which} — {target?.group?.name}
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
            value={comments}
            onChange={e => setComments(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeliv(false)}>Cancelar</Button>
          <Button variant='contained' onClick={saveDeliveryScore}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Pitch */}
      <Dialog open={openPitch} onClose={() => setOpenPitch(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Avaliar Pitch — {target?.group?.name}</DialogTitle>
        <DialogContent dividers>
          <Box py={1}>
            <Typography gutterBottom>Tema</Typography>
            <Slider
              min={0}
              max={10}
              step={0.5}
              value={themeScore}
              onChange={(e, v) => setThemeScore(v)}
              valueLabelDisplay='on'
            />
          </Box>
          <Box py={1}>
            <Typography gutterBottom>Empresa</Typography>
            <Slider
              min={0}
              max={10}
              step={0.5}
              value={companyScore}
              onChange={(e, v) => setCompanyScore(v)}
              valueLabelDisplay='on'
            />
          </Box>
          <Box py={1}>
            <Typography gutterBottom>Problema</Typography>
            <Slider
              min={0}
              max={10}
              step={0.5}
              value={problemScore}
              onChange={(e, v) => setProblemScore(v)}
              valueLabelDisplay='on'
            />
          </Box>
          <Box py={1}>
            <Typography gutterBottom>Solução</Typography>
            <Slider
              min={0}
              max={10}
              step={0.5}
              value={solutionScore}
              onChange={(e, v) => setSolutionScore(v)}
              valueLabelDisplay='on'
            />
          </Box>
          <Alert severity='info' sx={{ mb: 2 }}>
            Nota final = média das quatro notas
          </Alert>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label='Comentários (opcional)'
            value={comments}
            onChange={e => setComments(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPitch(false)}>Cancelar</Button>
          <Button variant='contained' onClick={savePitchScore}>
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
