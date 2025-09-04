// src/app/forms/page.jsx
'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'

// MUI
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Chip from '@mui/material/Chip'

// Supabase
import { supabase } from '@/libs/supabaseAuth'

export default function MyFormsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    const { data: u } = await supabase.auth.getUser()
    const uid = u?.user?.id

    if (!uid) return

    const { data } = await supabase
      .from('forms')
      .select('id, title, slug, is_published, updated_at')
      .eq('owner', uid)
      .order('updated_at', { ascending: false })

    setRows(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  const handleDelete = async id => {
    if (!confirm('Tem certeza que deseja excluir este formulário?')) return

    setLoading(true)

    try {
      const { error } = await supabase.from('forms').delete().eq('id', id)

      if (error) throw error
      setRows(prev => prev.filter(f => f.id !== id))
    } catch (err) {
      console.error(err)
      alert('Erro ao excluir formulário.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title='Meus Formulários'
        subheader='Gerencie e acesse seus formulários'
        action={
          <Button component={Link} href='/forms/new' variant='contained'>
            Novo formulário
          </Button>
        }
      />
      <CardContent>
        <Grid container spacing={3}>
          {rows.map(r => (
            <Grid item xs={12} md={6} key={r.id}>
              <Card variant='outlined'>
                <CardContent className='flex items-center justify-between gap-3'>
                  <div className='flex flex-col'>
                    <Typography variant='h6'>{r.title}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                      /forms/{r.slug}
                    </Typography>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Chip
                      size='small'
                      variant='tonal'
                      color={r.is_published ? 'success' : 'secondary'}
                      label={r.is_published ? 'Publicado' : 'Rascunho'}
                    />
                    <Button
                      component={Link}
                      href={`/forms/${r.slug}`}
                      variant='outlined'
                      disabled={!r.is_published}
                      title={r.is_published ? 'Abrir formulário' : 'Publique para visualizar'}
                    >
                      Abrir
                    </Button>
                    <Button variant='outlined' color='error' disabled={loading} onClick={() => handleDelete(r.id)}>
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Grid>
          ))}

          {!rows.length && (
            <Grid item xs={12}>
              <Typography color='text.secondary'>Você ainda não criou nenhum formulário.</Typography>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  )
}
