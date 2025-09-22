'use client'

import React, { useEffect, useMemo, useState } from 'react'

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
  TextField,
  MenuItem,
  Alert,
  Snackbar,
  InputAdornment,
  Divider,
  Checkbox,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Menu
} from '@mui/material'

import SearchIcon from '@mui/icons-material/Search'
import SaveIcon from '@mui/icons-material/Save'
import RefreshIcon from '@mui/icons-material/Refresh'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import PersonIcon from '@mui/icons-material/Person'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import RemoveDoneIcon from '@mui/icons-material/RemoveDone'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import SchoolIcon from '@mui/icons-material/School'

import { supabase } from '@/libs/supabaseAuth'

const norm = v => (v ?? '').toString().trim()
const uniqStr = arr => Array.from(new Set(arr.map(String)))
const by = k => (a, b) => String(a[k] ?? '').localeCompare(String(b[k] ?? ''))

// chave composta de turma/semestre para garantir precisão de alocação
const keyTCS = (classId, sem) => `${classId}:${sem}`

const parseKeyTCS = k => {
  const [class_id, semester_int] = String(k).split(':')

  return { class_id, semester_int: Number(semester_int) || null }
}

export default function PageAtribuirDisciplinas() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // listas base
  const [professors, setProfessors] = useState([]) // {id, name, email}
  const [subjects, setSubjects] = useState([]) // {id, name, course, semester, has_delivery}
  const [classesList, setClassesList] = useState([]) // {id, name, course, semester}

  // filtros
  const [course, setCourse] = useState('')
  const [semester, setSemester] = useState('')
  const [profQuery, setProfQuery] = useState('')
  const [subjectQuery, setSubjectQuery] = useState('')

  // seleção de edição
  const [selectedProfessor, setSelectedProfessor] = useState(null)
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(new Set())
  const [selectedClassSemKeys, setSelectedClassSemKeys] = useState(new Set()) // <<< chave composta

  // UI
  const [saving, setSaving] = useState(false)
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' })
  const [moreAnchor, setMoreAnchor] = useState(null)

  const refreshAll = async () => {
    try {
      setLoading(true)

      // admin?
      let isAdm = false

      try {
        const { data, error } = await supabase.rpc('is_admin')

        if (!error) isAdm = !!data
      } catch {
        isAdm = false
      }

      setIsAdmin(isAdm)

      // professores
      const { data: profs, error: ep } = await supabase
        .from('professors')
        .select('id, name, email')
        .order('name', { ascending: true })

      if (ep) throw ep
      setProfessors(profs || [])

      // subjects
      const { data: subsRaw, error: es } = await supabase
        .from('subjects')
        .select('id, name, semester, has_delivery, course_id')
        .order('semester', { ascending: true })
        .order('name', { ascending: true })

      if (es) throw es

      // courses p/ pegar code
      const { data: courses, error: ec } = await supabase.from('courses').select('id, code')

      if (ec) throw ec
      const codeByCourseId = Object.fromEntries((courses || []).map(c => [String(c.id), c.code]))

      const subs = (subsRaw || []).map(s => ({
        id: s.id,
        name: s.name,
        semester: s.semester,
        has_delivery: s.has_delivery,
        course: codeByCourseId[String(s.course_id)] || null
      }))

      subs.sort(
        (a, b) =>
          (a.course || '').localeCompare(b.course || '') ||
          Number(a.semester) - Number(b.semester) ||
          (a.name || '').localeCompare(b.name || '')
      )
      setSubjects(subs)

      // classes
      const { data: clsRaw, error: ecl } = await supabase
        .from('classes')
        .select('id, name, course_id')
        .order('name', { ascending: true })

      if (ecl) throw ecl

      // pi_groups (para saber os semestres com grupos por turma)
      const { data: gps, error: eg } = await supabase
        .from('pi_groups')
        .select('class_id, semester')
        .not('semester', 'is', null)

      if (eg) throw eg

      const semsByClass = new Map()

      ;(gps || []).forEach(g => {
        const k = String(g.class_id)

        if (!semsByClass.has(k)) semsByClass.set(k, new Set())
        if (g.semester != null) semsByClass.get(k).add(Number(g.semester))
      })

      const classesEnriched = []

      ;(clsRaw || []).forEach(c => {
        const code = codeByCourseId[String(c.course_id)] || null
        const sems = Array.from(semsByClass.get(String(c.id)) || [])

        if (sems.length === 0) {
          // ainda mostramos, mas com semester null (não aparece quando filtra por semestre)
          classesEnriched.push({ id: c.id, name: c.name, course: code, semester: null })
        } else {
          sems
            .sort((a, b) => a - b)
            .forEach(s => {
              classesEnriched.push({ id: c.id, name: c.name, course: code, semester: s })
            })
        }
      })
      classesEnriched.sort(by('name'))
      setClassesList(classesEnriched)

      // filtros default
      if (subs?.length) {
        if (!course) setCourse(subs[0].course || '')
        if (!semester) setSemester(subs[0].semester ? String(subs[0].semester) : '')
      }
    } catch (e) {
      setSnack({ open: true, msg: e.message || 'Falha ao carregar dados.', sev: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Carrega atribuições do professor selecionado
  useEffect(() => {
    ;(async () => {
      // limpar seleção ao trocar professor
      setSelectedSubjectIds(new Set())
      setSelectedClassSemKeys(new Set())

      if (!selectedProfessor?.id) return

      try {
        // disciplinas
        const { data: ts, error: ets } = await supabase
          .from('teacher_subjects')
          .select('subject_id')
          .eq('teacher_id', selectedProfessor.id)

        if (ets) throw ets
        setSelectedSubjectIds(new Set((ts || []).map(r => String(r.subject_id))))

        // turmas/semestre
        const { data: tcs, error: etcs } = await supabase
          .from('teacher_class_semesters')
          .select('class_id, semester_int')
          .eq('teacher_id', selectedProfessor.id)

        if (etcs) throw etcs
        setSelectedClassSemKeys(new Set((tcs || []).map(r => keyTCS(r.class_id, r.semester_int))))
      } catch (e) {
        setSnack({ open: true, msg: e.message || 'Falha ao carregar atribuições.', sev: 'error' })
      }
    })()
  }, [selectedProfessor?.id])

  // ------------------------- MEMOS -------------------------
  const courses = useMemo(() => uniqStr(subjects.map(s => s.course).filter(Boolean)), [subjects])
  const semesters = useMemo(() => uniqStr(subjects.map(s => s.semester).filter(Boolean)), [subjects])

  const filteredProfessors = useMemo(() => {
    const q = norm(profQuery).toLowerCase()

    if (!q) return professors

    return professors.filter(p => (p.name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q))
  }, [professors, profQuery])

  const filteredSubjects = useMemo(() => {
    let list = subjects

    if (course) list = list.filter(s => String(s.course).toUpperCase() === String(course).toUpperCase())
    if (semester) list = list.filter(s => String(s.semester) === String(semester))
    const q = norm(subjectQuery).toLowerCase()

    if (q) list = list.filter(s => (s.name || '').toLowerCase().includes(q))

    return list
  }, [subjects, course, semester, subjectQuery])

  const filteredClasses = useMemo(() => {
    if (!course || !semester) return []
    const sem = Number(semester)

    return classesList.filter(
      c => String(c.course).toUpperCase() === String(course).toUpperCase() && Number(c.semester) === sem
    )
  }, [classesList, course, semester])

  const filteredClassSemKeys = useMemo(() => filteredClasses.map(c => keyTCS(c.id, c.semester)), [filteredClasses])

  const totalFiltered = filteredSubjects.length

  const totalChecked = filteredSubjects.reduce((acc, s) => acc + (selectedSubjectIds.has(String(s.id)) ? 1 : 0), 0)

  // ------------------------- ACTIONS -------------------------
  const toggleSubject = (sid, checked) => {
    setSelectedSubjectIds(prev => {
      const next = new Set(prev)
      const k = String(sid)

      if (checked) next.add(k)
      else next.delete(k)

      return next
    })
  }

  const selectAllFiltered = () => {
    setSelectedSubjectIds(prev => {
      const next = new Set(prev)

      filteredSubjects.forEach(s => next.add(String(s.id)))

      return next
    })
  }

  const clearAllFiltered = () => {
    setSelectedSubjectIds(prev => {
      const next = new Set(prev)

      filteredSubjects.forEach(s => next.delete(String(s.id)))

      return next
    })
  }

  const toggleClass = (classSemKey, checked) => {
    setSelectedClassSemKeys(prev => {
      const next = new Set(prev)
      const k = String(classSemKey)

      if (checked) next.add(k)
      else next.delete(k)

      return next
    })
  }

  const selectAllClasses = () => {
    setSelectedClassSemKeys(prev => {
      const next = new Set(prev)

      filteredClassSemKeys.forEach(k => next.add(k))

      return next
    })
  }

  const clearAllClasses = () => {
    setSelectedClassSemKeys(prev => {
      const next = new Set(prev)

      filteredClassSemKeys.forEach(k => next.delete(k))

      return next
    })
  }

  const saveAssignments = async () => {
    if (!selectedProfessor?.id) {
      setSnack({ open: true, msg: 'Selecione um professor.', sev: 'warning' })

      return
    }

    if (!isAdmin) {
      setSnack({ open: true, msg: 'Apenas coordenadores podem editar atribuições.', sev: 'warning' })

      return
    }

    try {
      setSaving(true)

      // 1) DISCIPLINAS (apenas dentro do filtro atual)
      const filteredSubjectIds = filteredSubjects.map(s => String(s.id))

      if (filteredSubjectIds.length) {
        const { error: delErr } = await supabase
          .from('teacher_subjects')
          .delete()
          .eq('teacher_id', selectedProfessor.id)
          .in('subject_id', filteredSubjectIds)

        if (delErr) throw delErr
      }

      const toInsertSubjects = filteredSubjectIds
        .filter(id => selectedSubjectIds.has(id))
        .map(subject_id => ({ teacher_id: selectedProfessor.id, subject_id }))

      if (toInsertSubjects.length) {
        const { error: insErr } = await supabase
          .from('teacher_subjects')
          .upsert(toInsertSubjects, { onConflict: 'teacher_id,subject_id', ignoreDuplicates: false })

        if (insErr) throw insErr
      }

      // 2) TURMAS/SEMESTRE (apenas do filtro atual)
      if (!course || !semester) {
        setSnack({
          open: true,
          msg: 'Atenção: defina Curso e Semestre e selecione as turmas desejadas.',
          sev: 'warning'
        })
      } else {
        // Delete só das alocações desse professor no semestre atual
        const { error: delErr } = await supabase
          .from('teacher_class_semesters')
          .delete()
          .eq('teacher_id', selectedProfessor.id)
          .eq('semester_int', Number(semester))

        if (delErr) throw delErr

        // Insere pares class_id + semester_int a partir das chaves marcadas (filtradas)
        const toInsertClasses = Array.from(selectedClassSemKeys)
          .filter(k => filteredClassSemKeys.includes(k)) // restringe ao filtro
          .map(k => {
            const { class_id, semester_int } = parseKeyTCS(k)

            return { teacher_id: selectedProfessor.id, class_id, semester_int }
          })

        if (toInsertClasses.length) {
          const { error: insErr } = await supabase
            .from('teacher_class_semesters')
            .upsert(toInsertClasses, { onConflict: 'teacher_id,class_id,semester_int', ignoreDuplicates: false })

          if (insErr) throw insErr
        }
      }

      setSnack({ open: true, msg: 'Atribuições salvas com sucesso.', sev: 'success' })
    } catch (e) {
      setSnack({ open: true, msg: e.message || 'Erro ao salvar atribuições.', sev: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // ------------------------- RENDER -------------------------
  if (loading) {
    return (
      <Grid container spacing={3}>
        {[...Array(3)].map((_, i) => (
          <Grid key={i} item xs={12}>
            <Skeleton variant='rounded' height={140} />
          </Grid>
        ))}
      </Grid>
    )
  }

  return (
    <Box sx={{ pb: 4 }}>
      {/* Topbar */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ mb: 3 }}
      >
        <Typography variant='h4' fontWeight={900}>
          Atribuição de Disciplinas
        </Typography>

        <Stack direction='row' spacing={1} flexWrap='wrap'>
          <Chip
            size='small'
            color='primary'
            variant='outlined'
            label={`Cursos: ${uniqStr(subjects.map(s => s.course).filter(Boolean)).length || 0}`}
          />
          <Chip
            size='small'
            color='primary'
            variant='outlined'
            label={`Semestres: ${uniqStr(subjects.map(s => s.semester).filter(Boolean)).length || 0}`}
          />
          <Tooltip title='Quantidade dentro do filtro atual'>
            <Chip
              size='small'
              icon={<InfoOutlinedIcon fontSize='small' />}
              label={`${totalChecked}/${totalFiltered} disciplinas`}
            />
          </Tooltip>
          <Tooltip title='Turmas encontradas para o filtro atual'>
            <Chip
              size='small'
              icon={<SchoolIcon fontSize='small' />}
              label={`${filteredClassSemKeys.length} turma(s)`}
            />
          </Tooltip>
          <Tooltip title='Turmas selecionadas'>
            <Chip
              size='small'
              color='success'
              variant='outlined'
              label={`${selectedClassSemKeys.size} turma(s) marcadas`}
            />
          </Tooltip>
        </Stack>

        <Box sx={{ flexGrow: 1 }} />

        <Button variant='outlined' startIcon={<RefreshIcon />} onClick={refreshAll}>
          Atualizar
        </Button>
      </Stack>

      <Grid container spacing={3}>
        {/* Coluna 1 — Professores */}
        <Grid item xs={12} md={4} lg={3}>
          <Card>
            <CardHeader title='Professores' subheader='Selecione para editar as atribuições' sx={{ pb: 0 }} />
            <CardContent sx={{ pt: 1.5 }}>
              <TextField
                fullWidth
                size='small'
                placeholder='Buscar por nome ou e-mail'
                value={profQuery}
                onChange={e => setProfQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position='start'>
                      <SearchIcon fontSize='small' />
                    </InputAdornment>
                  )
                }}
                sx={{ mb: 1.5 }}
              />

              <Box
                sx={{
                  maxHeight: 520,
                  overflowY: 'auto',
                  border: theme => `1px solid ${theme.palette.divider}`,
                  borderRadius: 1
                }}
              >
                <Table size='small' stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell width={36}>
                        <PersonIcon fontSize='small' />
                      </TableCell>
                      <TableCell>Nome</TableCell>
                      <TableCell>Email</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredProfessors.map(p => {
                      const selected = selectedProfessor?.id === p.id

                      return (
                        <TableRow
                          key={p.id}
                          hover
                          selected={selected}
                          sx={{
                            cursor: 'pointer',
                            '&.Mui-selected': { backgroundColor: theme => theme.palette.action.selected }
                          }}
                          onClick={() => setSelectedProfessor(p)}
                        >
                          <TableCell>
                            <PersonIcon fontSize='small' />
                          </TableCell>
                          <TableCell sx={{ fontWeight: selected ? 700 : 500 }}>{p.name || '(sem nome)'}</TableCell>
                          <TableCell>{p.email}</TableCell>
                        </TableRow>
                      )
                    })}
                    {filteredProfessors.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3}>
                          <Alert severity='info'>Nenhum professor encontrado.</Alert>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>

              <Box sx={{ mt: 2 }}>
                {!selectedProfessor ? (
                  <Alert severity='info'>Selecione um professor para editar as atribuições.</Alert>
                ) : (
                  <Alert severity='success'>
                    Editando: <strong>{selectedProfessor.name}</strong> — {selectedProfessor.email}
                  </Alert>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Coluna 2 — Filtros, Disciplinas e Turmas */}
        <Grid item xs={12} md={8} lg={9}>
          <Card>
            <CardHeader
              title={
                <Stack direction='row' alignItems='center' spacing={1} flexWrap='wrap'>
                  <Typography variant='h6' fontWeight={800}>
                    Disciplinas
                  </Typography>
                  {course ? <Chip size='small' label={course} /> : null}
                  {semester ? <Chip size='small' variant='outlined' label={`${semester}º`} /> : null}
                </Stack>
              }
              subheader='Filtre, selecione as disciplinas e marque as TURMAS em que este professor pode avaliar'
              action={
                <Tooltip title='Filtros'>
                  <IconButton onClick={e => setMoreAnchor(e.currentTarget)}>
                    <FilterAltIcon />
                  </IconButton>
                </Tooltip>
              }
            />
            <Menu open={Boolean(moreAnchor)} anchorEl={moreAnchor} onClose={() => setMoreAnchor(null)}>
              <Box sx={{ px: 2, py: 1.5, width: 320 }}>
                <Typography variant='subtitle2' sx={{ mb: 1 }}>
                  Filtros
                </Typography>
                <Stack spacing={1.5}>
                  <TextField
                    select
                    fullWidth
                    size='small'
                    label='Curso'
                    value={course}
                    onChange={e => setCourse(e.target.value)}
                  >
                    {uniqStr(subjects.map(s => s.course).filter(Boolean)).map(c => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                    {uniqStr(subjects.map(s => s.course).filter(Boolean)).length === 0 && (
                      <MenuItem disabled>Nenhum</MenuItem>
                    )}
                  </TextField>
                  <TextField
                    select
                    fullWidth
                    size='small'
                    label='Semestre'
                    value={semester}
                    onChange={e => setSemester(e.target.value)}
                  >
                    {uniqStr(subjects.map(s => s.semester).filter(Boolean)).map(s => (
                      <MenuItem key={s} value={String(s)}>
                        {s}º
                      </MenuItem>
                    ))}
                    {uniqStr(subjects.map(s => s.semester).filter(Boolean)).length === 0 && (
                      <MenuItem disabled>Nenhum</MenuItem>
                    )}
                  </TextField>
                  <TextField
                    fullWidth
                    size='small'
                    label='Buscar disciplina'
                    placeholder='Nome da disciplina'
                    value={subjectQuery}
                    onChange={e => setSubjectQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position='start'>
                          <SearchIcon fontSize='small' />
                        </InputAdornment>
                      )
                    }}
                  />
                </Stack>
              </Box>
            </Menu>

            <CardContent>
              {/* Chips rápidos */}
              <Stack direction='row' spacing={1} sx={{ mb: 1.5 }} flexWrap='wrap'>
                {uniqStr(subjects.map(s => s.course).filter(Boolean)).map(c => {
                  const active = String(course).toUpperCase() === String(c).toUpperCase()

                  return (
                    <Chip
                      key={c}
                      label={c}
                      variant={active ? 'filled' : 'outlined'}
                      color={active ? 'primary' : 'default'}
                      onClick={() => setCourse(c)}
                      sx={{ mb: 1 }}
                    />
                  )
                })}
              </Stack>

              <Stack direction='row' spacing={1} sx={{ mb: 2 }} flexWrap='wrap'>
                {uniqStr(subjects.map(s => s.semester).filter(Boolean)).map(s => {
                  const active = String(semester) === String(s)

                  return (
                    <Chip
                      key={s}
                      label={`${s}º`}
                      variant={active ? 'filled' : 'outlined'}
                      color={active ? 'primary' : 'default'}
                      onClick={() => setSemester(String(s))}
                      sx={{ mb: 1 }}
                    />
                  )
                })}
              </Stack>

              {/* Disciplinas */}
              <Stack direction='row' spacing={1} sx={{ mb: 1.5 }} flexWrap='wrap'>
                <Chip
                  size='small'
                  icon={<DoneAllIcon fontSize='small' />}
                  label='Selecionar todas (filtro)'
                  onClick={selectAllFiltered}
                />
                <Chip
                  size='small'
                  icon={<RemoveDoneIcon fontSize='small' />}
                  label='Limpar seleção (filtro)'
                  onClick={clearAllFiltered}
                />
                <Chip size='small' label={`${totalChecked}/${totalFiltered} disciplinas`} />
              </Stack>

              {filteredSubjects.length === 0 ? (
                <Alert severity='info'>Nenhuma disciplina encontrado para os filtros.</Alert>
              ) : (
                <Grid container spacing={1.25}>
                  {filteredSubjects.map(s => {
                    const checked = selectedSubjectIds.has(String(s.id))

                    return (
                      <Grid key={s.id} item xs={12} md={6} lg={4}>
                        <Box
                          sx={{
                            p: 1.25,
                            border: theme =>
                              `1px solid ${checked ? theme.palette.primary.main : theme.palette.divider}`,
                            borderRadius: 1.5,
                            bgcolor: theme => (checked ? theme.palette.action.hover : 'transparent'),
                            transition: 'border-color .15s ease, background-color .15s ease'
                          }}
                        >
                          <Stack direction='row' spacing={1.25} alignItems='flex-start'>
                            <Checkbox checked={checked} onChange={(_, v) => toggleSubject(s.id, v)} />
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant='body2' fontWeight={700} noWrap title={s.name}>
                                {s.name}
                              </Typography>
                              <Typography variant='caption' color='text.secondary'>
                                {s.course} • {s.semester}º {s.has_delivery === false ? ' • (sem entrega)' : ''}
                              </Typography>
                            </Box>
                          </Stack>
                        </Box>
                      </Grid>
                    )
                  })}
                </Grid>
              )}

              <Divider sx={{ my: 2 }} />

              {/* TURMAS (multi-seleção) */}
              <Typography variant='subtitle1' fontWeight={800} sx={{ mb: 1 }}>
                Turmas do filtro {course || '—'} / {semester || '—'}º
              </Typography>

              {filteredClasses.length === 0 ? (
                <Alert severity='info'>Não há turmas cadastradas para este Curso/Semestre.</Alert>
              ) : (
                <Box
                  sx={{
                    border: theme => `1px solid ${theme.palette.divider}`,
                    borderRadius: 1,
                    maxHeight: 260,
                    overflowY: 'auto',
                    p: 1
                  }}
                >
                  {filteredClasses.map(c => {
                    const k = keyTCS(c.id, c.semester)
                    const checked = selectedClassSemKeys.has(k)

                    return (
                      <Stack key={k} direction='row' alignItems='center' spacing={1} sx={{ py: 0.5 }}>
                        <Checkbox checked={checked} onChange={(_, v) => toggleClass(k, v)} />
                        <Typography variant='body2' sx={{ flexGrow: 1 }}>
                          {c.name}
                        </Typography>
                        <Chip size='small' variant='outlined' label={`${c.semester ?? '—'}º • ${c.course || '—'}`} />
                      </Stack>
                    )
                  })}
                </Box>
              )}

              <Stack direction='row' spacing={1} sx={{ mt: 1, mb: 2 }}>
                <Chip
                  size='small'
                  icon={<DoneAllIcon fontSize='small' />}
                  label='Selecionar todas as turmas'
                  onClick={selectAllClasses}
                />
                <Chip
                  size='small'
                  icon={<RemoveDoneIcon fontSize='small' />}
                  label='Limpar turmas'
                  onClick={clearAllClasses}
                />
                <Chip
                  size='small'
                  color='success'
                  variant='outlined'
                  label={`${selectedClassSemKeys.size} turma(s) marcadas`}
                />
              </Stack>

              <Divider sx={{ my: 2 }} />

              {/* Barra de ações */}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                spacing={1.5}
                sx={{ position: 'sticky', bottom: 0, bgcolor: theme => theme.palette.background.paper, pt: 1, pb: 0.5 }}
              >
                <Stack direction='row' spacing={1} flexWrap='wrap'>
                  <Chip
                    icon={<CheckCircleIcon />}
                    color='success'
                    label={`${totalChecked} disciplinas`}
                    variant='outlined'
                  />
                  <Chip
                    icon={<HighlightOffIcon />}
                    label={`${totalFiltered - totalChecked} restantes`}
                    variant='outlined'
                  />
                  <Chip icon={<SchoolIcon />} label={`${selectedClassSemKeys.size} turma(s)`} variant='outlined' />
                </Stack>
                <Box sx={{ flexGrow: 1 }} />
                <Button
                  variant='contained'
                  startIcon={<SaveIcon />}
                  onClick={saveAssignments} // <= chama direto
                  disabled={!selectedProfessor?.id || saving || (totalChecked === 0 && selectedClassSemKeys.size === 0)}
                  sx={{ px: 3, fontWeight: 800 }}
                >
                  {saving ? 'Salvando...' : 'Salvar atribuições'}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {!isAdmin && (
            <Box sx={{ mt: 2 }}>
              <Alert severity='warning'>
                Você não é coordenador. Caso precise editar atribuições, solicite acesso ao coordenador de PI.
              </Alert>
            </Box>
          )}
        </Grid>
      </Grid>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        message={snack.msg}
      />
    </Box>
  )
}
