'use client'

import React, { useMemo, useState } from 'react'

// MUI
import {
  Card,
  CardHeader,
  CardContent,
  Grid,
  Stack,
  Box,
  Divider,
  Chip,
  TextField,
  InputAdornment,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Checkbox,
  Button,
  Snackbar,
  Alert,
  Tooltip,
  Typography,
  Paper,
  useMediaQuery
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import SearchIcon from '@mui/icons-material/Search'
import SendIcon from '@mui/icons-material/Send'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import AddIcon from '@mui/icons-material/Add'

// ----------------- Helpers -----------------
const emailRe = /(?:^|\s|<|\()([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?:$|\s|>|\))/

function dedupeByEmail(rows) {
  const seen = new Set()
  const out = []

  for (const r of rows || []) {
    const key = ((r.email || '') + '').trim().toLowerCase()

    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }

  return out
}

function normalizeRecord(r) {
  return {
    id: crypto.randomUUID(),
    full_name: (r.full_name || r.name || '').trim(),
    email: (r.email || '').trim(),
    area: r.area || '',
    dept: r.dept || ''
  }
}

function parsePastedList(text) {
  const rows = []

  for (const rawLine of (text || '').split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line) continue

    const m = line.match(emailRe)
    const email = m ? m[1] : null

    if (!email) continue

    let name = ''

    if (line.includes('<') && line.includes('>')) {
      name = line.replace(/<.*?>/g, '').trim()
    } else if (line.includes(',')) {
      const [a, b] = line.split(',').map(s => s.trim())

      if (a.includes('@')) name = b || ''
      else if (b?.includes('@')) name = a || ''
    }

    rows.push(normalizeRecord({ full_name: name, email }))
  }

  return rows
}

function parseCSV(text) {
  // aceita vírgula ou ponto-e-vírgula
  const sep = text.includes(';') && !text.includes(',') ? ';' : ','
  const lines = text.split(/\r?\n/)

  if (!lines.length) return []

  const header = lines
    .shift()
    .split(sep)
    .map(h => h.trim().toLowerCase())

  const idx = {
    email: header.findIndex(h => h === 'email' || h === 'e-mail'),
    name: header.findIndex(h => ['name', 'full_name', 'full name', 'nome'].includes(h)),
    area: header.findIndex(h => ['area', 'área'].includes(h)),
    dept: header.findIndex(h => ['depto', 'departamento', 'dept'].includes(h))
  }

  const rows = []

  for (const raw of lines) {
    if (!raw.trim()) continue
    const cols = raw.split(sep).map(c => c.trim())

    const rec = normalizeRecord({
      email: idx.email >= 0 ? cols[idx.email] : '',
      full_name: idx.name >= 0 ? cols[idx.name] : '',
      area: idx.area >= 0 ? cols[idx.area] : '',
      dept: idx.dept >= 0 ? cols[idx.dept] : ''
    })

    if (rec.email) rows.push(rec)
  }

  return rows
}

// ----------------- Página -----------------
export default function PreCadastroProfessoresPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isTablet = useMediaQuery(theme.breakpoints.down('md'))
  const fieldSize = isTablet ? 'small' : 'medium'

  // fonte única de verdade: lista em memória
  const [professores, setProfessores] = useState([]) // {id, full_name, email, area?, dept?}
  const [selected, setSelected] = useState([])
  const [search, setSearch] = useState('')

  const [subject, setSubject] = useState('[GameFy] Pré-cadastro de professor')
  const [fromName, setFromName] = useState('GameFy')
  const [fromEmail, setFromEmail] = useState('auto@gamefy.education')

  const [preview, setPreview] = useState(
    'Olá {{name}},\n\nBem-vindo(a) ao GameFy como professor! Para concluir seu pré-cadastro, acesse: {{link}}\n\nAbraços,\nEquipe GameFy'
  )

  const [linkCadastro, setLinkCadastro] = useState('https://www.gamefy.education/register')

  const [testMode, setTestMode] = useState(false)
  const [testEmail, setTestEmail] = useState('seuemail@exemplo.com')

  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'info' })
  const [sending, setSending] = useState(false)
  const [report, setReport] = useState('')

  // ---------- Filtro ----------
  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase()

    return professores.filter(p => {
      const byText =
        !q ||
        (p.full_name || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.area || '').toLowerCase().includes(q) ||
        (p.dept || '').toLowerCase().includes(q)

      return byText
    })
  }, [professores, search])

  // ---------- Seleção ----------
  const toggleAll = checked => setSelected(checked ? filtered.map(p => p.id) : [])

  const toggleOne = (id, checked) =>
    setSelected(prev => (checked ? Array.from(new Set([...prev, id])) : prev.filter(x => x !== id)))

  const selectedRows = useMemo(() => professores.filter(p => selected.includes(p.id)), [professores, selected])

  // ---------- Ações de lista ----------
  const copyList = async () => {
    const text = selectedRows.map(r => `${r.full_name || ''} <${r.email}>`).join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setSnack({ open: true, msg: 'Lista copiada', sev: 'success' })
    } catch {
      setSnack({ open: true, msg: 'Não foi possível copiar', sev: 'warning' })
    }
  }

  const addManual = rec => {
    const valid = (rec.email || '').match(emailRe)

    if (!valid) {
      setSnack({ open: true, msg: 'Informe um e-mail válido', sev: 'warning' })

      return
    }

    const normalized = normalizeRecord(rec)

    setProfessores(prev => dedupeByEmail([normalized, ...prev]))
    setSelected(prev => [normalized.id, ...prev])
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const rows = parsePastedList(text)

      if (!rows.length) {
        setSnack({ open: true, msg: 'Nada válido encontrado na área de transferência', sev: 'info' })

        return
      }

      setProfessores(prev => dedupeByEmail([...rows, ...prev]))
      setSelected(prev => [...new Set([...rows.map(r => r.id), ...prev])])
      setSnack({ open: true, msg: `Adicionados ${rows.length} da área de transferência`, sev: 'success' })
    } catch {
      setSnack({ open: true, msg: 'Não consegui ler a área de transferência', sev: 'warning' })
    }
  }

  const handleCSV = async file => {
    if (!file) return
    const text = await file.text()
    const rows = parseCSV(text)

    if (!rows.length) {
      setSnack({ open: true, msg: 'CSV sem linhas válidas', sev: 'info' })

      return
    }

    setProfessores(prev => dedupeByEmail([...rows, ...prev]))
    setSelected(prev => [...new Set([...rows.map(r => r.id), ...prev])])
    setSnack({ open: true, msg: `Importados ${rows.length} do CSV`, sev: 'success' })
  }

  const removeSelected = () => {
    if (!selected.length) return
    setProfessores(prev => prev.filter(r => !selected.includes(r.id)))
    setSelected([])
  }

  // ---------- Envio ----------
  const handleSend = async () => {
    try {
      if (!selectedRows.length) {
        setSnack({ open: true, msg: 'Selecione pelo menos um professor', sev: 'info' })

        return
      }

      setSending(true)
      setReport('')

      const payload = {
        fromName,
        fromEmail,
        subject,
        testMode,
        testEmail,
        recipients: selectedRows.map(r => ({
          name: r.full_name || 'Professor',
          email: r.email
        })),
        template: preview,
        linkCadastro
      }

      // 🔧 Rota certa + blindagem de resposta
      const res = await fetch('/api/send-precadastro-professores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const ct = res.headers.get('content-type') || ''
      let data

      if (ct.includes('application/json')) {
        data = await res.json()
      } else {
        const text = await res.text()

        throw new Error(text?.slice(0, 300) || 'A API retornou uma resposta não-JSON')
      }

      if (!res.ok) throw new Error(data?.error || 'Falha ao enviar e-mails')

      setSnack({ open: true, msg: `Enviado: ${data.sent} | Falhas: ${data.failed}`, sev: 'success' })
      setReport(data.report || '')
    } catch (err) {
      setSnack({ open: true, msg: err?.message || 'Erro no envio', sev: 'error' })
    } finally {
      setSending(false)
    }
  }

  // ---------- Estados do formulário de adição manual ----------
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')

  // ---------- Render ----------
  return (
    <Grid container spacing={4}>
      <Grid item xs={12}>
        <Card>
          <CardHeader
            title='Pré-Cadastro de Professores'
            subheader='Cadastre manualmente, cole uma lista ou importe CSV'
          />
          <CardContent>
            <Stack spacing={3}>
              {/* remetente */}
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  label='Remetente (Nome)'
                  value={fromName}
                  onChange={e => setFromName(e.target.value)}
                  fullWidth
                  size={fieldSize}
                />
                <TextField
                  label='Remetente (E-mail)'
                  value={fromEmail}
                  onChange={e => setFromEmail(e.target.value)}
                  fullWidth
                  size={fieldSize}
                />
              </Stack>

              <TextField
                label='Assunto'
                value={subject}
                onChange={e => setSubject(e.target.value)}
                fullWidth
                size={fieldSize}
              />

              {/* link + busca */}
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  label='Link de pré-cadastro'
                  value={linkCadastro}
                  onChange={e => setLinkCadastro(e.target.value)}
                  fullWidth
                  size={fieldSize}
                />
                <TextField
                  label='Pesquisar (nome, e-mail, área, depto)'
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position='end'>
                        <SearchIcon />
                      </InputAdornment>
                    )
                  }}
                  fullWidth
                  size={fieldSize}
                />
              </Stack>

              {/* corpo */}
              <TextField
                label='Corpo do e-mail'
                value={preview}
                onChange={e => setPreview(e.target.value)}
                helperText='Use {{name}} e {{link}} como variáveis'
                multiline
                minRows={isMobile ? 4 : 6}
                fullWidth
                size={fieldSize}
              />

              {/* Importação e adição manual */}
              <Card variant='outlined'>
                <CardHeader title='Adicionar Professores' />
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                      <TextField
                        label='Nome'
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        fullWidth
                        size={fieldSize}
                      />
                      <TextField
                        label='E-mail'
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                        fullWidth
                        size={fieldSize}
                      />
                    </Stack>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={2}
                      alignItems={{ xs: 'stretch', sm: 'center' }}
                    >
                      <Button
                        variant='contained'
                        startIcon={<AddIcon />}
                        onClick={() => {
                          addManual({ full_name: newName, email: newEmail })
                          setNewName('')
                          setNewEmail('')
                        }}
                        fullWidth={isMobile}
                      >
                        Adicionar
                      </Button>

                      <Box flexGrow={1} display={{ xs: 'none', sm: 'block' }} />

                      <input
                        id='csv-input'
                        type='file'
                        accept='.csv,text/csv'
                        style={{ display: 'none' }}
                        onChange={e => handleCSV(e.target.files?.[0])}
                      />
                      <label htmlFor='csv-input' style={{ width: isMobile ? '100%' : 'auto' }}>
                        <Button variant='outlined' startIcon={<UploadFileIcon />} component='span' fullWidth={isMobile}>
                          Importar CSV
                        </Button>
                      </label>

                      <Tooltip title='Ler nomes/emails da sua área de transferência'>
                        <Button variant='outlined' onClick={handlePaste} fullWidth={isMobile}>
                          Colar da área de transferência
                        </Button>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              {/* contadores */}
              <Box display='flex' flexWrap='wrap' gap={1}>
                <Chip label={`Carregados: ${professores.length}`} />
                <Chip color='primary' label={`Selecionados: ${selected.length}`} />
              </Box>

              <Divider />

              {/* lista/tabela */}
              {isMobile ? (
                // ----- MOBILE: lista de cards -----
                <Stack spacing={1}>
                  {filtered.map(r => (
                    <Card key={r.id} variant='outlined' sx={{ p: 1 }}>
                      <Stack direction='row' alignItems='center' spacing={1}>
                        <Checkbox
                          checked={selected.includes(r.id)}
                          onChange={e => toggleOne(r.id, e.target.checked)}
                          sx={{ p: 0.5 }}
                        />
                        <Box>
                          <Typography fontWeight={600} variant='body1'>
                            {r.full_name || '—'}
                          </Typography>
                          <Typography variant='body2' sx={{ wordBreak: 'break-all' }}>
                            {r.email}
                          </Typography>
                          {(r.area || r.dept) && (
                            <Typography variant='caption' color='text.secondary'>
                              {[r.area, r.dept].filter(Boolean).join(' · ')}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              ) : (
                // ----- DESKTOP/TABLET: tabela com scroll -----
                <TableContainer component={Paper} variant='outlined' sx={{ maxHeight: 560 }}>
                  <Table size='small' stickyHeader aria-label='professores'>
                    <TableHead>
                      <TableRow>
                        <TableCell width={48}>
                          <Checkbox
                            checked={selected.length > 0 && selected.length === filtered.length}
                            indeterminate={selected.length > 0 && selected.length < filtered.length}
                            onChange={e => toggleAll(e.target.checked)}
                          />
                        </TableCell>
                        <TableCell>Nome</TableCell>
                        <TableCell>E-mail</TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Área</TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Departamento</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filtered.map(r => (
                        <TableRow key={r.id} hover>
                          <TableCell>
                            <Checkbox
                              checked={selected.includes(r.id)}
                              onChange={e => toggleOne(r.id, e.target.checked)}
                            />
                          </TableCell>
                          <TableCell>{r.full_name || '—'}</TableCell>
                          <TableCell
                            sx={{ maxWidth: 320, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}
                          >
                            {r.email}
                          </TableCell>
                          <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{r.area || '—'}</TableCell>
                          <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{r.dept || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* ações */}
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap='wrap'>
                  <Button variant='outlined' startIcon={<ContentCopyIcon />} onClick={copyList} fullWidth={isMobile}>
                    Copiar lista
                  </Button>

                  <Button color='inherit' onClick={removeSelected} fullWidth={isMobile}>
                    Remover selecionados
                  </Button>
                </Stack>

                <Box flexGrow={1} />

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                >
                  <Stack direction='row' spacing={1} alignItems='center'>
                    <Checkbox checked={testMode} onChange={e => setTestMode(e.target.checked)} sx={{ ml: -1 }} />
                    <Typography variant='body2'>Modo teste</Typography>
                  </Stack>

                  <TextField
                    size='small'
                    label='Enviar teste para'
                    value={testEmail}
                    onChange={e => setTestEmail(e.target.value)}
                    sx={{ minWidth: { xs: '100%', sm: 280 } }}
                    fullWidth={isMobile}
                  />
                  <Tooltip title='Envia somente para o e-mail de teste quando ativado'>
                    <Chip label='Somente teste' />
                  </Tooltip>
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button
                    color='inherit'
                    startIcon={<RestartAltIcon />}
                    onClick={() => setSelected(filtered.map(p => p.id))}
                    fullWidth={isMobile}
                  >
                    Selecionar filtrados
                  </Button>
                  <Button
                    variant='contained'
                    startIcon={<SendIcon />}
                    disabled={sending || selected.length === 0}
                    onClick={handleSend}
                    fullWidth={isMobile}
                  >
                    {sending ? 'Enviando…' : `Enviar (${selected.length})`}
                  </Button>
                </Stack>
              </Stack>

              {/* relatório do envio */}
              {report ? (
                <Card variant='outlined'>
                  <CardHeader title='Relatório do envio' />
                  <CardContent>
                    <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{report}</pre>
                  </CardContent>
                </Card>
              ) : null}

              {/* snackbar */}
              <Snackbar
                open={snack.open}
                autoHideDuration={5000}
                onClose={() => setSnack(s => ({ ...s, open: false }))}
              >
                <Alert onClose={() => setSnack(s => ({ ...s, open: false }))} severity={snack.sev} variant='filled'>
                  {snack.msg}
                </Alert>
              </Snackbar>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
