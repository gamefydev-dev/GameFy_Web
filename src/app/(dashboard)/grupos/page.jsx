'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

// MUI
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Grid,
  Button,
  Alert,
  LinearProgress,
  Stack,
  Tooltip,
  MenuItem,
  TextField as MUITextField,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog as MuiDialog
} from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'

// QR Code
import { QRCodeSVG } from 'qrcode.react'

// Dialogs
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Snackbar from '@mui/material/Snackbar'

// Supabase
import { supabase } from '@/libs/supabaseAuth'

// ===================================================================
// Helpers
// ===================================================================

const FIXED_CLASS_NAMES = ['CCOMP', 'CCOMP_MATUTINO', 'ADS']

const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase()
const groupKey = g => String(g.id ?? g.group_name ?? g.code ?? '')
const norm = v => (v ?? '').toString().trim()

// Normalizador robusto para "members"
const toMemberArray = val => {
  if (Array.isArray(val)) return val
  if (val == null) return []

  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)

      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  if (typeof val === 'object') {
    const arr = []

    Object.keys(val).forEach(k => {
      const v = val[k]

      if (v && (v.full_name || v.email || v.github)) arr.push(v)
    })

    return arr
  }

  return []
}

// ----- helpers de detecção/parse de semestre & turma
const parseSemesterInt = (semText, fallbackFromClassText) => {
  const t = String(semText || '').toLowerCase()
  const m = t.match(/(\d{1,2})/)

  if (m) {
    const n = Number(m[1])

    if (n >= 1 && n <= 12) return n
  }

  const c = String(fallbackFromClassText || '').toLowerCase()
  const m2 = c.match(/(\d{1,2})/)

  if (m2) {
    const n2 = Number(m2[1])

    if (n2 >= 1 && n2 <= 12) return n2
  }

  return null
}

const detectNormalizedClassName = ({ turmaText, cursoText }) => {
  const a = (turmaText || '').toLowerCase()
  const b = (cursoText || '').toLowerCase()
  const t = `${a} ${b}`

  const isADS =
    /\bads\b/.test(t) ||
    t.includes('análise e desenvolvimento de sistemas') ||
    t.includes('analise e desenvolvimento de sistemas') ||
    t.includes('desenvolvimento de sistemas')

  const isCCOMP =
    /\bccomp\b/.test(t) ||
    t.includes('ciência da computação') ||
    t.includes('ciencia da computacao') ||
    /\bcomp\b/.test(t) ||
    t.includes('comput')

  if (isADS) return 'ADS'

  if (isCCOMP) {
    if (t.includes('matutino') || t.includes('manhã') || t.includes('manha')) return 'CCOMP_MATUTINO'

    return 'CCOMP'
  }

  if (t.includes('matutino') || t.includes('manhã') || t.includes('manha')) return 'CCOMP_MATUTINO'

  return null
}

// ===================================================================
// Página
// ===================================================================

