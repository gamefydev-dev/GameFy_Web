'use client'

import { useEffect, useMemo, useState, useRef } from 'react'

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  Alert,
  LinearProgress,
  TextField as MUITextField,
  MenuItem,
  Snackbar,
  Paper
} from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DoneAllIcon from '@mui/icons-material/DoneAll'

import { supabase } from '@/libs/supabaseAuth'

const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase()
const norm = v => (v ?? '').toString().trim()
const groupKey = g => String(g.id ?? g.group_name ?? g.code ?? '')

const toMemberArray = val => {
  if (Array.isArray(val)) return val
  if (!val) return []

  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val)

      return Array.isArray(p) ? p : []
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

// SELECT→INSERT sem upsert (evita 400 do on_conflict), com retry para colisão de code
const createOrGetGroupId = async ({ class_id, name, semester }) => {
  // já existe?
  {
    const { data: found, error: selErr } = await supabase
      .from('pi_groups')
      .select('id, semester')
      .eq('class_id', class_id)
      .eq('name', name)
      .maybeSingle()

    if (selErr && selErr.code && selErr.code !== 'PGRST116') throw selErr

    if (found?.id) {
      if (semester != null && (found.semester ?? null) !== semester) {
        try {
          await supabase.from('pi_groups').update({ semester }).eq('id', found.id)
        } catch {}
      }

      return found.id
    }
  }

  // inserir com retry
  for (let attempt = 0; attempt < 4; attempt++) {
    const payload = { class_id, name, code: genCode(), semester: semester ?? null }

    const { data: ins, error: insErr } = await supabase.from('pi_groups').insert(payload).select('id').maybeSingle()

    if (ins?.id) return ins.id

    if (insErr) {
      const msg = (insErr.message || '').toLowerCase()
      const code = insErr.code

      // corrida: outro criou
      if ((msg.includes('unique') && msg.includes('class')) || (code === '23505' && msg.includes('class'))) {
        const { data: again } = await supabase
          .from('pi_groups')
          .select('id')
          .eq('class_id', class_id)
          .eq('name', name)
          .maybeSingle()

        if (again?.id) return again.id
      }

      // colisão do code
      if ((msg.includes('unique') && msg.includes('code')) || (code === '23505' && msg.includes('code'))) continue
      throw insErr
    }
  }

  return null
}

