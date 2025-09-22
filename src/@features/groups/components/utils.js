// Utilitários compartilhados

export const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase()

export const norm = v => (v ?? '').toString().trim()

/**
 * Converte vários formatos para um array de membros {full_name,email,github}
 */
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

/**
 * Extrai um semestre inteiro (1..12) a partir de textos diversos.
 * Aceita: "5", "5º", "Semestre 5", "S5", etc.
 * Como fallback, tenta tokens do tipo NCC5/NADS4/MCC3.
 */
export const parseSemesterInt = (semText, turmaText) => {
  const s = String(semText || turmaText || '').toUpperCase()

  // 1) números “puros” (1..12) com ou sem símbolo º
  const mNum = s.match(/\b(1[0-2]|[1-9])\b|(?:\b(1[0-2]|[1-9])º\b)/)

  if (mNum) {
    const n = Number(mNum[1] || mNum[2])

    if (n >= 1 && n <= 12) return n
  }

  // 2) “SEMESTRE 7”, “S7”, “PERÍODO 4”, etc.
  const mSem = s.match(/\b(?:SEM|SEMESTRE|S|PERIODO|PERÍODO)\s*(1[0-2]|[1-9])\b/)

  if (mSem) {
    const n = Number(mSem[1])

    if (n >= 1 && n <= 12) return n
  }

  // 3) tokens NCC/NADS/MCC + dígito
  const mTok = s.match(/\b(?:NCC|NADS|MCC)\s*(1[0-2]|[1-9])\b/)

  if (mTok) {
    const n = Number(mTok[1])

    if (n >= 1 && n <= 12) return n
  }

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

/**
 * Normaliza o NOME DA TURMA/CLASSE a partir de textos de turma/curso.
 * Agora reconhece “CCOMP_MATUTINO” explicitamente.
 */
export const detectNormalizedClassName = ({ turmaText, cursoText }) => {
  const s = String(turmaText || cursoText || '')
    .toUpperCase()
    .replace(/\s+/g, '')

  if (/^CCOMP_MATUTINO/.test(s)) return 'CCOMP_MATUTINO'
  if (/^CCOMP/.test(s)) return 'CCOMP'
  if (/^ADS/.test(s)) return 'ADS'
  if (/^MCC/.test(s)) return 'MCC'

  const t = s.match(/\b(NADS[1-9]|NCC[1-9]|MCC[1-9]|NADS1[0-2]|NCC1[0-2]|MCC1[0-2])\b/)

  if (t?.[1]) return courseTokenToClassName(t[1])

  return null
}

/**
 * Extrai token de curso/semestre de uma URL do GitHub (quando presente),
 * ex.: .../NADS4/... -> {token:'NADS4', className:'ADS', semester:4}
 */
export const parseFromGithubUrl = url => {
  const m = String(url || '')
    .toUpperCase()
    .match(/\b(NADS(?:1[0-2]|[1-9])|NCC(?:1[0-2]|[1-9])|MCC(?:1[0-2]|[1-9]))\b/)

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

  if (!header.includes(COL_GROUP_NAME)) {
    throw new Error('Planilha não contém a coluna "Nome do Grupo".')
  }

  // ⚠️ “Escolha um período” é SEMESTRE, não turma
  const colTurma = header.find(h => ['Turma', 'Nome da Turma', 'Classe', 'Class'].includes(h)) || null

  const colCurso = header.find(h => ['Curso', 'Course', 'Curso (sigla)', 'Qual o seu curso?'].includes(h)) || null

  const colSem =
    header.find(h => ['Semestre', 'Semester', 'Qual o seu semestre?', 'Escolha um período'].includes(h)) || null

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

      // Semestre: prioridade para a coluna de semestre; fallback para turma/curso; fallback para token da URL
      const semInt = parseSemesterInt(semText, turmaText || cursoText) ?? parsedUrl.semester ?? null

      // Classe normalizada: priorize turma/curso explícito; fallback ao token da URL
      const classGuess = detectNormalizedClassName({ turmaText, cursoText }) ?? parsedUrl.className ?? null

      const code = genCode()

      map.set(group_name, {
        id: group_name,
        code,
        group_name,
        members: [],
        members_count: 0,
        qr_content: JSON.stringify({ group_name, code }), // reaproveita o mesmo code
        _excel_turma: turmaText,
        _excel_curso: cursoText,
        _excel_sem: semText,
        _excel_sem_int: semInt,
        github_url,
        _url_class_guess: parsedUrl.className,

        // valores que o backend realmente usará
        class_name_guess: classGuess,
        semester: semInt
      })
    }

    // membros
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
