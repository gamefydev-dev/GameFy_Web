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
  Chip,
  Alert,
  Skeleton,
  Divider,
  Tooltip,
  TextField,
  InputAdornment,
  IconButton,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  LinearProgress
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import GroupIcon from '@mui/icons-material/Groups2'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import InfoIcon from '@mui/icons-material/InfoOutlined'
import PersonIcon from '@mui/icons-material/Person'
import GroupsIcon from '@mui/icons-material/Groups'
import LinkIcon from '@mui/icons-material/Link'

import { supabase } from '@/libs/supabaseAuth'

// ---------------------------------- Utils ----------------------------------
const clamp10 = n => Math.min(10, Math.max(0, Number.isFinite(n) ? n : 0))
const round2 = n => Number((Math.round(n * 100) / 100).toFixed(2))
const norm = v => (v ?? '').toString().trim()

const formatBR = n =>
  n == null || Number.isNaN(n)
    ? ''
    : n.toLocaleString('pt-BR', { minimumFractionDigits: n % 1 ? 1 : 0, maximumFractionDigits: 2 })

const W_E1 = 0.06
const W_E2 = 0.08

const roleKeyDelivery = (deliveryNo, subjectId) => `delivery_${deliveryNo}:subject_${subjectId}`

const roleKeyDeliveryStudent = (deliveryNo, subjectId, studentId) =>
  `delivery_${deliveryNo}:subject_${subjectId}:student_${studentId}`

const roleKeyPresentationCriterion = crit => `presentation:${crit}`
const roleKeyPresentationFinalStudent = studentId => `presentation:final:student_${studentId}`

const PRESENT_CRITERIA = [
  { key: 'creativity', label: 'Criatividade' },
  { key: 'impact', label: 'Impacto' },
  { key: 'embasement', label: 'Embasamento' },
  { key: 'organization', label: 'Organização' }
]

const inferCourseFromClassName = (name = '') => {
  const n = name.toLowerCase()

  if (n.includes('ads')) return 'ADS'

  return 'CCOMP'
}

const getGroupGithubUrl = group => {
  const n = v => (v || '').trim()
  const fromGroup = n(group?.github_url)

  if (fromGroup) return fromGroup
  const firstMember = (group?.members || []).find(m => n(m.github))

  return n(firstMember?.github)
}

