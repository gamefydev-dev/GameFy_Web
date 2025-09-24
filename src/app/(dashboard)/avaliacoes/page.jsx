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
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  Snackbar,
  InputAdornment,
  Slider,
  Divider,
  Checkbox,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import GroupIcon from '@mui/icons-material/Groups2'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import VisibilityIcon from '@mui/icons-material/Visibility'
import LinkIcon from '@mui/icons-material/Link'

import { supabase } from '@/libs/supabaseAuth'

// -------------------------------------------------------------
// Helpers & Constantes
// -------------------------------------------------------------
const clamp10 = n => Math.min(10, Math.max(0, Number.isFinite(n) ? n : 0))
const round2 = n => Number((Math.round(n * 100) / 100).toFixed(2))
const norm = v => (v ?? '').toString().trim()
const asKey = v => String(v) // 👈 garante string para UUID/number

const formatBR = n => {
  if (n == null || Number.isNaN(n)) return ''

  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: n % 1 ? 1 : 0, maximumFractionDigits: 2 })
}

const marks = Array.from({ length: 11 }, (_, i) => ({ value: i, label: i }))

const ROLE_LABEL = {
  delivery_1: '1ª Entrega',
  delivery_2: '2ª Entrega',
  presentation: 'Apresentação',
  system_final: 'Nota Final'
}

const W_E1 = 0.06
const W_E2 = 0.08

const PRESENT_CRITERIA = [
  { key: 'creativity', label: 'Criatividade' },
  { key: 'impact', label: 'Impacto' },
  { key: 'embasement', label: 'Embasamento' },
  { key: 'organization', label: 'Organização' }
]

const SUBJECTS_TO_SKIP = ({ course, semester, name }) => {
  const nm = (name || '').toLowerCase()
  const isEnglish = nm.includes('business english')

  if (!isEnglish) return false
  const c = (course || '').toUpperCase()
  const s = Number(semester || 0)

  if (c === 'CCOMP' && (s === 3 || s === 4)) return true
  if (c === 'ADS' && s === 3) return true

  return false
}

const roleKeyDelivery = (deliveryNo, subjectId) => `delivery_${deliveryNo}:subject_${asKey(subjectId)}`

const roleKeyDeliveryStudent = (deliveryNo, subjectId, studentId) =>
  `delivery_${deliveryNo}:subject_${asKey(subjectId)}:student_${asKey(studentId)}`

const roleKeyPresentationCriterion = crit => `presentation:${crit}`
const roleKeyPresentationFinalStudent = studentKey => `presentation:final:student_${asKey(studentKey)}`

