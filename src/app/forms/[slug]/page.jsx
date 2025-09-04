// src/app/forms/[slug]/page.jsx
'use client'

import { useEffect, useState } from 'react'

import { useParams, useRouter } from 'next/navigation'

// MUI
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Checkbox from '@mui/material/Checkbox'
import FormGroup from '@mui/material/FormGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'

// Libs
import { getFormBySlug, submitForm } from '@/libs/forms'
import { supabase } from '@/libs/supabaseAuth'

export default function FormViewerPage() {
  const { slug } = useParams()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({}) // {question_id: value}

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError('')

        const { form, questions } = await getFormBySlug(slug)

        if (!form?.is_published) {
          throw new Error('Formulário não publicado.')
        }

        // Assina a capa (se existir). Não precisa abrir o bucket ao público.
        let cover_url = ''

        if (form.cover_path) {
          const { data, error: sErr } = await supabase.storage
            .from('form_covers')
            .createSignedUrl(form.cover_path, 60 * 60) // 1h

          if (!sErr) cover_url = data?.signedUrl || ''
        }

        setForm({ ...form, cover_url })
        setQuestions(questions || [])
      } catch (e) {
        setError(e?.message || 'Formulário indisponível.')
      } finally {
        setLoading(false)
      }
    }

    if (slug) load()
  }, [slug])

  const setAnswer = (qid, val) => setAnswers(a => ({ ...a, [qid]: val }))

  // Normaliza options vindo do banco (string -> array)
  const normalizeOptions = o =>
    Array.isArray(o)
      ? o
      : typeof o === 'string'
        ? o
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        : []

  const validate = () => {
    for (const q of questions) {
      if (q.required) {
        const v = answers[q.id]

        if (q.type === 'checkbox') {
          if (!Array.isArray(v) || v.length === 0) return `Responda: ${q.label}`
        } else if (v == null || String(v).trim() === '') {
          return `Responda: ${q.label}`
        }
      }
    }

    return null
  }

  const handleSubmit = async e => {
    e.preventDefault()
    const err = validate()

    if (err) {
      alert(err)

      return
    }

    try {
      await submitForm({ formId: form.id, answersMap: answers })
      alert('Respostas enviadas com sucesso!')
      router.push('/forms') // redireciona para a lista/meus formulários
    } catch {
      alert('Falha ao enviar respostas.')
    }
  }

  if (loading) return <LinearProgress />
  if (error || !form) return <Alert severity='error'>{error || 'Erro ao carregar'}</Alert>

  return (
    <Card>
      <CardHeader title={form.title} subheader={form.description} />
      <CardContent>
        {form.cover_url ? (
          <img
            src={form.cover_url}
            alt='Capa do formulário'
            style={{ maxHeight: 240, borderRadius: 8, marginBottom: 16, width: '100%', objectFit: 'cover' }}
          />
        ) : null}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {questions.map(q => (
              <Grid item xs={12} key={q.id}>
                {q.type === 'short_text' && (
                  <TextField
                    fullWidth
                    label={q.label + (q.required ? ' *' : '')}
                    value={answers[q.id] || ''}
                    onChange={e => setAnswer(q.id, e.target.value)}
                  />
                )}

                {q.type === 'long_text' && (
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    label={q.label + (q.required ? ' *' : '')}
                    value={answers[q.id] || ''}
                    onChange={e => setAnswer(q.id, e.target.value)}
                  />
                )}

                {q.type === 'email' && (
                  <TextField
                    fullWidth
                    type='email'
                    label={q.label + (q.required ? ' *' : '')}
                    value={answers[q.id] || ''}
                    onChange={e => setAnswer(q.id, e.target.value)}
                  />
                )}

                {q.type === 'number' && (
                  <TextField
                    fullWidth
                    type='number'
                    label={q.label + (q.required ? ' *' : '')}
                    value={answers[q.id] || ''}
                    onChange={e => setAnswer(q.id, e.target.value)}
                  />
                )}

                {q.type === 'select' && (
                  <TextField
                    select
                    fullWidth
                    label={q.label + (q.required ? ' *' : '')}
                    value={answers[q.id] || ''}
                    onChange={e => setAnswer(q.id, e.target.value)}
                  >
                    {normalizeOptions(q.options).map(opt => (
                      <MenuItem key={opt} value={opt}>
                        {opt}
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                {q.type === 'checkbox' && (
                  <FormGroup>
                    <Typography sx={{ mb: 1 }}>
                      {q.label}
                      {q.required ? ' *' : ''}
                    </Typography>
                    {normalizeOptions(q.options).map(opt => {
                      const arr = Array.isArray(answers[q.id]) ? answers[q.id] : []
                      const checked = arr.includes(opt)

                      return (
                        <FormControlLabel
                          key={opt}
                          control={
                            <Checkbox
                              checked={checked}
                              onChange={(_, c) => {
                                const next = c ? [...arr, opt] : arr.filter(x => x !== opt)

                                setAnswer(q.id, next)
                              }}
                            />
                          }
                          label={opt}
                        />
                      )
                    })}
                  </FormGroup>
                )}
              </Grid>
            ))}

            <Grid item xs={12} className='flex gap-2'>
              <Button variant='contained' type='submit'>
                Enviar
              </Button>
            </Grid>
          </Grid>
        </form>
      </CardContent>
    </Card>
  )
}