// ---------------------------------- Page ----------------------------------
export default function PageAlunoNotas() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [studentId, setStudentId] = useState(null)
  const [studentName, setStudentName] = useState(null)
  const [group, setGroup] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [search, setSearch] = useState('')

  // notas por papel
  const [groupAvgByRole, setGroupAvgByRole] = useState(new Map()) // média do grupo (evaluations)
  const [myByRole, setMyByRole] = useState(new Map()) // minha nota individual (students_evaluation)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data: u } = await supabase.auth.getUser()
      const authUser = u?.user || null

      setUser(authUser)

      // Resolve aluno e grupo (por user_id ou email)
      let sId = authUser?.id || null
      let sName = null

      try {
        const { data: srow } = await supabase
          .from('students')
          .select('id, full_name, email, user_id')
          .or(`user_id.eq.${authUser?.id},email.ilike.${authUser?.email || ''}`)
          .maybeSingle()

        if (srow) {
          sId = srow.user_id || srow.id || sId
          sName = srow.full_name || sName
        }
      } catch {}

      // Encontra group_id
      let gid = null

      const tryTables = [
        { table: 'pi_group_members', fields: 'group_id, full_name, email, github, student_user_id' },
        { table: 'group_members', fields: 'group_id, full_name, email, github, student_id, student_user_id' }
      ]

      for (const t of tryTables) {
        const { data, error } = await supabase
          .from(t.table)
          .select(t.fields)
          .or(`student_user_id.eq.${authUser?.id},email.ilike.${authUser?.email || ''}`)
          .limit(1)
          .maybeSingle()

        if (!error && data?.group_id) {
          gid = data.group_id
          break
        }
      }

      if (!gid) {
        setLoading(false)

        return
      }

      // Grupo + membros
      const { data: gs } = await supabase
        .from('pi_groups')
        .select('id, name, code, semester, github_url, class_id, class:classes(name, course, semester)')
        .eq('id', gid)
        .maybeSingle()

      let members = []

      for (const t of tryTables) {
        const { data, error } = await supabase.from(t.table).select(t.fields).eq('group_id', gid)

        if (!error && data) {
          members = data.map(r => ({
            student_id: r.student_user_id || r.student_id || null,
            full_name: r.full_name || null,
            email: (r.email || '').toLowerCase() || null,
            github: r.github || null
          }))
          break
        }
      }

      const grp = { ...gs, members }

      setGroup(grp)
      setStudentId(sId)
      const me = members.find(m => m.student_id === sId || m.email === (authUser?.email || '').toLowerCase())

      setStudentName(me?.full_name || sName || authUser?.email || 'Aluno')

      // Disciplinas da turma
      const course = gs?.class?.course ?? inferCourseFromClassName(gs?.class?.name || '')
      const semester = gs?.class?.semester ?? gs?.semester ?? null
      let subj = []

      try {
        let q = supabase.from('subjects').select('id, name, course, semester, has_delivery')

        if (course) q = q.eq('course', course)
        if (semester != null) q = q.eq('semester', semester)
        const { data: sdata } = await q.order('name', { ascending: true })

        subj = (sdata || []).filter(s => s.has_delivery !== false)
      } catch {}

      setSubjects(subj)

      // ------------------ Notas do GRUPO (média) ------------------
      const roleKeys = []

      subj.forEach(s => {
        roleKeys.push(roleKeyDelivery(1, s.id))
        roleKeys.push(roleKeyDelivery(2, s.id))
      })
      PRESENT_CRITERIA.forEach(c => roleKeys.push(roleKeyPresentationCriterion(c.key)))

      const { data: evs } = await supabase
        .from('evaluations')
        .select('group_id, evaluator_role, score')
        .eq('group_id', gid)
        .in('evaluator_role', roleKeys)

      const gmap = new Map()

      ;(evs || []).forEach(r => {
        const list = gmap.get(r.evaluator_role) || []

        list.push(Number(r.score || 0))
        gmap.set(r.evaluator_role, list)
      })
      const gByRole = new Map()

      gmap.forEach((arr, k) => {
        if (!arr.length) return
        const avg = arr.reduce((a, b) => a + Number(b || 0), 0) / arr.length

        gByRole.set(k, round2(avg))
      })
      setGroupAvgByRole(gByRole)

      // ------------------ Notas INDIVIDUAIS (student) ------------------
      const keysIndiv = []

      subj.forEach(s => {
        keysIndiv.push(roleKeyDeliveryStudent(1, s.id, sId))
        keysIndiv.push(roleKeyDeliveryStudent(2, s.id, sId))
      })
      keysIndiv.push(roleKeyPresentationFinalStudent(sId))

      // Fonte 1: students_evaluation (preferida)
      const { data: se1 } = await supabase
        .from('students_evaluation')
        .select('role_key, score')
        .eq('group_id', gid)
        .eq('student_id', sId)
        .in('role_key', keysIndiv)

      const indiv = new Map()

      ;(se1 || []).forEach(r => indiv.set(r.role_key, Number(r.score || 0)))

      // Fonte 2 (fallback): evaluations com evaluator_role específico do aluno
      const { data: se2 } = await supabase
        .from('evaluations')
        .select('evaluator_role, score')
        .eq('group_id', gid)
        .in('evaluator_role', keysIndiv)

      ;(se2 || []).forEach(r => indiv.set(r.evaluator_role, Number(r.score || 0)))

      setMyByRole(indiv)

      setLoading(false)
    })()
  }, [])

  // Helpers de leitura
  const groupScore = (roleKey, fb = null) => (groupAvgByRole.has(roleKey) ? groupAvgByRole.get(roleKey) : fb)
  const myScore = (roleKey, fb = null) => (myByRole.has(roleKey) ? myByRole.get(roleKey) : fb)

  const rows = useMemo(() => {
    if (!group || !subjects.length) return []
    const data = []

    subjects.forEach(s => {
      const e1G = groupScore(roleKeyDelivery(1, s.id), null)
      const e2G = groupScore(roleKeyDelivery(2, s.id), null)
      const e1I = myScore(roleKeyDeliveryStudent(1, s.id, studentId), null)
      const e2I = myScore(roleKeyDeliveryStudent(2, s.id, studentId), null)

      // valor que conta (individual > grupo)
      const e1Val = e1I != null ? e1I : e1G
      const e2Val = e2I != null ? e2I : e2G

      const weighted = round2(Number(e1Val || 0) * W_E1 + Number(e2Val || 0) * W_E2)

      data.push({
        subject: s.name,
        e1G,
        e1I,
        e1Val,
        e2G,
        e2I,
        e2Val,
        weighted
      })
    })

    // apresentação
    const crit = PRESENT_CRITERIA.map(c => ({ key: c.key, label: c.label }))
    const critGroup = crit.map(c => ({ ...c, value: groupScore(roleKeyPresentationCriterion(c.key), null) }))

    const presentGroupAvg = critGroup.length
      ? round2(critGroup.reduce((a, c) => a + Number(c.value || 0), 0) / critGroup.length)
      : null

    const presentIndiv = myScore(roleKeyPresentationFinalStudent(studentId), null)
    const presentVal = presentIndiv != null ? presentIndiv : presentGroupAvg

    data.push({
      subject: 'Apresentação',
      presentation: { critGroup, presentGroupAvg, presentIndiv, presentVal }
    })

    return data
  }, [group, subjects, groupAvgByRole, myByRole, studentId])

  const deliveriesSum = useMemo(() => {
    const onlySubjects = rows.filter(r => r.subject !== 'Apresentação')

    return round2(onlySubjects.reduce((acc, r) => acc + Number(r.weighted || 0), 0))
  }, [rows])

  // ---------------------------------- UI ----------------------------------
  const header = loading ? (
    <Skeleton variant='rounded' height={120} />
  ) : !group ? (
    <Alert severity='warning'>Não encontramos seu grupo. Verifique com o coordenador.</Alert>
  ) : (
    <Card variant='outlined'>
      <CardHeader
        title={
          <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap'>
            <Typography variant='h6' fontWeight={900}>
              Minhas notas • {studentName || 'Aluno'}
            </Typography>
            {group?.name ? <Chip size='small' label={`Grupo: ${group.name}`} /> : null}
            {group?.code ? <Chip size='small' variant='outlined' label={`Código: ${group.code}`} /> : null}
            {group?.class?.name ? <Chip size='small' variant='outlined' label={`Turma: ${group.class.name}`} /> : null}
            <Chip
              size='small'
              icon={<GroupIcon fontSize='small' />}
              label={`${group?.members?.length || 0} integrante(s)`}
            />
            {getGroupGithubUrl(group) ? (
              <>
                <Tooltip title='Abrir repositório'>
                  <IconButton
                    size='small'
                    color='primary'
                    onClick={() => {
                      const url = getGroupGithubUrl(group)

                      if (url) window.open(url.startsWith('http') ? url : `https://${url}`, '_blank')
                    }}
                  >
                    <OpenInNewIcon fontSize='small' />
                  </IconButton>
                </Tooltip>
                <Tooltip title='Copiar link do repositório'>
                  <IconButton
                    size='small'
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(getGroupGithubUrl(group))
                      } catch {}
                    }}
                  >
                    <ContentCopyIcon fontSize='small' />
                  </IconButton>
                </Tooltip>
              </>
            ) : null}
          </Stack>
        }
        subheader={
          <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap'>
            <InfoIcon fontSize='small' />
            <Typography variant='body2'>
              Quando existir nota <strong>individual</strong>, ela prevalece sobre a nota do <strong>grupo</strong>.
            </Typography>
          </Stack>
        }
      />
    </Card>
  )

  const body = loading ? (
    <Box>
      <LinearProgress sx={{ mb: 2 }} />
      <Grid container spacing={2}>
        {[...Array(3)].map((_, i) => (
          <Grid key={i} item xs={12}>
            <Skeleton variant='rounded' height={120} />
          </Grid>
        ))}
      </Grid>
    </Box>
  ) : !group ? null : (
    <Grid container spacing={2}>
      {rows.map((r, idx) => (
        <Grid key={idx} item xs={12} md={6}>
          <Card variant='outlined'>
            <CardHeader
              title={
                <Typography variant='subtitle1' fontWeight={800}>
                  {r.subject}
                </Typography>
              }
            />
            <CardContent>
              {r.subject === 'Apresentação' ? (
                <Stack spacing={1.5}>
                  <Stack direction='row' spacing={1} alignItems='center'>
                    <Typography variant='body2'>Nota final que vale:</Typography>
                    <Chip size='small' color='primary' label={formatBR(r.presentation.presentVal)} />
                    {r.presentation.presentIndiv != null ? (
                      <Chip
                        size='small'
                        icon={<PersonIcon fontSize='small' />}
                        label={`Individual: ${formatBR(r.presentation.presentIndiv)}`}
                      />
                    ) : (
                      <Chip
                        size='small'
                        variant='outlined'
                        icon={<GroupsIcon fontSize='small' />}
                        label={`Grupo: ${formatBR(r.presentation.presentGroupAvg)}`}
                      />
                    )}
                  </Stack>
                  <Divider />
                  <Stack spacing={0.5}>
                    {r.presentation.critGroup.map(c => (
                      <Stack key={c.key} direction='row' justifyContent='space-between'>
                        <Typography variant='body2'>{c.label}</Typography>
                        <Typography variant='body2' fontWeight={700}>
                          {formatBR(c.value)}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              ) : (
                <Grid container spacing={1.5}>
                  <Grid item xs={12}>
                    <Stack spacing={1}>
                      {/* E1 */}
                      <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap'>
                        <Typography variant='body2'>1ª Entrega (peso {formatBR(W_E1)}):</Typography>
                        <Chip size='small' color='primary' label={formatBR(r.e1Val)} />
                        {r.e1I != null ? (
                          <Chip
                            size='small'
                            icon={<PersonIcon fontSize='small' />}
                            label={`Individual: ${formatBR(r.e1I)}`}
                          />
                        ) : (
                          <Chip
                            size='small'
                            variant='outlined'
                            icon={<GroupsIcon fontSize='small' />}
                            label={`Grupo: ${formatBR(r.e1G)}`}
                          />
                        )}
                      </Stack>
                      {/* E2 */}
                      <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap'>
                        <Typography variant='body2'>2ª Entrega (peso {formatBR(W_E2)}):</Typography>
                        <Chip size='small' color='primary' label={formatBR(r.e2Val)} />
                        {r.e2I != null ? (
                          <Chip
                            size='small'
                            icon={<PersonIcon fontSize='small' />}
                            label={`Individual: ${formatBR(r.e2I)}`}
                          />
                        ) : (
                          <Chip
                            size='small'
                            variant='outlined'
                            icon={<GroupsIcon fontSize='small' />}
                            label={`Grupo: ${formatBR(r.e2G)}`}
                          />
                        )}
                      </Stack>
                    </Stack>
                  </Grid>
                  <Grid item xs={12}>
                    <Divider />
                  </Grid>
                  <Grid item xs={12}>
                    <Stack direction='row' spacing={1} alignItems='center'>
                      <Typography variant='caption'>
                        Soma ponderada que vale (E1×{formatBR(W_E1)} + E2×{formatBR(W_E2)})
                      </Typography>
                      <Chip size='small' color='primary' label={formatBR(r.weighted)} />
                    </Stack>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      ))}

      <Grid item xs={12}>
        <Card variant='outlined'>
          <CardHeader title='Resumo das Entregas (soma ponderada de todas as disciplinas)' />
          <CardContent>
            <Stack direction='row' spacing={1} alignItems='center'>
              <Chip color='primary' label={formatBR(deliveriesSum)} />
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card variant='outlined'>
          <CardHeader title='Quadro detalhado' />
          <CardContent>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Disciplina</TableCell>
                  <TableCell align='right'>E1 (grupo)</TableCell>
                  <TableCell align='right'>E1 (individual)</TableCell>
                  <TableCell align='right'>E1 que vale</TableCell>
                  <TableCell align='right'>E2 (grupo)</TableCell>
                  <TableCell align='right'>E2 (individual)</TableCell>
                  <TableCell align='right'>E2 que vale</TableCell>
                  <TableCell align='right'>Soma ponderada</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows
                  .filter(r => r.subject !== 'Apresentação')
                  .map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.subject}</TableCell>
                      <TableCell align='right'>{formatBR(r.e1G)}</TableCell>
                      <TableCell align='right'>{formatBR(r.e1I)}</TableCell>
                      <TableCell align='right'>
                        <strong>{formatBR(r.e1Val)}</strong>
                      </TableCell>
                      <TableCell align='right'>{formatBR(r.e2G)}</TableCell>
                      <TableCell align='right'>{formatBR(r.e2I)}</TableCell>
                      <TableCell align='right'>
                        <strong>{formatBR(r.e2Val)}</strong>
                      </TableCell>
                      <TableCell align='right'>
                        <Chip size='small' color='primary' label={formatBR(r.weighted)} />
                      </TableCell>
                    </TableRow>
                  ))}
                <TableRow>
                  <TableCell colSpan={7}>
                    <strong>Total entregas</strong>
                  </TableCell>
                  <TableCell align='right'>
                    <Chip size='small' color='primary' label={formatBR(deliveriesSum)} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Apresentação</strong>
                  </TableCell>
                  <TableCell colSpan={6}></TableCell>
                  <TableCell align='right'>
                    <strong>
                      {formatBR(rows.find(r => r.subject === 'Apresentação')?.presentation?.presentVal ?? 0)}
                    </strong>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )

  return (
    <Box sx={{ pb: 4 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ mb: 2 }}
      >
        <Typography variant='h4' fontWeight={900}>
          Minhas Notas
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <TextField
          size='small'
          placeholder='Filtrar por disciplina...'
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ minWidth: { xs: '100%', md: 300 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position='start'>
                <SearchIcon fontSize='small' />
              </InputAdornment>
            )
          }}
        />
      </Stack>

      {header}
      <Box sx={{ mt: 2 }}>{body}</Box>
    </Box>
  )
}