// -------------------------------------------------------------
// Componente
// -------------------------------------------------------------
export default function PageAvaliacoes() {
  const [user, setUser] = useState(null)
  const [userEmail, setUserEmail] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const [professorId, setProfessorId] = useState(null)

  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')

  const [groups, setGroups] = useState([])
  const [subjects, setSubjects] = useState([])
  const [mySubjects, setMySubjects] = useState(new Set())
  const [search, setSearch] = useState('')

  const [showAll, setShowAll] = useState(false)

  const [myScores, setMyScores] = useState(new Map())

  const [dlgOpen, setDlgOpen] = useState(false)
  const [dlgMode, setDlgMode] = useState('delivery') // 'delivery' | 'presentation'
  const [target, setTarget] = useState(null)

  const [score, setScore] = useState(0)
  const [comment, setComment] = useState('')
  const [commentTouched, setCommentTouched] = useState(false)

  // individuais começam vazios e copyToAll = false
  const [indiv, setIndiv] = useState([]) // [{student, value (0..10|''), changed}]
  const [copyToAll, setCopyToAll] = useState(false)

  const [presentValues, setPresentValues] = useState({})
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' })

  const scoreIsValid = Number.isFinite(score) && score >= 0 && score <= 10
  const commentIsValid = norm(comment).length > 0

  const inferCourseFromClassName = (name = '') => {
    const n = name.toLowerCase()

    if (n.includes('ads')) return 'ADS'

    return 'CCOMP'
  }

  // ---------------------------------- AUTH ----------------------------------
  useEffect(() => {
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      const authUser = u?.user || null

      setUser(authUser)
      setUserEmail(authUser?.email?.toLowerCase() || null)

      let admin = false

      try {
        const { data, error } = await supabase.rpc('is_admin')

        if (!error) admin = !!data
      } catch {
        admin = false
      }

      setIsAdmin(admin)

      let profId = null

      if (authUser?.email) {
        const { data: profRow } = await supabase
          .from('professors')
          .select('id,email')
          .ilike('email', authUser.email)
          .maybeSingle()

        profId = profRow?.id || null
      }

      setProfessorId(profId)

      setLoading(true)

      if (admin) {
        let cls = []

        try {
          const { data: rows, error } = await supabase
            .from('classes')
            .select('id, name, course, semester')
            .order('name', { ascending: true })

          if (error) throw error
          cls = (rows || []).map(r => ({
            id: r.id,
            name: r.name,
            course: r.course ?? null,
            semester: r.semester ?? null,
            semester_int_fallback: null
          }))
        } catch {
          const { data: rows2 } = await supabase.from('classes').select('id, name').order('name', { ascending: true })

          cls = (rows2 || []).map(r => ({
            id: r.id,
            name: r.name,
            course: null,
            semester: null,
            semester_int_fallback: null
          }))
        }

        setClasses(cls)
        if (cls.length) setClassId(String(cls[0].id))
      } else {
        if (!profId) setClasses([])
        else {
          const { data: tcs, error } = await supabase
            .from('teacher_class_semesters')
            .select('class_id, semester_int, class:classes(id, name, course, semester)')
            .eq('teacher_id', profId)

          if (error) setClasses([])
          else {
            const map = new Map()

            ;(tcs || []).forEach(row => {
              const c = row.class || {}
              const id = c.id || row.class_id

              if (!id) return

              const prev = map.get(id)

              const semester_int_fallback = Math.min(
                prev?.semester_int_fallback ?? row.semester_int ?? 99,
                row.semester_int ?? 99
              )

              map.set(id, {
                id,
                name: c.name,
                course: c.course ?? null,
                semester: c.semester ?? null,
                semester_int_fallback: Number.isFinite(semester_int_fallback) ? semester_int_fallback : null
              })
            })
            const cls = Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''))

            setClasses(cls)
            if (cls.length) setClassId(String(cls[0].id))
          }
        }
      }

      setLoading(false)
    })()
  }, [])

  // ---------------------------------- LOAD (por turma) ----------------------------------
  useEffect(() => {
    ;(async () => {
      if (!classId || !user) return
      setLoading(true)

      const { data: gs } = await supabase
        .from('pi_groups')
        .select('id, name, code, semester, github_url, class_id, class:classes(name, course, semester)')
        .eq('class_id', classId)
        .order('name', { ascending: true })

      const groupIds = (gs || []).map(g => g.id)

      // membros
      let membersBy = new Map()

      if (groupIds.length) {
        const tryTables = [
          { table: 'pi_group_members', fields: 'group_id, full_name, email, github, student_user_id' },
          { table: 'group_members', fields: 'group_id, full_name, email, github, student_id, student_user_id' }
        ]

        for (const t of tryTables) {
          const { data, error } = await supabase.from(t.table).select(t.fields).in('group_id', groupIds)

          if (!error && data?.length) {
            const by = new Map()

            data.forEach(r => {
              const gid = String(r.group_id)

              if (!by.has(gid)) by.set(gid, [])
              by.get(gid).push({
                student_id: r.student_user_id || r.student_id || null, // pode ser user_id
                student_user_id: r.student_user_id || null,
                full_name: r.full_name || null,
                email: (r.email || '').toLowerCase() || null,
                github: r.github || null
              })
            })
            membersBy = by
            break
          }
        }
      }

      const groupsWithMembers = (gs || []).map(g => ({ ...g, members: membersBy.get(String(g.id)) || [] }))

      setGroups(groupsWithMembers)

      // disciplinas (catálogo da turma)
      const selectedClass = classes.find(c => String(c.id) === String(classId))

      const resolvedCourse =
        selectedClass?.course ??
        gs?.[0]?.class?.course ??
        inferCourseFromClassName(selectedClass?.name || gs?.[0]?.class?.name || '')

      const resolvedSemester =
        selectedClass?.semester ?? gs?.[0]?.class?.semester ?? selectedClass?.semester_int_fallback ?? null

      let subj = []

      try {
        let query = supabase.from('subjects').select('id,name,course,semester,has_delivery')

        if (resolvedCourse) query = query.eq('course', resolvedCourse)
        if (resolvedSemester != null) query = query.eq('semester', resolvedSemester)
        const { data: sdata } = await query.order('name', { ascending: true })

        subj = sdata || []
      } catch {
        subj = []
      }

      const filtered = subj.filter(
        s => !(SUBJECTS_TO_SKIP({ course: s.course, semester: s.semester, name: s.name }) || s.has_delivery === false)
      )

      setSubjects(filtered)

      // disciplinas atribuídas ao professor
      const mySet = new Set()

      try {
        if (professorId) {
          const { data: ts } = await supabase
            .from('teacher_subjects')
            .select('subject_id')
            .eq('teacher_id', professorId)

          ;(ts || []).forEach(r => mySet.add(String(r.subject_id)))
        }
      } catch {}

      setMySubjects(mySet)

      // notas já lançadas por mim (grupo)
      const { data: evs } = await supabase
        .from('evaluations')
        .select('id, group_id, evaluator_id, evaluator_role, score, comment')
        .eq('evaluator_id', user.id)
        .in('group_id', groupIds)

      const map = new Map()

      ;(evs || []).forEach(r => {
        map.set(`${r.group_id}:${r.evaluator_role}`, { id: r.id, score: r.score, comment: r.comment })
      })
      setMyScores(map)

      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, user, professorId, classes])

  // ---------------------------------- Filtro ----------------------------------
  const filteredGroups = useMemo(() => {
    const q = (search || '').toLowerCase().trim()

    const base = !q
      ? groups
      : groups.filter(g => {
          const name = (g.name || '').toLowerCase()
          const code = (g.code || '').toLowerCase()
          const turma = (g.class?.name || '').toLowerCase()

          return name.includes(q) || code.includes(q) || turma.includes(q)
        })

    if (!isAdmin || (isAdmin && !showAll)) {
      return base.filter(g => {
        const selectedClass = classes.find(c => String(c.id) === String(classId))

        const course =
          g.class?.course ??
          selectedClass?.course ??
          inferCourseFromClassName(g.class?.name || selectedClass?.name || '')

        const semesterForFilter =
          g.semester ?? g.class?.semester ?? selectedClass?.semester ?? selectedClass?.semester_int_fallback

        const hasAnyMine = subjects.some(
          s => s.course === course && Number(s.semester) === Number(semesterForFilter) && mySubjects.has(String(s.id))
        )

        return hasAnyMine
      })
    }

    return base
  }, [groups, search, isAdmin, showAll, classes, classId, subjects, mySubjects])

  // ---------------------------------- Cálculos ----------------------------------
  const my = (groupId, roleKey) => myScores.get(`${groupId}:${roleKey}`)?.score ?? null
  const myObj = (groupId, roleKey) => myScores.get(`${groupId}:${roleKey}`) ?? null

  const deliveryWeighted = (gId, subjectId) => {
    const e1 = my(gId, roleKeyDelivery(1, subjectId)) ?? 0
    const e2 = my(gId, roleKeyDelivery(2, subjectId)) ?? 0

    return round2(e1 * W_E1 + e2 * W_E2)
  }

  const deliveriesSumAllSubjects = gId => {
    const list = subjects
      .filter(
        s => !(SUBJECTS_TO_SKIP({ course: s.course, semester: s.semester, name: s.name }) || s.has_delivery === false)
      )
      .filter(s => (isAdmin && showAll) || mySubjects.has(String(s.id)))
      .map(s => deliveryWeighted(gId, s.id))

    return round2(list.reduce((a, b) => a + b, 0))
  }

  // ---------------------------------- UPSERTS ----------------------------------
  // Grupo → evaluations (nota + comentário)
  const upsertEvaluation = async ({ groupId, roleKey, value, text }) => {
    const k = `${groupId}:${roleKey}`
    const existing = myObj(groupId, roleKey)
    const payload = { score: round2(clamp10(value)), comment: norm(text || '') }

    if (existing?.id) {
      const { error } = await supabase.from('evaluations').update(payload).eq('id', existing.id)

      if (error) throw error
      const next = new Map(myScores)

      next.set(k, { ...existing, ...payload })
      setMyScores(next)
    } else {
      const { data, error } = await supabase
        .from('evaluations')
        .insert({ group_id: groupId, evaluator_id: user.id, evaluator_role: roleKey, ...payload })
        .select('id')
        .single()

      if (error) throw error
      const next = new Map(myScores)

      next.set(k, { id: data.id, ...payload })
      setMyScores(next)
    }
  }

  // Individual → students_evaluation (nota + comentário)
  const upsertStudentEvaluation = async ({ groupId, studentId, roleKey, value, text }) => {
    const payload = {
      group_id: groupId, // geralmente number
      student_id: String(studentId), // 👈 coerção para string (UUID/text)
      role_key: String(roleKey), // 👈 sempre string para bater com o leitor
      score: round2(clamp10(value)),
      comment: norm(text || ''),
      evaluator_id: user.id // caso sua tabela não tenha essa coluna, remova
    }

    try {
      // caminho seguro para quem não tem constraint unique
      const { data: existing, error: selErr } = await supabase
        .from('students_evaluation')
        .select('id')
        .eq('group_id', groupId)
        .eq('student_id', String(studentId))
        .eq('role_key', String(roleKey))
        .maybeSingle()

      if (selErr) throw selErr

      if (existing?.id) {
        const { error } = await supabase.from('students_evaluation').update(payload).eq('id', existing.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from('students_evaluation').insert(payload)

        if (error) throw error
      }
    } catch {
      // se houver unique (group_id,student_id,role_key) isso funciona
      const { error } = await supabase.from('students_evaluation').upsert(payload)

      if (error) throw error
    }
  }

  // ---------------------------------- Resolver CHAVE do aluno (igual tela do aluno) ----------------------------------
  const resolveStudentKey = async member => {
    if (member?.student_user_id) return member.student_user_id
    if (member?.student_id) return member.student_id
    const email = (member?.email || '').toLowerCase().trim()

    if (!email) return null
    const { data } = await supabase.from('students').select('id, user_id, email').ilike('email', email).maybeSingle()

    return data?.user_id || data?.id || null
  }

  // ---------------------------------- UI Helpers ----------------------------------
  const ScoreChip = ({ value }) => {
    if (value == null) {
      return <Chip size='small' variant='outlined' icon={<DoNotDisturbIcon fontSize='small' />} label='Sem nota' />
    }

    const col = value < 6 ? 'error' : value < 8 ? 'warning' : 'success'
    const icon = col === 'success' ? <StarRoundedIcon fontSize='small' /> : <FiberManualRecordIcon fontSize='small' />

    return (
      <Chip
        size='small'
        color={col}
        variant={col === 'success' ? 'filled' : 'outlined'}
        icon={icon}
        label={formatBR(value)}
      />
    )
  }

  const NumberField = ({ value, onChange, step = 0.1 }) => {
    const inc = () => onChange(clamp10(round2(Number(value ?? 0) + step)))
    const dec = () => onChange(clamp10(round2(Number(value ?? 0) - step)))

    const onType = e => {
      const raw = (e.target.value ?? '').toString().replace(',', '.')
      const parsed = Number(raw)

      onChange(Number.isNaN(parsed) ? 0 : parsed)
    }

    return (
      <TextField
        fullWidth
        size='small'
        type='number'
        inputMode='decimal'
        label='Nota (0–10)'
        helperText='Aceita decimais com vírgula (ex.: 9,5)'
        value={value}
        onChange={onType}
        onBlur={() => onChange(clamp10(round2(Number(value ?? 0))))}
        InputProps={{
          startAdornment: (
            <InputAdornment position='start'>
              <IconButton size='small' onClick={dec}>
                <RemoveIcon fontSize='small' />
              </IconButton>
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position='end'>
              <Typography variant='caption' sx={{ mr: 1 }}>
                /10
              </Typography>
              <IconButton size='small' onClick={inc}>
                <AddIcon fontSize='small' />
              </IconButton>
            </InputAdornment>
          )
        }}
        sx={{ maxWidth: 260 }}
      />
    )
  }

  const DecimalFieldBR = ({ value, onChange, label = 'Nota', width = 140 }) => {
    const handleType = e => {
      const raw = (e.target.value ?? '').toString().replace(',', '.')
      const parsed = Number(raw)
      const val = Number.isNaN(parsed) ? '' : parsed

      onChange(val === '' ? '' : clamp10(round2(val)))
    }

    const handleBlur = () => {
      const v = value === '' ? '' : Number(value ?? 0)

      onChange(v === '' ? '' : clamp10(round2(v)))
    }

    return (
      <TextField
        size='small'
        type='number'
        inputMode='decimal'
        label={label}
        value={value === '' ? '' : String(value)}
        onChange={handleType}
        onBlur={handleBlur}
        placeholder='em branco = usa nota do grupo'
        InputProps={{ inputProps: { step: 0.1, min: 0, max: 10 } }}
        sx={{ maxWidth: width }}
      />
    )
  }

  // ---------------------------------- Diálogo ----------------------------------
  const openDeliveryDialog = async (group, subject, deliveryNo) => {
    setDlgMode('delivery')
    const prev = myObj(group.id, roleKeyDelivery(deliveryNo, subject.id))

    setTarget({ group, subject, deliveryNo, members: group.members || [] })
    setScore(prev?.score ?? 0)
    setComment(prev?.comment ?? '')
    setCommentTouched(false)

    // resolve CHAVE (user_id |> students.id)
    const resolvedMembers = []

    for (const m of group.members || []) {
      const sk = await resolveStudentKey(m)

      resolvedMembers.push({ ...m, student_key: sk })
    }

    // iniciam vazios (não grava nada por padrão)
    setIndiv(resolvedMembers.map(m => ({ student: m, value: '', changed: false })))
    setCopyToAll(false)
    setDlgOpen(true)
  }

  const openPresentationDialog = async group => {
    setDlgMode('presentation')
    const initial = {}

    PRESENT_CRITERIA.forEach(c => {
      initial[c.key] = my(group.id, roleKeyPresentationCriterion(c.key)) ?? 0
    })

    const resolvedMembers = []

    for (const m of group.members || []) {
      const sk = await resolveStudentKey(m)

      resolvedMembers.push({ ...m, student_key: sk })
    }

    setTarget({ group, members: resolvedMembers })
    setPresentValues(initial)
    setScore(0)
    setComment('')
    setCommentTouched(false)
    setIndiv(resolvedMembers.map(m => ({ student: m, value: '', changed: false })))
    setCopyToAll(false)
    setDlgOpen(true)
  }

  const handleSaveDialog = async () => {
    try {
      if (!user || !target?.group) return

      if (!isAdmin && mySubjects.size === 0) {
        setSnack({ open: true, msg: 'Sem permissão para lançar notas nesta turma.', sev: 'warning' })

        return
      }

      if (!commentIsValid) {
        setCommentTouched(true)
        setSnack({ open: true, msg: 'Comentário obrigatório.', sev: 'warning' })

        return
      }

      if (dlgMode === 'delivery') {
        const { group, subject, deliveryNo } = target

        if (!(isAdmin && showAll) && !mySubjects.has(String(subject.id))) {
          setSnack({ open: true, msg: 'Você não possui essa disciplina atribuída.', sev: 'warning' })

          return
        }

        if (!scoreIsValid) {
          setSnack({ open: true, msg: 'Nota inválida (0–10).', sev: 'warning' })

          return
        }

        // 1) Grupo → evaluations (nota + feedback)
        await upsertEvaluation({
          groupId: group.id,
          roleKey: roleKeyDelivery(deliveryNo, String(subject.id)),
          value: score,
          text: comment
        })

        // 2) Individuais → students_evaluation (nota + feedback)
        const toSave = []

        // se o prof não preencheu individuais e não marcou copiar, gravamos a do grupo p/ todos (opcional)
        if (copyToAll || (indiv && indiv.every(x => x.value === '' || x.changed === false))) {
          for (const it of indiv) {
            const sid = it.student?.student_key

            if (!sid) continue
            toSave.push({ sid: String(sid), val: score })
          }
        } else {
          for (const it of indiv) {
            const sid = it.student?.student_key

            if (!sid) continue

            if (it.changed && it.value !== '' && Number.isFinite(Number(it.value))) {
              toSave.push({ sid: String(sid), val: Number(it.value) })
            }
          }
        }

        for (const item of toSave) {
          await upsertStudentEvaluation({
            groupId: group.id,
            studentId: String(item.sid),
            roleKey: roleKeyDeliveryStudent(deliveryNo, String(subject.id), String(item.sid)),
            value: item.val,
            text: `(individual) ${comment}`
          })
        }

        setSnack({ open: true, msg: 'Entrega salva!', sev: 'success' })
      } else {
        const { group } = target

        // Grupo - critérios apresentação (nota + feedback)
        for (const c of PRESENT_CRITERIA) {
          const key = roleKeyPresentationCriterion(c.key)
          const val = Number(presentValues[c.key] ?? 0)

          await upsertEvaluation({ groupId: group.id, roleKey: key, value: val, text: comment })
        }

        // Individuais (apresentação final) → students_evaluation (nota + feedback)
        const toSave = []

        if (copyToAll || (indiv && indiv.every(x => x.value === '' || x.changed === false))) {
          for (const it of indiv) {
            const sid = it.student?.student_key

            if (!sid) continue
            toSave.push({ sid: String(sid), val: Number(score || 0) })
          }
        } else {
          for (const it of indiv) {
            const sid = it.student?.student_key

            if (!sid) continue

            if (it.changed && it.value !== '' && Number.isFinite(Number(it.value))) {
              toSave.push({ sid: String(sid), val: Number(it.value) })
            }
          }
        }

        for (const item of toSave) {
          await upsertStudentEvaluation({
            groupId: group.id,
            studentId: String(item.sid),
            roleKey: roleKeyPresentationFinalStudent(String(item.sid)),
            value: item.val,
            text: `(individual apresentação) ${comment}`
          })
        }

        setSnack({ open: true, msg: 'Apresentação salva!', sev: 'success' })
      }

      setDlgOpen(false)
    } catch (e) {
      console.error(e)
      setSnack({
        open: true,
        msg: `Erro ao salvar: ${e?.message || e || 'desconhecido'}`,
        sev: 'error'
      })
    }
  }

  // ---------------------------------- Card de Disciplina ----------------------------------
  const SubjectCard = ({ group, subject }) => {
    const e1 = my(group.id, roleKeyDelivery(1, subject.id))
    const e2 = my(group.id, roleKeyDelivery(2, subject.id))
    const sum = deliveryWeighted(group.id, subject.id)

    return (
      <Card variant='outlined'>
        <CardHeader
          title={
            <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap'>
              <Typography variant='subtitle1' fontWeight={800}>
                {subject.name}
              </Typography>
              <Chip size='small' variant='outlined' label={`E1×${formatBR(W_E1)} • E2×${formatBR(W_E2)}`} />
            </Stack>
          }
        />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Stack
                spacing={1}
                sx={{ p: 1.25, border: theme => `1px solid ${theme.palette.divider}`, borderRadius: 2 }}
              >
                <Typography variant='subtitle2'>1ª Entrega</Typography>
                <Stack direction='row' spacing={1} alignItems='center'>
                  <ScoreChip value={e1} />
                  <Button variant='contained' size='small' onClick={() => openDeliveryDialog(group, subject, 1)}>
                    Avaliar
                  </Button>
                </Stack>
              </Stack>
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack
                spacing={1}
                sx={{ p: 1.25, border: theme => `1px solid ${theme.palette.divider}`, borderRadius: 2 }}
              >
                <Typography variant='subtitle2'>2ª Entrega</Typography>
                <Stack direction='row' spacing={1} alignItems='center'>
                  <ScoreChip value={e2} />
                  <Button variant='contained' size='small' onClick={() => openDeliveryDialog(group, subject, 2)}>
                    Avaliar
                  </Button>
                </Stack>
              </Stack>
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack
                spacing={1}
                sx={{ p: 1.25, border: theme => `1px solid ${theme.palette.divider}`, borderRadius: 2 }}
              >
                <Typography variant='subtitle2'>Soma (E1+E2)</Typography>
                <Chip size='small' color='primary' label={formatBR(sum)} />
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    )
  }

  // ---------------------------------- Corpo ----------------------------------
  const body = loading ? (
    <Grid container spacing={3}>
      {[...Array(3)].map((_, i) => (
        <Grid key={i} item xs={12}>
          <Skeleton variant='rounded' height={140} />
        </Grid>
      ))}
    </Grid>
  ) : filteredGroups.length === 0 ? (
    <Alert severity='info'>Nenhum grupo encontrado.</Alert>
  ) : (
    <Grid container spacing={3}>
      {filteredGroups.map(g => {
        const selectedClass = classes.find(c => String(c.id) === String(classId))

        const periodo =
          g.semester != null
            ? `${g.semester}º`
            : (g.class?.semester ?? selectedClass?.semester ?? selectedClass?.semester_int_fallback ?? '—') + 'º'

        const turma = g.class?.name
          ? `Turma: ${g.class.name}`
          : selectedClass?.name
            ? `Turma: ${selectedClass.name}`
            : ''

        const course =
          g.class?.course ??
          selectedClass?.course ??
          inferCourseFromClassName(g.class?.name || selectedClass?.name || '')

        const semesterForFilter =
          g.semester ?? g.class?.semester ?? selectedClass?.semester ?? selectedClass?.semester_int_fallback

        const subjectsThisClass = subjects.filter(
          s => s.course === course && Number(s.semester) === Number(semesterForFilter)
        )

        return (
          <Grid key={g.id} item xs={12}>
            <Card>
              <CardHeader
                title={
                  <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap'>
                    <Typography variant='h6' fontWeight={800}>
                      {g.name}
                    </Typography>
                    {g.code ? <Chip size='small' label={`Código: ${g.code}`} /> : null}
                    {turma ? <Chip size='small' variant='outlined' label={turma} /> : null}
                    <Chip size='small' variant='outlined' label={`Período: ${periodo}`} />
                    <Chip
                      size='small'
                      icon={<GroupIcon fontSize='small' />}
                      label={`${g.members?.length || 0} integrante(s)`}
                    />
                    {g.github_url ? (
                      <div style={{ marginTop: 8 }}>
                        <a
                          href={g.github_url}
                          onClick={e => e.stopPropagation()}
                          target='_blank'
                          rel='noopener noreferrer'
                        >
                          <Button size='small' variant='outlined' startIcon={<i className='ri-github-line' />}>
                            GitHub do grupo
                          </Button>
                        </a>
                      </div>
                    ) : null}
                    <Box sx={{ flexGrow: 1 }} />
                    {course?.toUpperCase() === 'ADS' && (
                      <Tooltip title='Abrir Documentação ADS'>
                        <Button
                          variant='outlined'
                          color='secondary'
                          startIcon={<LinkIcon />}
                          onClick={() =>
                            window.open(
                              'https://drive.google.com/drive/folders/13he-mMdee9sprO4KHVNHrDAfUFnvdzNp?usp=drive_link',
                              '_blank'
                            )
                          }
                          sx={{ mr: 1 }}
                        >
                          Documentação
                        </Button>
                      </Tooltip>
                    )}
                    {course?.toUpperCase() === 'CCOMP' && (
                      <Tooltip title='Abrir Documentação CCOMP'>
                        <Button
                          variant='outlined'
                          color='secondary'
                          startIcon={<LinkIcon />}
                          onClick={() =>
                            window.open(
                              'https://drive.google.com/drive/folders/14UzpldFR71wZqjtJ0MGEtlpM-TWbNnUY?usp=drive_link',
                              '_blank'
                            )
                          }
                          sx={{ mr: 1 }}
                        >
                          Documentação
                        </Button>
                      </Tooltip>
                    )}
                    <Button variant='contained' onClick={() => openPresentationDialog(g)}>
                      Avaliar Apresentação
                    </Button>
                  </Stack>
                }
                subheader={
                  isAdmin && showAll
                    ? 'VISUALIZAÇÃO COORDENADOR: todas as disciplinas desta turma.'
                    : 'Você está vendo apenas as suas disciplinas atribuídas nesta turma.'
                }
              />
              <CardContent>
                <Grid container spacing={2}>
                  {subjectsThisClass
                    .filter(s => (isAdmin && showAll) || mySubjects.has(String(s.id)))
                    .map(s => (
                      <Grid key={s.id} item xs={12}>
                        <SubjectCard group={g} subject={s} />
                      </Grid>
                    ))}
                  {subjectsThisClass.filter(s => (isAdmin && showAll) || mySubjects.has(String(s.id))).length === 0 && (
                    <Grid item xs={12}>
                      <Alert severity='info'>Nenhuma disciplina atribuída para você nesta turma.</Alert>
                    </Grid>
                  )}
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                    <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap'>
                      <Typography variant='subtitle1' fontWeight={800}>
                        Nota Final das Entregas (somente disciplinas visíveis)
                      </Typography>
                      <Chip size='small' color='primary' label={formatBR(deliveriesSumAllSubjects(g.id))} />
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )
      })}
    </Grid>
  )

  // ---------------------------------- Guard ----------------------------------
  if (!isAdmin && mySubjects.size === 0) {
    return (
      <Card>
        <CardHeader title='Acesso restrito' />
        <CardContent>
          <Alert severity='warning'>
            Esta área é restrita a professores/coordenadores. Contate o coordenador do PI para atribuir suas disciplinas
            ao seu usuário ({userEmail || '—'}).
          </Alert>
        </CardContent>
      </Card>
    )
  }

  // ---------------------------------- Render ----------------------------------
  return (
    <Box sx={{ pb: 4 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ mb: 3 }}
      >
        <Typography variant='h4' fontWeight={900}>
          Avaliações de PI
        </Typography>
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
            )
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
              {c.semester || c.semester_int_fallback ? ` — ${c.semester ?? c.semester_int_fallback}º` : ''}
              {c.course ? ` • ${c.course}` : ''}
            </MenuItem>
          ))}
          {classes.length === 0 && (
            <MenuItem disabled value=''>
              Nenhuma turma disponível para seu usuário.
            </MenuItem>
          )}
        </TextField>
        {isAdmin && (
          <Tooltip title='Coordenador: ao ligar, você enxerga todas as disciplinas da turma (ignora atribuições).'>
            <FormControlLabel
              control={<Switch checked={showAll} onChange={(_, v) => setShowAll(v)} />}
              label={
                <Stack direction='row' spacing={0.5} alignItems='center'>
                  <VisibilityIcon fontSize='small' /> Ver todas
                </Stack>
              }
              sx={{ ml: { md: 1 } }}
            />
          </Tooltip>
        )}
      </Stack>

      {body}

      {/* Diálogo */}
      <Dialog open={dlgOpen} onClose={() => setDlgOpen(false)} maxWidth='md' fullWidth>
        <DialogTitle>
          {dlgMode === 'delivery'
            ? `${target?.deliveryNo === 1 ? ROLE_LABEL.delivery_1 : ROLE_LABEL.delivery_2} — ${target?.subject?.name} — ${target?.group?.name}`
            : `Apresentação — ${target?.group?.name}`}
        </DialogTitle>

        <DialogContent dividers>
          {dlgMode === 'delivery' ? (
            <Stack spacing={2}>
              <Alert severity='info'>
                Lançando nota da <strong>{target?.deliveryNo === 1 ? '1ª' : '2ª'}</strong> entrega de{' '}
                <strong>{target?.subject?.name}</strong>.
              </Alert>

              <NumberField value={score} onChange={setScore} />

              <TextField
                label='Comentário'
                multiline
                minRows={3}
                fullWidth
                value={comment}
                onChange={e => setComment(e.target.value)}
                error={commentTouched && !commentIsValid}
                helperText={commentTouched && !commentIsValid ? 'Obrigatório.' : 'Feedback para o grupo.'}
              />

              <Divider />

              <Stack direction='row' alignItems='center' spacing={1}>
                <Checkbox checked={copyToAll} onChange={(_, v) => setCopyToAll(v)} />
                <Typography variant='body2'>
                  Copiar a nota do <b>grupo</b> para todos os integrantes (grava como <i>individual</i>).
                </Typography>
              </Stack>

              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Aluno</TableCell>
                    <TableCell width={180}>Nota individual</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(target?.members || []).map((m, idx) => {
                    const it = indiv[idx] || { value: '' }

                    return (
                      <TableRow key={m.student_key || m.student_id || m.email || m.full_name || idx}>
                        <TableCell>
                          <Typography variant='body2' fontWeight={600}>
                            {m.full_name || m.email || '(sem nome)'}
                          </Typography>
                          <Typography variant='caption' color='text.secondary'>
                            {m.email}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <DecimalFieldBR
                            value={copyToAll ? score : it.value}
                            onChange={v => {
                              setIndiv(prev => {
                                const next = [...prev]

                                next[idx] = { student: m, value: v, changed: true }

                                return next
                              })
                              if (copyToAll) setCopyToAll(false)
                            }}
                            label='Nota individual'
                            width={160}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {(!target?.members || target?.members?.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={2}>
                        <Alert severity='info'>Grupo sem integrantes cadastrados.</Alert>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Alert severity='info'>Lançando notas dos critérios de apresentação para o grupo.</Alert>

              {PRESENT_CRITERIA.map(c => (
                <Box key={c.key} sx={{ px: 1 }}>
                  <Typography variant='subtitle2' sx={{ mb: 0.5 }}>
                    {c.label}
                  </Typography>
                  <Slider
                    value={Number(presentValues[c.key] ?? 0)}
                    onChange={(_, v) => setPresentValues(s => ({ ...s, [c.key]: clamp10(v) }))}
                    valueLabelDisplay='auto'
                    step={1}
                    marks={marks}
                    min={0}
                    max={10}
                  />
                </Box>
              ))}

              <TextField
                label='Comentário geral da apresentação'
                multiline
                minRows={3}
                fullWidth
                value={comment}
                onChange={e => setComment(e.target.value)}
                error={commentTouched && !commentIsValid}
                helperText={commentTouched && !commentIsValid ? 'Obrigatório.' : 'Feedback para a apresentação.'}
              />

              <Divider />

              <Stack direction='row' alignItems='center' spacing={1}>
                <Checkbox checked={copyToAll} onChange={(_, v) => setCopyToAll(v)} />
                <Typography variant='body2'>
                  Definir a mesma nota final para todos (grava como <i>individual</i>).
                </Typography>
              </Stack>

              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Aluno</TableCell>
                    <TableCell width={220}>Nota final (apresentação)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(target?.members || []).map((m, idx) => {
                    const it = indiv[idx] || { value: '' }

                    return (
                      <TableRow key={m.student_key || m.student_id || m.email || m.full_name || idx}>
                        <TableCell>
                          <Typography variant='body2' fontWeight={600}>
                            {m.full_name || m.email || '(sem nome)'}
                          </Typography>
                          <Typography variant='caption' color='text.secondary'>
                            {m.email}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <DecimalFieldBR
                            value={copyToAll ? Number(score) : it.value === '' ? '' : Number(it.value)}
                            onChange={v => {
                              setIndiv(prev => {
                                const next = [...prev]

                                next[idx] = { student: m, value: clamp10(v), changed: true }

                                return next
                              })
                              if (copyToAll) setCopyToAll(false)
                            }}
                            label='Nota final'
                            width={160}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {(!target?.members || target?.members?.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={2}>
                        <Alert severity='info'>Grupo sem integrantes cadastrados.</Alert>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Stack>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDlgOpen(false)}>Cancelar</Button>
          <Button
            variant='contained'
            onClick={async () => {
              await handleSaveDialog()
            }}
            disabled={!commentIsValid || (dlgMode === 'delivery' && !scoreIsValid)}
            sx={{ px: 3, fontWeight: 800 }}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert onClose={() => setSnack(s => ({ ...s, open: false }))} severity={snack.sev} sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}
