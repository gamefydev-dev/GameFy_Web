// src/app/(dashboard)/precadastro/page.jsx
'use client'

import React, { useEffect, useMemo, useState } from 'react'

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
  Checkbox,
  Button,
  Snackbar,
  Alert,
  LinearProgress,
  Tooltip,
  Typography,
  MenuItem
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import SendIcon from '@mui/icons-material/Send'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

// Supabase client que você já tem no projeto
import { supabase } from '@/libs/supabaseAuth'

// ----------------- Helpers -----------------
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

// ----------------- Página -----------------
export default function PreCadastroPage() {
  const [loading, setLoading] = useState(false)
  const [students, setStudents] = useState([]) // {id, full_name, email, category, semester, turma}
  const [selected, setSelected] = useState([])
  const [search, setSearch] = useState('')

  const [subject, setSubject] = useState('[GameFy] Pré-cadastro de aluno')
  const [fromName, setFromName] = useState('GameFy')

  // no client não dá para ler env diretamente; deixe editável
  const [fromEmail, setFromEmail] = useState('auto@gamefy.education')
  const [replyTo, setReplyTo] = useState('contato@gamefy.education')

  const [preview, setPreview] = useState(
    'Olá {{name}},\n\nBem-vindo(a) ao GameFy! Para concluir seu pré-cadastro, acesse: {{link}}\n\nAbraços,\nEquipe GameFy'
  )

  const [linkCadastro, setLinkCadastro] = useState('https://www.gamefy.education/register')

  const [testMode, setTestMode] = useState(false)
  const [testEmail, setTestEmail] = useState('seuemail@exemplo.com')

  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'info' })
  const [sending, setSending] = useState(false)
  const [report, setReport] = useState('')

  // filtros
  const [categories, setCategories] = useState([])
  const [semesters, setSemesters] = useState([])
  const [filterCategory, setFilterCategory] = useState('ALL')
  const [filterSemester, setFilterSemester] = useState('ALL')

  // ---------- Carregamento da VIEW ----------
  useEffect(() => {
    async function fetchView() {
      try {
        setLoading(true)

        const { data, error } = await supabase
          .from('v_precadastro_normalizado')
          .select('member_id, full_name, email, category, semester, group_name')

        if (error) throw error

        const mapped = (data || []).map(r => ({
          id: r.member_id,
          full_name: r.full_name,
          email: r.email,
          category: r.category || '—',
          semester: r.semester ?? '—',
          turma: r.group_name || '—'
        }))

        const list = dedupeByEmail(mapped)

        const cats = Array.from(new Set(list.map(x => x.category).filter(Boolean))).sort()

        const sems = Array.from(new Set(list.map(x => x.semester).filter(v => v !== null && v !== '—'))).sort((a, b) =>
          String(a).localeCompare(String(b), 'pt-BR', { numeric: true })
        )

        setStudents(list)
        setSelected(list.map(s => s.id))
        setCategories(cats)
        setSemesters(sems)
        setFilterCategory('ALL')
        setFilterSemester('ALL')
      } catch (err) {
        setSnack({ open: true, msg: (err && err.message) || 'Erro ao carregar dados', sev: 'error' })
      } finally {
        setLoading(false)
      }
    }

    fetchView()
  }, [])

  // ---------- Filtro ----------
  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase()

    return students.filter(s => {
      const byText =
        !q ||
        String(s.full_name || '')
          .toLowerCase()
          .includes(q) ||
        String(s.email || '')
          .toLowerCase()
          .includes(q) ||
        String(s.turma || '')
          .toLowerCase()
          .includes(q)

      const byCat = filterCategory === 'ALL' || s.category === filterCategory
      const bySem = filterSemester === 'ALL' || String(s.semester) === String(filterSemester)

      return byText && byCat && bySem
    })
  }, [students, search, filterCategory, filterSemester])

  // ---------- Seleção ----------
  const toggleAll = checked => setSelected(checked ? filtered.map(s => s.id) : [])

  const toggleOne = (id, checked) =>
    setSelected(prev => (checked ? Array.from(new Set([...prev, id])) : prev.filter(x => x !== id)))

  const selectedRows = useMemo(() => students.filter(s => selected.includes(s.id)), [students, selected])

  // ---------- Envio ----------
  const handleSend = async () => {
    try {
      setSending(true)
      setReport('')

      const payload = {
        fromName,
        fromEmail,
        replyTo,
        subject,
        testMode,
        testEmail,
        recipients: selectedRows.map(r => ({
          name: r.full_name || 'Aluno',
          email: r.email,
          category: r.category || null,
          semester: r.semester ?? null,
          turma: r.turma || null
        })),
        template: preview,
        linkCadastro
      }

      const res = await fetch('/api/send-precadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const json = await res.json()

      if (!res.ok) throw new Error(json?.error || 'Falha ao enviar e-mails')

      setSnack({ open: true, msg: `Enviado: ${json.sent} | Falhas: ${json.failed}`, sev: 'success' })
      setReport(json.report || '')
    } catch (err) {
      setSnack({ open: true, msg: err?.message || 'Erro no envio', sev: 'error' })
    } finally {
      setSending(false)
    }
  }

  // ---------- Utilitário ----------
  const copyList = async () => {
    const text = selectedRows.map(r => `${r.full_name || ''} <${r.email}>`).join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setSnack({ open: true, msg: 'Lista copiada', sev: 'success' })
    } catch {
      setSnack({ open: true, msg: 'Não foi possível copiar', sev: 'warning' })
    }
  }

  return (
    <Grid container spacing={4}>
      <Grid item xs={12}>
        <Card>
          <CardHeader
            title='Pré-Cadastro de Alunos (View SQL → Umbler)'
            subheader='Dados já categorizados pela view v_precadastro_normalizado'
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
                />
                <TextField
                  label='Remetente (E-mail/Conta Umbler)'
                  value={fromEmail}
                  onChange={e => setFromEmail(e.target.value)}
                  fullWidth
                />
                <TextField label='Reply-To' value={replyTo} onChange={e => setReplyTo(e.target.value)} fullWidth />
              </Stack>

              <TextField label='Assunto' value={subject} onChange={e => setSubject(e.target.value)} fullWidth />

              {/* filtros */}
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  label='Link de pré-cadastro'
                  value={linkCadastro}
                  onChange={e => setLinkCadastro(e.target.value)}
                  fullWidth
                />
                <TextField
                  select
                  label='Categoria'
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  sx={{ minWidth: 200 }}
                >
                  <MenuItem value='ALL'>Todas</MenuItem>
                  {categories.map(c => (
                    <MenuItem key={c || '—'} value={c}>
                      {c || '—'}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label='Semestre'
                  value={filterSemester}
                  onChange={e => setFilterSemester(e.target.value)}
                  sx={{ minWidth: 200 }}
                >
                  <MenuItem value='ALL'>Todos</MenuItem>
                  {semesters.map(s => (
                    <MenuItem key={String(s)} value={String(s)}>
                      {String(s)}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label='Pesquisar (nome, e-mail, turma)'
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
                />
              </Stack>

              {/* corpo */}
              <TextField
                label='Corpo do e-mail'
                value={preview}
                onChange={e => setPreview(e.target.value)}
                helperText='Use {{name}} e {{link}} como variáveis'
                multiline
                minRows={6}
                fullWidth
              />

              {/* contadores */}
              <Box>
                <Chip label={`Carregados: ${students.length}`} sx={{ mr: 1 }} />
                <Chip label={`Filtrados: ${filtered.length}`} sx={{ mr: 1 }} />
                <Chip color='primary' label={`Selecionados: ${selected.length}`} />
              </Box>

              <Divider />
              {loading && <LinearProgress />}

              {/* tabela */}
              <Box sx={{ overflowX: 'auto' }}>
                <Table size='small'>
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
                      <TableCell>Categoria</TableCell>
                      <TableCell>Semestre</TableCell>
                      <TableCell>Turma</TableCell>
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
                        <TableCell>{r.email}</TableCell>
                        <TableCell>{r.category}</TableCell>
                        <TableCell>{String(r.semester ?? '—')}</TableCell>
                        <TableCell>{r.turma || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>

              {/* ações */}
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                <Button variant='outlined' startIcon={<ContentCopyIcon />} onClick={copyList}>
                  Copiar lista
                </Button>

                <Stack direction='row' spacing={2} alignItems='center'>
                  <Checkbox checked={testMode} onChange={e => setTestMode(e.target.checked)} />
                  <Typography variant='body2'>Modo teste</Typography>
                  <TextField
                    size='small'
                    label='Enviar teste para'
                    value={testEmail}
                    onChange={e => setTestEmail(e.target.value)}
                    sx={{ minWidth: 320 }}
                  />
                  <Tooltip title='Envia somente para o e-mail de teste quando ativado'>
                    <Chip label='Somente teste' />
                  </Tooltip>
                </Stack>

                <Box flexGrow={1} />

                <Stack direction='row' spacing={2}>
                  <Button
                    color='inherit'
                    startIcon={<RestartAltIcon />}
                    onClick={() => setSelected(filtered.map(s => s.id))}
                  >
                    Selecionar filtrados
                  </Button>
                  <Button
                    variant='contained'
                    startIcon={<SendIcon />}
                    disabled={sending || selected.length === 0}
                    onClick={handleSend}
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
