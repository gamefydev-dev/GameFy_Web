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

import { toMemberArray, parseFromGithubUrl } from './utils'

export function GroupsExcelPreview({ groups, classes, rowClass, setRowClass, rowSelect, setRowSelect, setSnack }) {
  const keyOf = g => String(g.id)

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
              <TableCell width={240}>
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
                    sx={{ minWidth: 160 }}
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
                  <Tooltip title='Detectar turma via URL do GitHub'>
                    <IconButton
                      size='small'
                      onClick={() => {
                        const { className } = parseFromGithubUrl(g.github_url)

                        if (!className) {
                          setSnack({
                            open: true,
                            msg: `Não consegui detectar a turma para "${g.group_name}".`,
                            sev: 'info'
                          })

                          return
                        }

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
                      }}
                    >
                      <AutoFixHighIcon fontSize='small' />
                    </IconButton>
                  </Tooltip>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
