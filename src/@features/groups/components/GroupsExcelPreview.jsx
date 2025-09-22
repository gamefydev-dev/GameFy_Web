import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  TextField as MUITextField,
  MenuItem,
  Tooltip,
  IconButton
} from '@mui/material'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'

import { toMemberArray, parseFromGithubUrl, parseSemesterInt } from './utils'

/**
 * Props:
 * - groups: array vindo do Excel (cada item já tem _excel_* e possivelmente semester)
 * - classes: turmas cadastradas no banco
 * - rowClass, setRowClass: estado controlado de turma por linha
 * - rowSemester, setRowSemester: estado controlado de semestre por linha (1..12)
 * - rowSelect, setRowSelect: seleção em massa
 * - setSnack: snackbar
 */
export function GroupsExcelPreview({
  groups,
  classes,
  rowClass,
  setRowClass,
  rowSemester,
  setRowSemester,
  rowSelect,
  setRowSelect,
  setSnack
}) {
  const keyOf = g => String(g.id)

  // helper que resolve o semestre mostrado (estado -> excel/url -> null)
  const getShownSemester = g => {
    const k = keyOf(g)
    const fromState = rowSemester?.[k]

    if (fromState != null && fromState !== '') return String(fromState)

    // preferir o que veio do Excel
    if (g.semester != null) return String(g.semester)
    if (g._excel_sem_int != null) return String(g._excel_sem_int)

    // tentar deduzir de outros campos do Excel/URL
    const deduced =
      parseSemesterInt(g._excel_sem, g._excel_turma || g._excel_curso) ??
      parseFromGithubUrl(g.github_url).semester ??
      null

    return deduced != null ? String(deduced) : ''
  }

  const handleAutoDetect = g => {
    const { className, semester } = parseFromGithubUrl(g.github_url)

    // 1) turma
    if (className) {
      const found = classes.find(c => String(c.name).toUpperCase() === className.toUpperCase())

      if (found) {
        setRowClass(s => ({ ...s, [keyOf(g)]: found }))
        setSnack({ open: true, msg: `Turma "${found.name}" aplicada.`, sev: 'success' })
      } else {
        setSnack({
          open: true,
          msg: `Detectei "${className}", mas não existe essa turma ainda.`,
          sev: 'warning'
        })
      }
    } else {
      setSnack({
        open: true,
        msg: `Não consegui detectar a turma para "${g.group_name}".`,
        sev: 'info'
      })
    }

    // 2) semestre
    const semFromExcel = parseSemesterInt(g._excel_sem, g._excel_turma || g._excel_curso) ?? g._excel_sem_int ?? null

    const sem = semester ?? semFromExcel ?? null

    if (sem) {
      setRowSemester(s => ({ ...s, [keyOf(g)]: sem }))
    }
  }

  return (
    <TableContainer component={Paper} sx={{ mb: 2, overflow: 'visible' }}>
      <Table size='small' sx={{ overflow: 'visible' }}>
        <TableHead>
          <TableRow>
            <TableCell padding='checkbox'>
              <Checkbox
                indeterminate={Object.values(rowSelect).some(Boolean) && !Object.values(rowSelect).every(Boolean)}
                checked={
                  groups.length > 0 &&
                  Object.keys(rowSelect).length >= groups.length &&
                  Object.values(rowSelect).every(Boolean)
                }
                onChange={(_, checked) => {
                  const next = {}

                  for (const g of groups) next[keyOf(g)] = checked
                  setRowSelect(next)
                }}
              />
            </TableCell>
            <TableCell>Grupo</TableCell>
            <TableCell>Integrantes</TableCell>
            <TableCell>Turma</TableCell>
            <TableCell>Semestre</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {groups.map(g => (
            <TableRow key={keyOf(g)} hover>
              <TableCell padding='checkbox'>
                <Checkbox
                  checked={!!rowSelect[keyOf(g)]}
                  onChange={() => setRowSelect(s => ({ ...s, [keyOf(g)]: !s[keyOf(g)] }))}
                />
              </TableCell>

              <TableCell>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>{g.group_name}</span>
                  {g.github_url ? (
                    <a href={g.github_url} target='_blank' rel='noopener noreferrer' style={{ fontSize: 12 }}>
                      {g.github_url}
                    </a>
                  ) : (
                    <span style={{ fontSize: 12, color: '#777' }}>sem GitHub</span>
                  )}
                </div>
              </TableCell>

              <TableCell>
                {toMemberArray(g.members)
                  .slice(0, 3)
                  .map((m, idx) => (
                    <div key={m.email || m.full_name || idx}>
                      {m.full_name || '—'} {m.email ? `(${m.email})` : ''}
                    </div>
                  ))}
                {toMemberArray(g.members).length > 3 && (
                  <div style={{ color: '#777' }}>+ {toMemberArray(g.members).length - 3} outros…</div>
                )}
              </TableCell>

              <TableCell width={260}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <MUITextField
                    select
                    size='small'
                    label='Turma'
                    value={rowClass[keyOf(g)]?.id || rowClass[keyOf(g)] || ''}
                    onChange={e => {
                      const found = classes.find(c => String(c.id) === e.target.value)

                      setRowClass(s => ({ ...s, [keyOf(g)]: found || e.target.value }))
                    }}
                    sx={{ minWidth: 180 }}
                  >
                    {classes.length === 0 && (
                      <MenuItem value='' disabled>
                        Nenhuma turma encontrada
                      </MenuItem>
                    )}
                    {classes.map(c => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                        {c.semester ? ` — ${c.semester}º` : ''}
                      </MenuItem>
                    ))}
                  </MUITextField>

                  <Tooltip title='Detectar turma/semestre via URL do GitHub ou dados da planilha'>
                    <IconButton size='small' onClick={() => handleAutoDetect(g)}>
                      <AutoFixHighIcon fontSize='small' />
                    </IconButton>
                  </Tooltip>
                </div>
              </TableCell>

              <TableCell width={140}>
                <MUITextField
                  select
                  size='small'
                  label='Semestre'
                  value={getShownSemester(g)}
                  onChange={e => {
                    const v = e.target.value === '' ? '' : Number(e.target.value)

                    setRowSemester(s => ({ ...s, [keyOf(g)]: v }))
                  }}
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value=''>—</MenuItem>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                    <MenuItem key={n} value={String(n)}>
                      {n}º
                    </MenuItem>
                  ))}
                </MUITextField>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
