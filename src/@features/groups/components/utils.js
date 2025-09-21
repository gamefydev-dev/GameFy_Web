// Utilitários compartilhados

export const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase()
export const norm = v => (v ?? '').toString().trim()

export const toMemberArray = val => {
  if (!val) return []
  if (Array.isArray(val)) return val

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

export const parseSemesterInt = (semText, turmaText) => {
  const s = String(semText || turmaText || '').toUpperCase()
  const m1 = s.match(/\b([1-6])\b/)

  if (m1) return Number(m1[1])
  const m2 = s.match(/\b(?:NCC|NADS|MCC)\s*([1-6])\b/)

  if (m2) return Number(m2[1])

  return null
}

const courseTokenToClassName = token => {
  if (!token) return null
  const t = token.toUpperCase()

  if (t.startsWith('NCC')) return 'CCOMP'
  if (t.startsWith('NADS')) return 'ADS'
  if (t.startsWith('MCC')) return 'MCC'

  return null
}

export const detectNormalizedClassName = ({ turmaText, cursoText }) => {
  const s = String(turmaText || cursoText || '')
    .toUpperCase()
    .replace(/\s+/g, '')

  if (/^CCOMP/.test(s)) return 'CCOMP'
  if (/^ADS/.test(s)) return 'ADS'
  if (/^MCC/.test(s)) return 'MCC'
  const t = s.match(/\b(NADS[1-6]|NCC[1-6]|MCC[1-6])\b/)

  if (t?.[1]) return courseTokenToClassName(t[1])

  return null
}

export const parseFromGithubUrl = url => {
  const m = String(url || '')
    .toUpperCase()
    .match(/\b(NADS[1-6]|NCC[1-6]|MCC[1-6])\b/)

  const token = m?.[1] || null
  const className = token ? courseTokenToClassName(token) : null
  const semester = token ? Number(token.replace(/\D+/g, '') || '0') || null : null

  return { token, className, semester }
}

// Excel → grupos
export const buildGroupsFromRows = rows => {
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

  if (!header.includes(COL_GROUP_NAME)) throw new Error('Planilha não contém a coluna "Nome do Grupo".')

  const colTurma =
    header.find(h => ['Turma', 'Nome da Turma', 'Classe', 'Class', 'Escolha um período'].includes(h)) || null

  const colCurso = header.find(h => ['Curso', 'Course', 'Curso (sigla)', 'Qual o seu curso?'].includes(h)) || null
  const colSem = header.find(h => ['Semestre', 'Semester', 'Qual o seu semestre?'].includes(h)) || null
  const colGithub = header.find(h => ['Github', 'GitHub', 'Repositório'].includes(h)) || null

  const map = new Map()

  for (const row of rows) {
    const group_name = norm(row[COL_GROUP_NAME]) || 'Grupo sem nome'

    if (!map.has(group_name)) {
      const turmaText = colTurma ? norm(row[colTurma]) : ''
      const cursoText = colCurso ? norm(row[colCurso]) : ''
      const semText = colSem ? norm(row[colSem]) : ''
      const github_url = colGithub ? norm(row[colGithub]) : ''
      const parsedUrl = parseFromGithubUrl(github_url)

      map.set(group_name, {
        id: group_name,
        code: genCode(),
        group_name,
        members: [],
        members_count: 0,
        qr_content: JSON.stringify({ group_name, code: genCode() }),
        _excel_turma: turmaText,
        _excel_curso: cursoText,
        _excel_sem: semText,
        _excel_sem_int: parsedUrl.semester ?? null,
        github_url,
        _url_class_guess: parsedUrl.className
      })
    }

    // membros
    const idxBase = NAME_COLS.length

    NAME_COLS.forEach((ncol, idx) => {
      const ecol = EMAIL_COLS[idx]
      const full_name = norm(row[ncol])
      const email = norm(row[ecol]).toLowerCase()

      if (!full_name && !email) return
      map.get(group_name).members.push({ full_name, email })
    })
  }

  return Array.from(map.values())
}