export default function GroupsPage() {
  // estado base
  const [groups, setGroups] = useState([])
  const [students, setStudents] = useState([])
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [source, setSource] = useState('db') // 'db' | 'excel'

  const [classes, setClasses] = useState([])
  const [courses, setCourses] = useState([])
  const [saving, setSaving] = useState(false)

  const [filterQuery, setFilterQuery] = useState('')
  const [rowSelect, setRowSelect] = useState({})
  const [rowClass, setRowClass] = useState({})

  // dialogs
  const [dlgClassOpen, setDlgClassOpen] = useState(false)
  const [dlgGroupOpen, setDlgGroupOpen] = useState(false)
  const [dlgDetailsOpen, setDlgDetailsOpen] = useState(false)
  const [detailsGroup, setDetailsGroup] = useState(null)

  // delete
  const [dlgDeleteOpen, setDlgDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // form turma
  const [formClass, setFormClass] = useState({ name: '', semester: '', course_id: '' })

  // form grupo
  const emptyMember = { full_name: '', email: '', github: '' }

  const [formGroup, setFormGroup] = useState({
    group_name: '',
    class_id: '',
    semester: '',
    code: genCode(),
    members: [{ ...emptyMember }, { ...emptyMember }, { ...emptyMember }, { ...emptyMember }]
  })

  // Auto associar & importar (Dialog)
  const [autoOpen, setAutoOpen] = useState(false)

  const fileInputRef = useRef(null)
  const autoFileRef = useRef(null)

  // ---------- PARSERS EXCEL ----------
  const buildGroupsFromRows = rows => {
    const COL_GROUP_NAME = 'Nome do Grupo'

    const NAME_COLS = [
      'Digite o nome completo do integrante 1',
      'Digite o nome completo do integrante 2',
      'Digite o nome completo do integrante 3',
      'Digite o nome completo do integrante 4',
      'Digite o nome completo do integrante 5 (somente com autorização do professor  responsável pelo PI )'
    ]

    const EMAIL_COLS = [
      'Email do Github do integrante 1',
      'Email do Github do integrante 2',
      'Email do Github do integrante 3',
      'Email do Github do integrante 4',
      'Email do Github do integrante 5 (somente com autorização do professor responsável pelo PI)'
    ]

    const header = Object.keys(rows?.[0] || {})

    if (!header.includes(COL_GROUP_NAME)) throw new Error('Planilha não contém a coluna obrigatória "Nome do Grupo".')

    const colTurma =
      header.find(h => ['Turma', 'Nome da Turma', 'Classe', 'Class', 'Escolha um período'].includes(h)) || null

    const colCurso = header.find(h => ['Curso', 'Course', 'Curso (sigla)', 'Qual o seu curso?'].includes(h)) || null
    const colSem = header.find(h => ['Semestre', 'Semester', 'Qual o seu semestre?'].includes(h)) || null

    const map = new Map()

    for (const row of rows) {
      const groupName = norm(row[COL_GROUP_NAME]) || 'Grupo sem nome'

      if (!map.has(groupName)) {
        const turmaText = colTurma ? norm(row[colTurma]) : ''
        const cursoText = colCurso ? norm(row[colCurso]) : ''
        const semText = colSem ? norm(row[colSem]) : ''

        map.set(groupName, {
          id: groupName,
          code: genCode(),
          group_name: groupName,
          members: [],
          members_count: 0,
          qr_content: JSON.stringify({ group_name: groupName, code: genCode() }),
          _excel_turma: turmaText,
          _excel_curso: cursoText,
          _excel_sem: semText,
          _excel_sem_int: parseSemesterInt(semText, turmaText)
        })
      }

      NAME_COLS.forEach((ncol, idx) => {
        const ecol = EMAIL_COLS[idx]
        const full_name = norm(row[ncol])
        const email = norm(row[ecol]).toLowerCase()

        if (!full_name && !email) return
        map.get(groupName).members.push({ full_name, email })
      })
    }

    const list = Array.from(map.values()).map(g => {
      const dedup = Array.from(new Map(g.members.map(m => [m.email || m.full_name, m])).values())

      return { ...g, members: dedup, members_count: dedup.length }
    })

    list.sort((a, b) => a.group_name.localeCompare(b.group_name, 'pt-BR', { numeric: true }))

    return list
  }

  const buildStudentsFromRows = rows => {
    const COL_GROUP_NAME = 'Nome do Grupo'

    const NAME_COLS = [
      'Digite o nome completo do integrante 1',
      'Digite o nome completo do integrante 2',
      'Digite o nome completo do integrante 3',
      'Digite o nome completo do integrante 4',
      'Digite o nome completo do integrante 5 (somente com autorização do professor  responsável pelo PI )'
    ]

    const EMAIL_COLS = [
      'Email do Github do integrante 1',
      'Email do Github do integrante 2',
      'Email do Github do integrante 3',
      'Email do Github do integrante 4',
      'Email do Github do integrante 5 (somente com autorização do professor responsável pelo PI)'
    ]

    const out = []

    for (const row of rows) {
      const group_name = norm(row[COL_GROUP_NAME]) || 'Grupo sem nome'

      NAME_COLS.forEach((ncol, idx) => {
        const ecol = EMAIL_COLS[idx]
        const full_name = norm(row[ncol])
        const email = norm(row[ecol]).toLowerCase()

        if (!full_name && !email) return
        out.push({ full_name, email, group_name })
      })
    }

    const seen = new Set()

    return out.filter(s => {
      const key = s.email || s.full_name

      if (key && !seen.has(key)) {
        seen.add(key)

        return true
      }

      return false
    })
  }

  // ---------- LOAD DB ----------
  const ensureFixedClasses = async () => {
    try {
      const { data: existing } = await supabase
        .from('classes')
        .select('id, name, course_id, semester')
        .in('name', FIXED_CLASS_NAMES)

      const existingNames = new Set((existing || []).map(c => c.name))
      const toCreate = FIXED_CLASS_NAMES.filter(n => !existingNames.has(n)).map(name => ({ name }))

      if (toCreate.length && isAdmin) {
        const { data: created, error } = await supabase
          .from('classes')
          .insert(toCreate)
          .select('id, name, course_id, semester')

        if (error) console.error('ensureFixedClasses insert error:', error)
        setClasses(prev => prev.concat((created || []).map(c => ({ ...c, id: String(c.id) }))))
      }
    } catch (e) {
      console.warn('Falha ao garantir turmas fixas', e)
    }
  }

  const loadFromDb = async () => {
    try {
      setLoading(true)
      setError('')

      const { data: adminCheck } = await supabase.rpc('is_admin')

      setIsAdmin(!!adminCheck)

      const { data, error } = await supabase.from('groups_with_members').select('*')

      if (error) throw error

      const normalized = (data || [])
        .map(row => {
          const members = toMemberArray(row.members)

          return {
            ...row,
            members,
            members_count: typeof row.members_count === 'number' ? row.members_count : members.length
          }
        })
        .sort((a, b) =>
          String(a.group_name || '').localeCompare(String(b.group_name || ''), 'pt-BR', { numeric: true })
        )

      setGroups(normalized)
      setSource('db')

      const { data: cls } = await supabase
        .from('classes')
        .select('id, name, course_id, semester')
        .order('name', { ascending: true })

      setClasses((cls || []).map(c => ({ ...c, id: String(c.id) })))
      await ensureFixedClasses()

      const cids = Array.from(new Set((cls || []).map(c => c.course_id).filter(Boolean)))

      if (cids.length) {
        const { data: crs } = await supabase.from('courses').select('id, name').in('id', cids)

        setCourses(crs || [])
      }
    } catch (e) {
      setError(e.message || 'Erro ao carregar grupos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFromDb()
  }, [])

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getSession()

      if (!data?.session) console.warn('Sem sessão ativa: operações de escrita podem falhar por RLS.')
    })()
  }, [])

  // ---------- FILE HANDLERS ----------
  const handlePickFile = () => fileInputRef.current?.click()

  const allocateTeacherFromExcel = async (parsedGroups, classIdByKey) => {
    try {
      const { data: sess } = await supabase.auth.getSession()
      const email = sess?.session?.user?.email?.toLowerCase()

      if (!email) return

      const idToName = new Map(classes.map(c => [String(c.id), c.name]))
      const combos = new Map() // { className -> Set(semestres) }

      for (const g of parsedGroups) {
        const cid = classIdByKey[groupKey(g)]
        let className = cid ? idToName.get(String(cid)) : null

        if (!className) {
          className = detectNormalizedClassName({
            turmaText: g._excel_turma,
            cursoText: g._excel_curso
          })
        }

        const sem = g._excel_sem_int ?? parseSemesterInt(g._excel_sem, g._excel_turma)

        if (!className || !sem) continue
        if (!combos.has(className)) combos.set(className, new Set())
        combos.get(className).add(sem)
      }

      for (const [className, set] of combos) {
        const semesters = Array.from(set)

        try {
          await supabase.rpc('assign_allocations', {
            p_email: email,
            p_class_name: className,
            p_semesters: semesters
          })
        } catch (e) {
          console.warn('assign_allocations falhou para', className, semesters, e?.message || e)
        }
      }
    } catch (e) {
      console.warn('allocateTeacherFromExcel:', e?.message || e)
    }
  }

  const handleFileChange = async ev => {
    const file = ev.target.files?.[0]

    if (!file) return

    try {
      setLoading(true)
      setError('')
      const data = await file.arrayBuffer()
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })

      if (!rows.length) throw new Error('A planilha está vazia.')

      const parsedGroups = buildGroupsFromRows(rows)
      const parsedStudents = buildStudentsFromRows(rows)

      setGroups(parsedGroups)
      setStudents(parsedStudents)
      setSource('excel')

      // mapeia automaticamente CCOMP / CCOMP_MATUTINO / ADS
      const byName = new Map(classes.map(c => [c.name.toLowerCase(), String(c.id)]))
      const next = {}

      for (const g of parsedGroups) {
        const className = detectNormalizedClassName({
          turmaText: g._excel_turma,
          cursoText: g._excel_curso
        })

        if (className && byName.has(className.toLowerCase())) {
          next[groupKey(g)] = byName.get(className.toLowerCase())
        }
      }

      setRowClass(next)

      await allocateTeacherFromExcel(parsedGroups, next)
      setSnack({ open: true, msg: 'Alocações do professor atual atualizadas a partir do Excel.', sev: 'success' })
    } catch (e) {
      setError(e.message || 'Falha ao processar Excel')
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (autoFileRef.current) autoFileRef.current.value = ''
    }
  }

  // ---------- SAVE (EXCEL -> DB); admin/professor only ----------
  const ensureClassByName = async name => {
    let target = classes.find(c => c.name.toLowerCase() === String(name).toLowerCase())

    if (target) return { ...target, id: String(target.id) }

    const { data: lookup } = await supabase
      .from('classes')
      .select('id, name, course_id, semester')
      .ilike('name', name)
      .maybeSingle()

    if (lookup) return { ...lookup, id: String(lookup.id) }

    if (!isAdmin) {
      throw new Error(`Turma "${name}" não existe e você não tem permissão para criar.`)
    }

    const { data: created, error } = await supabase
      .from('classes')
      .insert({ name })
      .select('id, name, course_id, semester')
      .single()

    if (error) throw error
    const normed = { ...created, id: String(created.id) }

    setClasses(prev => [normed, ...prev])

    return normed
  }

  const replaceGroupMembers = async (groupId, members) => {
    // usa RPC admin-only; se falhar por RLS, cai em erro p/ snack
    for (const m of (members || []).filter(x => x.full_name || x.email)) {
      const { error } = await supabase.rpc('upsert_member', {
        p_group_id: groupId,
        p_full_name: m.full_name || null,
        p_email: (m.email || '').toLowerCase() || null,
        p_github: m.github || null,
        p_student_user_id: null
      })

      if (error) {
        console.error('upsert_member error', error)
        throw error
      }
    }
  }

  const saveGroupsToDb = async parsedGroups => {
    if (!isAdmin) {
      setSnack({ open: true, msg: 'Apenas professores/admin podem importar grupos.', sev: 'warning' })

      return
    }

    // resolve turma por rowClass OU detectNormalizedClassName
    const byId = new Map(classes.map(c => [String(c.id), c]))

    for (const g of parsedGroups) {
      try {
        let classObj = null

        const cid = rowClass[groupKey(g)]

        if (cid && byId.has(String(cid))) {
          classObj = byId.get(String(cid))
        } else {
          const className =
            detectNormalizedClassName({
              turmaText: g._excel_turma,
              cursoText: g._excel_curso
            }) || 'CCOMP'

          classObj = await ensureClassByName(className)
        }

        // cria/acha grupo
        const { data: existed } = await supabase
          .from('pi_groups')
          .select('id')
          .eq('class_id', classObj.id)
          .eq('name', g.group_name)

        let groupId = existed?.[0]?.id

        if (!groupId) {
          const { data: created, error: e1 } = await supabase
            .from('pi_groups')
            .insert({
              class_id: classObj.id,
              name: g.group_name,
              code: genCode(),
              semester: g._excel_sem_int ?? parseSemesterInt(g._excel_sem, g._excel_turma)
            })
            .select('id')
            .single()

          if (e1) throw e1
          groupId = created.id
        }

        // membros (via RPC admin-only)
        await replaceGroupMembers(groupId, g.members)
      } catch (e) {
        console.error('saveGroupsToDb/err group:', g?.group_name, e)
        throw e
      }
    }

    setSnack({ open: true, msg: 'Grupos e membros salvos com sucesso.', sev: 'success' })
    await loadFromDb()
    setSource('db')
  }

  const handleSaveSelected = async () => {
    if (!isAdmin) return setSnack({ open: true, msg: 'Apenas administradores/professores.', sev: 'warning' })

    const toProcess = groups.filter(g => rowSelect[groupKey(g)] && (rowClass[groupKey(g)] || true)).map(g => g)

    if (!toProcess.length) return setSnack({ open: true, msg: 'Selecione grupos para salvar.', sev: 'warning' })

    try {
      setSaving(true)
      await saveGroupsToDb(toProcess)
    } catch (e) {
      console.error('handleSaveSelected error:', e)
      setSnack({
        open: true,
        msg:
          e?.message ||
          'Erro ao salvar. Verifique se você é admin/professor e se a coluna student_user_id é NULLABLE no banco.',
        sev: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  // ---------- BULK ASSIGN (para pré-visualização Excel) ----------
  const bulkAssign = async targetName => {
    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData?.session) {
      setSnack({ open: true, msg: 'Você precisa estar logado.', sev: 'warning' })

      return
    }

    let target = classes.find(c => c.name.toLowerCase() === targetName.toLowerCase())

    if (!target) {
      if (!isAdmin) {
        const { data: lookup } = await supabase
          .from('classes')
          .select('id, name, course_id, semester')
          .ilike('name', targetName)
          .maybeSingle()

        if (lookup) {
          target = { ...lookup, id: String(lookup.id) }
        } else {
          setSnack({
            open: true,
            msg: `Turma "${targetName}" não encontrada e você não é admin para criar.`,
            sev: 'warning'
          })

          return
        }
      } else {
        const { data: created, error } = await supabase
          .from('classes')
          .insert({ name: targetName })
          .select('id, name, course_id, semester')
          .single()

        if (error) {
          const { data: existing } = await supabase
            .from('classes')
            .select('id, name, course_id, semester')
            .ilike('name', targetName)
            .maybeSingle()

          if (!existing) {
            setSnack({
              open: true,
              msg: `Falha ao criar turma "${targetName}"${error?.message ? `: ${error.message}` : ''}`,
              sev: 'error'
            })

            return
          }

          target = { ...existing, id: String(existing.id) }
        } else {
          target = { ...created, id: String(created.id) }
          setClasses(prev => [target, ...prev])
        }
      }
    }

    const id = String(target.id)
    const next = { ...rowClass }

    groups.forEach(g => {
      if (rowSelect[groupKey(g)]) next[groupKey(g)] = id
    })
    setRowClass(next)
    setSnack({ open: true, msg: `Atribuído "${targetName}" aos grupos selecionados.`, sev: 'success' })
  }

  // ---------- CREATE CLASS ----------
  const handleCreateClass = async () => {
    if (!isAdmin) return setSnack({ open: true, msg: 'Apenas administradores/professores.', sev: 'warning' })
    const { name, semester, course_id } = formClass

    if (!name?.trim()) return setSnack({ open: true, msg: 'Informe o nome da turma.', sev: 'warning' })

    try {
      const payload = { name: name.trim() }

      if (semester) payload.semester = Number(semester)
      if (course_id) payload.course_id = course_id

      const { data, error } = await supabase
        .from('classes')
        .insert(payload)
        .select('id, name, course_id, semester')
        .single()

      if (error) throw error

      setClasses(prev => [{ ...data, id: String(data.id) }, ...prev])
      setDlgClassOpen(false)
      setFormClass({ name: '', semester: '', course_id: '' })
      setSnack({ open: true, msg: 'Turma criada!', sev: 'success' })
    } catch (e) {
      setSnack({ open: true, msg: e.message || 'Erro ao criar turma.', sev: 'error' })
    }
  }

  // ---------- CREATE GROUP ----------
  const handleCreateGroup = async () => {
    if (!isAdmin) return setSnack({ open: true, msg: 'Apenas administradores/professores.', sev: 'warning' })
    const { group_name, class_id, semester, code, members } = formGroup

    if (!group_name?.trim()) return setSnack({ open: true, msg: 'Informe o nome do grupo.', sev: 'warning' })
    if (!class_id) return setSnack({ open: true, msg: 'Selecione uma turma.', sev: 'warning' })

    try {
      const { data: created, error } = await supabase
        .from('pi_groups')
        .insert({
          name: group_name.trim(),
          class_id,
          code: code || genCode(),
          semester: semester ? Number(semester) : null
        })
        .select('id, name, class_id, code')
        .single()

      if (error) throw error

      // membros via RPC
      await replaceGroupMembers(created.id, members)

      setDlgGroupOpen(false)
      setFormGroup({
        group_name: '',
        class_id: '',
        semester: '',
        code: genCode(),
        members: [{ ...emptyMember }, { ...emptyMember }, { ...emptyMember }, { ...emptyMember }]
      })
      setSnack({ open: true, msg: 'Grupo criado!', sev: 'success' })
      await loadFromDb()
    } catch (e) {
      setSnack({
        open: true,
        msg: e.message || 'Erro ao criar grupo/membros. Verifique permissões e se student_user_id é NULLABLE no banco.',
        sev: 'error'
      })
    }
  }

  // ---------- DELETE GROUP ----------
  const confirmDeleteGroup = g => {
    setDeleteTarget(g)
    setDlgDeleteOpen(true)
  }

  const handleDeleteGroup = async () => {
    if (!isAdmin) {
      setSnack({ open: true, msg: 'Apenas administradores podem excluir.', sev: 'warning' })
      setDlgDeleteOpen(false)

      return
    }

    try {
      const gid = deleteTarget?.id

      if (!gid) return
      const { error } = await supabase.from('pi_groups').delete().eq('id', gid)

      if (error) throw error

      setSnack({
        open: true,
        msg: `Grupo "${deleteTarget?.group_name || deleteTarget?.name || ''}" excluído.`,
        sev: 'success'
      })
      setDlgDeleteOpen(false)
      setDeleteTarget(null)
      await loadFromDb()
    } catch (e) {
      setSnack({ open: true, msg: e.message || 'Erro ao excluir grupo.', sev: 'error' })
    }
  }

  // ---------- DETAILS DIALOG ----------
  const fetchGroupFromView = async id => {
    const { data, error } = await supabase.from('groups_with_members').select('*').eq('id', id).maybeSingle()

    if (error) throw error
    if (!data) return null

    return {
      ...data,
      members: toMemberArray(data.members),
      members_count: typeof data.members_count === 'number' ? data.members_count : toMemberArray(data.members).length
    }
  }

  const fetchMembersDirect = async id => {
    const { data, error } = await supabase
      .from('pi_group_members')
      .select('full_name, email, github')
      .eq('group_id', id)
      .order('full_name', { ascending: true, nullsFirst: true })

    if (error) throw error

    return toMemberArray(data)
  }

  const openDetails = async g => {
    setDetailsGroup({ ...g, members: toMemberArray(g.members) })
    setDlgDetailsOpen(true)
    if (!g?.id) return

    try {
      const viaView = await fetchGroupFromView(g.id)

      if (viaView) {
        setDetailsGroup(prev => ({ ...prev, ...viaView }))
        if (viaView.members?.length) return
      }
    } catch (e) {
      console.warn('Falha ao buscar na view groups_with_members:', e?.message || e)
    }

    try {
      const ms = await fetchMembersDirect(g.id)

      setDetailsGroup(prev => ({ ...prev, members: ms }))
    } catch (e) {
      console.warn('Falha ao buscar em pi_group_members:', e?.message || e)
    }
  }

  const moveGroupToClass = async (groupId, classId) => {
    if (!isAdmin) return setSnack({ open: true, msg: 'Apenas administradores.', sev: 'warning' })
    if (!groupId || !classId) return

    try {
      const { error } = await supabase.from('pi_groups').update({ class_id: classId }).eq('id', groupId)

      if (error) throw error
      setSnack({ open: true, msg: 'Grupo movido de turma.', sev: 'success' })
      await loadFromDb()
    } catch (e) {
      setSnack({ open: true, msg: e.message || 'Erro ao mover grupo.', sev: 'error' })
    }
  }

  // ---------------------------------------------------------------
  // IMPORTANT: hooks **must** run before any early return.
  // So we compute the memoized `filtered` **above** the loading/error returns.
  // ---------------------------------------------------------------
  const filtered = useMemo(
    () =>
      groups.filter(g => {
        if (
          filterQuery &&
          !String(g.group_name || '')
            .toLowerCase()
            .includes(filterQuery.toLowerCase())
        )
          return false

        return true
      }),
    [groups, filterQuery]
  )

  // ---------- RENDER ----------
  if (loading) return <LinearProgress />
  if (error) return <Alert severity='error'>{error}</Alert>

  return (
    <>
      {/* Topbar */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ mb: 2 }}
        alignItems='center'
        justifyContent='space-between'
      >
        <Typography variant='h5'>Grupos {source === 'excel' ? '(pré-visualização do Excel)' : ''}</Typography>

        <Stack direction='row' spacing={1} alignItems='center' sx={{ flexWrap: 'wrap', rowGap: 1 }}>
          <TextField
            size='small'
            placeholder='Buscar grupo...'
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
          />
          <Button variant='outlined' startIcon={<AddIcon />} onClick={() => setDlgClassOpen(true)}>
            Nova turma
          </Button>
          <Button variant='outlined' startIcon={<AddIcon />} onClick={() => setDlgGroupOpen(true)}>
            Novo grupo
          </Button>
          <Button variant='contained' startIcon={<CloudUploadIcon />} onClick={() => setAutoOpen(true)}>
            Auto associar & importar
          </Button>

          <input
            type='file'
            accept='.xlsx,.xls,.csv'
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <Button variant='contained' startIcon={<CloudUploadIcon />} onClick={handlePickFile}>
            Importar Excel
          </Button>
        </Stack>
      </Stack>

      {/* Controles Excel */}
      {source === 'excel' && (
        <Stack spacing={1} sx={{ mb: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: '100%', maxWidth: 560 }}>
            <Tooltip title='Atribuir selecionados à turma CCOMP'>
              <span style={{ flex: 1 }}>
                <Button fullWidth variant='outlined' onClick={() => bulkAssign('CCOMP')}>
                  CCOMP
                </Button>
              </span>
            </Tooltip>
            <Tooltip title='Atribuir selecionados à turma CCOMP_MATUTINO'>
              <span style={{ flex: 1 }}>
                <Button fullWidth variant='outlined' onClick={() => bulkAssign('CCOMP_MATUTINO')}>
                  CCOMP_MATUTINO
                </Button>
              </span>
            </Tooltip>
            <Tooltip title='Atribuir selecionados à turma ADS'>
              <span style={{ flex: 1 }}>
                <Button fullWidth variant='outlined' onClick={() => bulkAssign('ADS')}>
                  ADS
                </Button>
              </span>
            </Tooltip>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant='contained' color='success' disabled={saving} onClick={handleSaveSelected}>
              {saving ? 'Salvando...' : 'Salvar selecionados'}
            </Button>
            <Button color='secondary' variant='outlined' startIcon={<RestartAltIcon />} onClick={loadFromDb}>
              Voltar ao banco
            </Button>
          </Stack>
        </Stack>
      )}

      {/* Tabela de pré-visualização do Excel */}
      {source === 'excel' && (
        <TableContainer component={Paper} sx={{ mb: 2, overflow: 'visible' }}>
          <Table size='small' sx={{ overflow: 'visible' }}>
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>Grupo</TableCell>
                <TableCell>Membros</TableCell>
                <TableCell>Turma</TableCell>
                <TableCell>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(g => (
                <TableRow key={groupKey(g)} hover>
                  <TableCell padding='checkbox'>
                    <Checkbox
                      checked={!!rowSelect[groupKey(g)]}
                      onChange={() => setRowSelect(s => ({ ...s, [groupKey(g)]: !s[groupKey(g)] }))}
                    />
                  </TableCell>
                  <TableCell onClick={() => openDetails(g)} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>{g.group_name}</span>
                      {(g._excel_turma || g._excel_curso || g._excel_sem) && (
                        <Typography variant='caption' color='text.secondary'>
                          {g._excel_turma ? `Turma: ${g._excel_turma}` : ''}{' '}
                          {g._excel_curso ? `• Curso: ${g._excel_curso}` : ''}{' '}
                          {g._excel_sem ? `• Sem: ${g._excel_sem}` : ''}
                        </Typography>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{g.members_count}</TableCell>
                  <TableCell sx={{ overflow: 'visible' }}>
                    <div onClick={e => e.stopPropagation()}>
                      <MUITextField
                        select
                        size='small'
                        label='Selecione a turma'
                        value={rowClass[groupKey(g)] || ''}
                        onChange={e => setRowClass(s => ({ ...s, [groupKey(g)]: String(e.target.value) }))}
                        fullWidth
                        sx={{ minWidth: 220 }}
                        SelectProps={{ MenuProps: { disablePortal: false, keepMounted: true } }}
                      >
                        {classes.length === 0 && (
                          <MenuItem value='' disabled>
                            Nenhuma turma encontrado
                          </MenuItem>
                        )}
                        {classes.map(c => (
                          <MenuItem key={c.id} value={c.id}>
                            {c.name}
                            {c.semester ? ` — ${c.semester}º` : ''}
                          </MenuItem>
                        ))}
                      </MUITextField>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button size='small' onClick={() => openDetails(g)}>
                      Detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Cards (DB) */}
      {source === 'db' && (
        <Grid container spacing={3}>
          {filtered.map(g => (
            <Grid item xs={12} md={6} lg={4} key={g.id || g.code || g.group_name}>
              <Card onClick={() => openDetails(g)} sx={{ cursor: 'pointer' }}>
                <CardHeader
                  title={`Grupo ${g.group_name}`}
                  subheader={`Código: ${g.code ?? '—'}`}
                  action={
                    <Stack direction='row' spacing={0.5}>
                      <IconButton
                        onClick={e => {
                          e.stopPropagation()
                          openDetails(g)
                        }}
                        size='small'
                        aria-label='Editar'
                      >
                        <EditIcon fontSize='small' />
                      </IconButton>
                      <IconButton
                        onClick={e => {
                          e.stopPropagation()
                          confirmDeleteGroup(g)
                        }}
                        size='small'
                        aria-label='Excluir'
                      >
                        <DeleteOutlineIcon fontSize='small' />
                      </IconButton>
                    </Stack>
                  }
                />
                <CardContent>
                  <Typography variant='body2' gutterBottom>
                    Membros ({typeof g.members_count === 'number' ? g.members_count : (g.members || []).length}):
                  </Typography>
                  <ul style={{ marginTop: 0 }}>
                    {toMemberArray(g.members).map((m, idx) => (
                      <li key={m.email || m.full_name || idx}>
                        {m.full_name || '—'} {m.email ? `(${m.email})` : ''}
                      </li>
                    ))}
                  </ul>
                  <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <QRCodeSVG
                      value={g.qr_content || JSON.stringify({ code: g.code, group_name: g.group_name })}
                      size={128}
                    />
                  </div>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* DIALOG: Nova Turma */}
      <Dialog open={dlgClassOpen} onClose={() => setDlgClassOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Criar nova turma</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label='Nome da turma'
              value={formClass.name}
              onChange={e => setFormClass(s => ({ ...s, name: e.target.value }))}
              placeholder='Ex.: CCOMP, CCOMP_MATUTINO, ADS'
              fullWidth
            />
            <TextField
              label='Semestre (opcional)'
              type='number'
              value={formClass.semester}
              onChange={e => setFormClass(s => ({ ...s, semester: e.target.value }))}
              fullWidth
            />
            <MUITextField
              select
              label='Curso (opcional)'
              value={formClass.course_id}
              onChange={e => setFormClass(s => ({ ...s, course_id: e.target.value }))}
              fullWidth
            >
              <MenuItem value=''>—</MenuItem>
              {courses.map(c => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </MUITextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgClassOpen(false)}>Cancelar</Button>
          <Button onClick={handleCreateClass} variant='contained'>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG: Novo Grupo */}
      <Dialog open={dlgGroupOpen} onClose={() => setDlgGroupOpen(false)} maxWidth='md' fullWidth>
        <DialogTitle>Criar novo grupo</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label='Nome do grupo'
              value={formGroup.group_name}
              onChange={e => setFormGroup(s => ({ ...s, group_name: e.target.value }))}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <MUITextField
                select
                label='Turma'
                value={formGroup.class_id}
                onChange={e => setFormGroup(s => ({ ...s, class_id: e.target.value }))}
                fullWidth
              >
                {classes.map(c => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                    {c.semester ? ` — ${c.semester}º` : ''}
                  </MenuItem>
                ))}
              </MUITextField>
              <TextField
                label='Semestre (opcional)'
                type='number'
                value={formGroup.semester}
                onChange={e => setFormGroup(s => ({ ...s, semester: e.target.value }))}
                fullWidth
              />
              <TextField
                label='Código (QR)'
                value={formGroup.code}
                onChange={e => setFormGroup(s => ({ ...s, code: e.target.value?.toUpperCase() }))}
                fullWidth
              />
            </Stack>

            <Typography variant='subtitle2' sx={{ mt: 2 }}>
              Integrantes
            </Typography>
            <Stack spacing={1}>
              {formGroup.members.map((m, idx) => (
                <Stack key={idx} direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    label={`Nome ${idx + 1}`}
                    value={m.full_name}
                    onChange={e => {
                      const next = [...formGroup.members]

                      next[idx] = { ...next[idx], full_name: e.target.value }
                      setFormGroup(s => ({ ...s, members: next }))
                    }}
                    fullWidth
                  />
                  <TextField
                    label='E-mail'
                    value={m.email}
                    onChange={e => {
                      const next = [...formGroup.members]

                      next[idx] = { ...next[idx], email: e.target.value }
                      setFormGroup(s => ({ ...s, members: next }))
                    }}
                    fullWidth
                  />
                  <TextField
                    label='GitHub (opcional)'
                    value={m.github}
                    onChange={e => {
                      const next = [...formGroup.members]

                      next[idx] = { ...next[idx], github: e.target.value }
                      setFormGroup(s => ({ ...s, members: next }))
                    }}
                    fullWidth
                  />
                </Stack>
              ))}
              <Stack direction='row' spacing={1}>
                <Button onClick={() => setFormGroup(s => ({ ...s, members: [...s.members, { ...emptyMember }] }))}>
                  + Adicionar integrante
                </Button>
                {formGroup.members.length > 1 && (
                  <Button onClick={() => setFormGroup(s => ({ ...s, members: s.members.slice(0, -1) }))}>
                    – Remover último
                  </Button>
                )}
              </Stack>
            </Stack>

            <Stack alignItems='center' sx={{ mt: 2 }}>
              <QRCodeSVG
                value={JSON.stringify({ code: formGroup.code, group_name: formGroup.group_name })}
                size={128}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgGroupOpen(false)}>Cancelar</Button>
          <Button onClick={handleCreateGroup} variant='contained'>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG: Detalhes do Grupo */}
      <Dialog open={dlgDetailsOpen} onClose={() => setDlgDetailsOpen(false)} maxWidth='md' fullWidth>
        <DialogTitle>Detalhes do grupo</DialogTitle>
        <DialogContent dividers>
          {detailsGroup && (
            <Stack spacing={2}>
              <Typography variant='h6'>{detailsGroup.group_name}</Typography>
              <Typography variant='body2' color='text.secondary'>
                Código: {detailsGroup.code ?? '—'}
                {detailsGroup._excel_turma ? ` • Turma no Excel: ${detailsGroup._excel_turma}` : ''}
                {detailsGroup._excel_sem ? ` • Sem: ${detailsGroup._excel_sem}` : ''}
              </Typography>

              <Typography variant='subtitle2'>Integrantes</Typography>
              <TableContainer component={Paper}>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>Nome</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>GitHub</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {toMemberArray(detailsGroup.members).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align='center'>
                          Nenhum integrante cadastrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      toMemberArray(detailsGroup.members).map((m, i) => (
                        <TableRow key={m.email || m.full_name || i}>
                          <TableCell>{m.full_name || '—'}</TableCell>
                          <TableCell>{m.email || '—'}</TableCell>
                          <TableCell>{m.github || '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Stack alignItems='center' sx={{ mt: 2 }}>
                <QRCodeSVG
                  value={
                    detailsGroup.qr_content ||
                    JSON.stringify({ code: detailsGroup.code, group_name: detailsGroup.group_name })
                  }
                  size={160}
                />
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
                <MUITextField
                  select
                  label='Mover/Salvar na turma'
                  value={rowClass[groupKey(detailsGroup)] || detailsGroup.class_id || ''}
                  onChange={e => setRowClass(s => ({ ...s, [groupKey(detailsGroup)]: String(e.target.value) }))}
                  fullWidth
                >
                  {classes.map(c => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                      {c.semester ? ` — ${c.semester}º` : ''}
                    </MenuItem>
                  ))}
                </MUITextField>
                {source === 'db' ? (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: '100%' }}>
                    <Button
                      variant='contained'
                      onClick={() => moveGroupToClass(detailsGroup.id, rowClass[groupKey(detailsGroup)])}
                    >
                      Mover para turma
                    </Button>
                    <Button
                      variant='outlined'
                      color='error'
                      onClick={() => {
                        setDlgDetailsOpen(false)
                        confirmDeleteGroup(detailsGroup)
                      }}
                    >
                      Excluir grupo
                    </Button>
                    <Button variant='text' onClick={() => openDetails(detailsGroup)}>
                      Recarregar integrantes
                    </Button>
                  </Stack>
                ) : (
                  <Button variant='contained' onClick={handleSaveSelected}>
                    Salvar selecionados
                  </Button>
                )}
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgDetailsOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG: Confirmar exclusão */}
      <MuiDialog open={dlgDeleteOpen} onClose={() => setDlgDeleteOpen(false)}>
        <DialogTitle>Confirmar exclusão</DialogTitle>
        <DialogContent dividers>
          <Typography>
            Tem certeza que deseja excluir o grupo <strong>{deleteTarget?.group_name || deleteTarget?.name}</strong>?
            Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgDeleteOpen(false)}>Cancelar</Button>
          <Button onClick={handleDeleteGroup} color='error' variant='contained'>
            Excluir
          </Button>
        </DialogActions>
      </MuiDialog>

      {/* DIALOG: Auto associar & importar */}
      <Dialog open={autoOpen} onClose={() => setAutoOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Auto associar & importar</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant='body2' color='text.secondary'>
              Envie o mesmo Excel dos grupos. Detectaremos turma/curso/semestre automaticamente e salvaremos no banco.
            </Typography>
            <Button
              component='label'
              startIcon={<CloudUploadIcon />}
              sx={{
                textTransform: 'none',
                px: 2.5,
                py: 1.25,
                borderRadius: 999,
                fontWeight: 600,
                letterSpacing: 0.2,
                boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                background: 'linear-gradient(135deg, #5B86E5 0%, #36D1DC 100%)',
                color: '#fff',
                '&:hover': {
                  boxShadow: '0 8px 22px rgba(0,0,0,0.18)',
                  transform: 'translateY(-1px)',
                  background: 'linear-gradient(135deg, #4c77d6 0%, #2fc3cd 100%)'
                },
                '&:active': { transform: 'translateY(0)' },
                '& .MuiButton-startIcon': { mr: 1 }
              }}
            >
              Escolher arquivo
              <input type='file' accept='.xlsx,.xls,.csv' hidden onChange={handleFileChange} />
            </Button>
            <Alert severity={isAdmin ? 'success' : 'warning'}>
              {isAdmin
                ? 'Você tem permissão para salvar (admin/professor).'
                : 'Somente admin/professor pode salvar no banco.'}
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAutoOpen(false)}>Fechar</Button>
          {source === 'excel' && (
            <Button
              onClick={async () => {
                try {
                  setSaving(true)
                  await saveGroupsToDb(groups) // usa os grupos carregados na prévia
                  setAutoOpen(false)
                } catch (e) {
                  console.error('Auto import error:', e)
                  setSnack({
                    open: true,
                    msg:
                      e?.message || 'Falha ao salvar. Verifique permissões e se student_user_id é NULLABLE no banco.',
                    sev: 'error'
                  })
                } finally {
                  setSaving(false)
                }
              }}
              variant='contained'
              disabled={!isAdmin || saving || source !== 'excel'}
            >
              {saving ? 'Salvando...' : 'Salvar no banco'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        message={snack.msg}
      />
    </>
  )
}
