// src/@views/forms/NewFormBuilder.jsx
'use client'

import { useRef, useState } from 'react'

import { useRouter } from 'next/navigation'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Chip from '@mui/material/Chip'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import LinearProgress from '@mui/material/LinearProgress'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import { uploadFormCover, upsertForm, replaceQuestions } from '@/libs/forms'
import { supabase } from '@/libs/supabaseAuth'

const TYPES = [
  { value: 'short_text', label: 'Texto curto' },
  { value: 'long_text', label: 'Texto longo' },
  { value: 'email', label: 'E-mail' },
  { value: 'number', label: 'Número' },
  { value: 'select', label: 'Seleção única' },
  { value: 'checkbox', label: 'Múltipla escolha' }
]

export default function NewFormBuilder() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [slug, setSlug] = useState('')
  const [formId, setFormId] = useState(null)
  const [questions, setQuestions] = useState([])

  const fileRef = useRef(null)
  const [coverUrl, setCoverUrl] = useState('')
  const [uploading, setUploading] = useState(false)

  const [busy, setBusy] = useState(false)
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' })

  const addQuestion = type => setQuestions(q => [...q, { type, label: '', required: false, options: [] }])
  const updateQuestion = (idx, patch) => setQuestions(q => q.map((qi, i) => (i === idx ? { ...qi, ...patch } : qi)))
  const removeQuestion = idx => setQuestions(q => q.filter((_, i) => i !== idx))

  const handleUploadCover = async e => {
    const file = e.target.files?.[0]

    if (!file) return

    // (opcional) limite de 5MB
    if (file.size > 5 * 1024 * 1024) {
      setSnack({ open: true, message: 'Arquivo muito grande (máx. 5MB).', severity: 'warning' })
      if (fileRef.current) fileRef.current.value = ''

      return
    }

    setUploading(true)

    try {
      let currentId = formId

      if (!currentId) {
        const saved = await upsertForm({
          id: null,
          title: title || 'Sem título',
          description,
          slug: slug || '',
          is_published: false
        })

        currentId = saved.id
        setFormId(currentId)
      }

      const { url, path } = await uploadFormCover(file, currentId)

      setCoverUrl(url)

      const { error: updErr } = await supabase.from('forms').update({ cover_path: path }).eq('id', currentId)

      if (updErr) throw updErr

      setSnack({ open: true, message: 'Capa enviada com sucesso!', severity: 'success' })
    } catch (err) {
      setSnack({
        open: true,
        message: (err?.message || '').includes('Row Level Security')
          ? 'Permissão negada no bucket form_covers. Verifique as policies RLS.'
          : err?.message || 'Falha ao enviar a capa.'
      })
      setSnack(s => ({ ...s, severity: 'error' }))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const autoSlug = v =>
    v
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

  const saveDraft = async () => {
    if (!title.trim()) {
      setSnack({ open: true, message: 'Dê um título ao formulário.', severity: 'warning' })

      return
    }

    setBusy(true)

    try {
      const saved = await upsertForm({
        id: formId,
        title,
        description,
        slug: slug || autoSlug(title),
        is_published: false
      })

      setFormId(saved.id)
      await replaceQuestions(saved.id, questions)
      setSnack({ open: true, message: 'Rascunho salvo!', severity: 'success' })
    } catch (e) {
      setSnack({ open: true, message: e?.message || 'Erro ao salvar rascunho.', severity: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const publish = async () => {
    if (!title.trim()) {
      setSnack({ open: true, message: 'Dê um título ao formulário.', severity: 'warning' })

      return
    }

    if (!slug.trim()) {
      setSnack({ open: true, message: 'Defina um slug (URL).', severity: 'warning' })

      return
    }

    setBusy(true)

    try {
      const saved = await upsertForm({
        id: formId,
        title,
        description,
        slug,
        is_published: true
      })

      setFormId(saved.id)
      await replaceQuestions(saved.id, questions)
      setSnack({ open: true, message: 'Formulário publicado!', severity: 'success' })
      router.push(`/forms/${saved.slug}`)
    } catch (e) {
      setSnack({ open: true, message: e?.message || 'Erro ao publicar.', severity: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const applyTemplatePI = () => {
    setTitle('Formulário de grupos PI 2025_2')
    setDescription(
      `Neste formulário você deve cadastrar seu grupo. Leia as instruções:
1) Crie uma conta no GitHub antes de fornecer o e-mail.
2) Use um nome claro no GitHub.
3) Convites chegam no e-mail (verifique SPAM).
4) Dados errados podem gerar dedução de pontos.
5) Convite dura 7 dias; após 2 dias sem receber, contate o professor.
7) Reenvio deduz 1 ponto por vez; atrasos 0,25 por semana.
8) Quinto participante somente com autorização.`
    )
    setSlug('pi-2025-2-grupos')
    setQuestions([
      { type: 'email', label: 'E-mail', required: true },
      { type: 'select', label: 'Qual o seu curso?', required: true, options: ['ADS', 'CCOMP', 'CCOMP_Matutino'] },
      { type: 'select', label: 'Escolha um período', required: true, options: ['1', '2', '3', '4', '5', '6'] },
      { type: 'short_text', label: 'Nome completo do integrante 1', required: true },
      { type: 'short_text', label: 'Nome completo do integrante 2', required: true },
      { type: 'short_text', label: 'Nome completo do integrante 3', required: true },
      { type: 'short_text', label: 'Nome completo do integrante 4', required: false },
      { type: 'short_text', label: 'Nome completo do integrante 5 (somente com autorização)', required: false },
      { type: 'email', label: 'Email do GitHub do integrante 1', required: true },
      { type: 'email', label: 'Email do GitHub do integrante 2', required: true },
      { type: 'email', label: 'Email do GitHub do integrante 3', required: true },
      { type: 'email', label: 'Email do GitHub do integrante 4', required: false },
      { type: 'email', label: 'Email do GitHub do integrante 5 (somente com autorização)', required: false },
      { type: 'short_text', label: 'Nome do Grupo', required: false },
      {
        type: 'checkbox',
        label: 'Todos os integrantes revisaram os dados e estão cientes do envio.',
        required: true,
        options: ['Todos estão cientes!']
      }
    ])
    setSnack({ open: true, message: 'Modelo aplicado!', severity: 'info' })
  }

  return (
    <Card>
      <CardHeader
        title='Criar Formulário'
        subheader='Monte seu formulário e publique para os alunos'
        action={
          <div className='flex gap-2'>
            <Tooltip title='Salvar rascunho'>
              <span>
                <Button variant='outlined' onClick={saveDraft} disabled={busy || uploading}>
                  {busy ? 'Salvando…' : 'Salvar rascunho'}
                </Button>
              </span>
            </Tooltip>
            <Tooltip title='Publicar formulário'>
              <span>
                <Button variant='contained' onClick={publish} disabled={busy || uploading}>
                  {busy ? 'Publicando…' : 'Publicar'}
                </Button>
              </span>
            </Tooltip>
          </div>
        }
      />
      {(busy || uploading) && <LinearProgress />}

      <CardContent>
        <Grid container spacing={4}>
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label='Título'
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder='Ex.: Formulário de grupos PI 2025_2'
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label='Slug (URL)'
              value={slug}
              onChange={e => setSlug(e.target.value)}
              placeholder='ex.: pi-2025-2-grupos'
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              minRows={4}
              label='Descrição / Instruções'
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </Grid>

          <Grid item xs={12}>
            <div className='flex items-center gap-3'>
              <Button component='label' variant='outlined' disabled={uploading}>
                {uploading ? 'Enviando capa…' : 'Enviar capa'}
                <input ref={fileRef} hidden type='file' accept='image/*' onChange={handleUploadCover} />
              </Button>
              {coverUrl && <Chip label='Capa enviada' color='success' variant='tonal' />}
            </div>
            <Typography variant='caption' color='text.secondary'>
              Formatos aceitos: JPG, PNG, WEBP. Tamanho máx. 5MB.
            </Typography>
            {coverUrl ? (
              <img
                src={coverUrl}
                alt='Capa'
                style={{ marginTop: 12, borderRadius: 12, maxHeight: 220, width: '100%', objectFit: 'cover' }}
              />
            ) : null}
          </Grid>

          <Grid item xs={12} className='flex items-center gap-2 flex-wrap'>
            <Button size='small' variant='contained' onClick={() => addQuestion('short_text')}>
              + Texto curto
            </Button>
            <Button size='small' variant='contained' onClick={() => addQuestion('long_text')}>
              + Texto longo
            </Button>
            <Button size='small' variant='contained' onClick={() => addQuestion('email')}>
              + E-mail
            </Button>
            <Button size='small' variant='contained' onClick={() => addQuestion('number')}>
              + Número
            </Button>
            <Button size='small' variant='contained' onClick={() => addQuestion('select')}>
              + Seleção
            </Button>
            <Button size='small' variant='contained' onClick={() => addQuestion('checkbox')}>
              + Múltipla
            </Button>
            <Divider flexItem className='mx-2' />
            <Button size='small' variant='outlined' onClick={applyTemplatePI}>
              Usar modelo PI 2025_2
            </Button>
          </Grid>

          {questions.map((q, idx) => (
            <Grid key={idx} item xs={12}>
              <Card variant='outlined'>
                <CardContent className='flex flex-col gap-3'>
                  <div className='flex gap-6 items-center flex-wrap'>
                    <TextField
                      select
                      SelectProps={{ native: true }}
                      label='Tipo'
                      value={q.type}
                      onChange={e => updateQuestion(idx, { type: e.target.value })}
                      sx={{ minWidth: 220 }}
                    >
                      {TYPES.map(t => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </TextField>

                    <FormControlLabel
                      control={
                        <Switch checked={q.required} onChange={(_, c) => updateQuestion(idx, { required: c })} />
                      }
                      label='Obrigatória'
                    />

                    <IconButton color='error' onClick={() => removeQuestion(idx)}>
                      <i className='ri-delete-bin-7-line' />
                    </IconButton>
                  </div>

                  <TextField
                    label='Enunciado / Rótulo'
                    fullWidth
                    value={q.label}
                    onChange={e => updateQuestion(idx, { label: e.target.value })}
                  />

                  {(q.type === 'select' || q.type === 'checkbox') && (
                    <TextField
                      label='Opções (separe por vírgula)'
                      fullWidth
                      value={(q.options || []).join(', ')}
                      onChange={e =>
                        updateQuestion(idx, {
                          options: e.target.value
                            .split(',')
                            .map(s => s.trim())
                            .filter(Boolean)
                        })
                      }
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </CardContent>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnack(s => ({ ...s, open: false }))}
          severity={snack.severity}
          variant='filled'
          sx={{ width: '100%' }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Card>
  )
}