export default function AutoAssociateImport({ open, onClose, onDone }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' })
  const [classes, setClasses] = useState([])

  const fileRef = useRef(null)
  const [parsedGroups, setParsedGroups] = useState([])
  const [preview, setPreview] = useState({ grupos: 0, membros: 0 })

  useEffect(() => {
    if (!open) return
    ;(async () => {
      const { data } = await supabase.from('classes').select('id,name,semester,course_id').order('name')

      setClasses((data || []).map(c => ({ ...c, id: String(c.id) })))
    })()
  }, [open])

  const byName = useMemo(() => {
    const m = new Map()

    classes.forEach(c => m.set((c.name || '').toLowerCase(), String(c.id)))

    return m
  }, [classes])

  const handlePick = () => fileRef.current?.click()

  const parseExcel = async file => {
    const buff = await file.arrayBuffer()
    const XLSX = await import('xlsx')
    const wb = XLSX.read(buff, { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })

    if (!rows.length) throw new Error('A planilha está vazia.')

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

    if (!header.includes(COL_GROUP_NAME)) {
      throw new Error('Planilha não contém a coluna "Nome do Grupo".')
    }

    const colTurma = header.find(h => /(turma|classe|per[ií]odo)/i.test(h)) || null
    const colCurso = header.find(h => /curso/i.test(h)) || null
    const colSem = header.find(h => /(semestre|semester)/i.test(h)) || null

    const map = new Map()
    let memberCount = 0

    for (const row of rows) {
      const group_name = norm(row[COL_GROUP_NAME]) || 'Grupo sem nome'

      if (!map.has(group_name)) {
        const turmaText = colTurma ? norm(row[colTurma]) : ''
        const cursoText = colCurso ? norm(row[colCurso]) : ''
        const semText = colSem ? norm(row[colSem]) : ''

        map.set(group_name, {
          id: group_name,
          code: genCode(),
          group_name,
          members: [],
          _excel_turma: turmaText,
          _excel_curso: cursoText,
          _excel_sem: semText,
          _excel_sem_int: parseSemesterInt(semText, turmaText)
        })
      }

      NAME_COLS.forEach((ncol, i) => {
        const full_name = norm(row[ncol])
        const email = norm(row[EMAIL_COLS[i]]).toLowerCase()

        if (!full_name && !email) return
        map.get(group_name).members.push({ full_name, email })
        memberCount++
      })
    }

    const list = Array.from(map.values()).map(g => {
      const dedup = Array.from(new Map(g.members.map(m => [m.email || m.full_name, m])).values())

      return { ...g, members: dedup }
    })

    setParsedGroups(list)
    setPreview({ grupos: list.length, membros: memberCount })
  }

  const handleFile = async e => {
    const file = e.target.files?.[0]

    if (!file) return

    try {
      setError('')
      setLoading(true)
      await parseExcel(file)
      setSnack({ open: true, msg: 'Planilha lida. Pronta para salvar e alocar.', sev: 'info' })
    } catch (err) {
      setError(err.message || 'Falha ao ler planilha.')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const runImportAndAssociate = async () => {
    try {
      setLoading(true)
      setError('')

      const { data: sess } = await supabase.auth.getSession()
      const teacherEmail = sess?.session?.user?.email?.toLowerCase()

      if (!teacherEmail) throw new Error('Sem sessão. Entre na sua conta de professor.')

      // 1) mapear turma do Excel -> id da tabela classes
      const classIdByKey = {}

      for (const g of parsedGroups) {
        const className = detectNormalizedClassName({ turmaText: g._excel_turma, cursoText: g._excel_curso })

        if (className && byName.has(className.toLowerCase())) {
          classIdByKey[groupKey(g)] = byName.get(className.toLowerCase())
        }
      }

      // 2) salvar grupos + membros
      for (const g of parsedGroups) {
        const class_id = classIdByKey[groupKey(g)]

        if (!class_id) continue
        const semester = g._excel_sem_int
        const groupId = await createOrGetGroupId({ class_id, name: g.group_name, semester })

        if (!groupId) continue

        if (g.members?.length) {
          const payload = g.members
            .filter(m => m.full_name || m.email)
            .map(m => ({
              group_id: groupId,
              full_name: m.full_name || null,
              email: m.email ? String(m.email).toLowerCase() : null,
              github: m.github || null
            }))

          if (payload.length) {
            await supabase.from('pi_group_members').upsert(payload, { onConflict: 'group_id,email' })
          }
        }
      }

      // 3) montar combinações [turma, semestres] e chamar RPC para o professor logado
      const idToName = new Map(classes.map(c => [String(c.id), c.name]))
      const combos = new Map() // className -> Set(sem)

      for (const g of parsedGroups) {
        const cid = classIdByKey[groupKey(g)]

        const cname = cid
          ? idToName.get(String(cid))
          : detectNormalizedClassName({ turmaText: g._excel_turma, cursoText: g._excel_curso })

        const sem = g._excel_sem_int

        if (!cname || !sem) continue
        if (!combos.has(cname)) combos.set(cname, new Set())
        combos.get(cname).add(sem)
      }

      for (const [className, semSet] of combos) {
        const semesters = Array.from(semSet)

        try {
          await supabase.rpc('assign_allocations', {
            p_email: teacherEmail,
            p_class_name: className,
            p_semesters: semesters
          })
        } catch (e) {
          // não falha o fluxo se a RPC estiver restrita
          console.warn('assign_allocations falhou:', className, semesters, e?.message || e)
        }
      }

      setSnack({ open: true, msg: 'Grupos salvos e professor alocado por turma/semestre.', sev: 'success' })
      onDone?.() // recarrega a tela de grupos
      onClose?.()
    } catch (err) {
      setError(err.message || 'Erro ao salvar/alocar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>Auto associar professor e importar grupos</DialogTitle>
      <DialogContent dividers>
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        {error && (
          <Alert severity='error' sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Stack spacing={2}>
          <Typography variant='body2'>
            Este assistente lê a planilha, cria/atualiza os grupos e <strong>aloca o professor logado</strong> para as
            combinações <em>turma + semestre</em> encontradas (ex.: Victor → CCOMP {`{1,3,5,6}`} e ADS {`{2}`}).
          </Typography>

          <input type='file' ref={fileRef} accept='.xlsx,.xls,.csv' style={{ display: 'none' }} onChange={handleFile} />
          <Button variant='outlined' startIcon={<CloudUploadIcon />} onClick={e => fileRef.current?.click()}>
            Escolher planilha
          </Button>

          {parsedGroups.length > 0 && (
            <Paper variant='outlined' sx={{ p: 2 }}>
              <Typography variant='subtitle2' gutterBottom>
                Pré-visualização
              </Typography>
              <Typography variant='body2'>Grupos: {preview.grupos}</Typography>
              <Typography variant='body2'>Membros (linhas lidas): {preview.membros}</Typography>
            </Paper>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          disabled={parsedGroups.length === 0 || loading}
          onClick={runImportAndAssociate}
          variant='contained'
          startIcon={<DoneAllIcon />}
        >
          Importar & alocar
        </Button>
      </DialogActions>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        message={snack.msg}
      />
    </Dialog>
  )
}
