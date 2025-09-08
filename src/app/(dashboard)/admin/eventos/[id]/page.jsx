'use client'

import React, { useEffect, useState } from 'react'

import { useParams, useRouter } from 'next/navigation'

import { Box, Typography, CircularProgress } from '@mui/material'

import { supabase } from '../../../../../libs/supabaseAuth' // 5 níveis até src/lib
import EventForm from '../../../../../components/events/EventForm' // 5 níveis até src/components

export default function EditEventPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id
  const [ev, setEv] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const { data, error } = await supabase.from('events').select('*').eq('id', id).single()

      if (!error) setEv(data)
      setLoading(false)
    })()
  }, [id])

  if (loading) return <CircularProgress />
  if (!ev) return <Typography>Evento não encontrado.</Typography>

  return (
    <Box>
      <Typography variant='h4' fontWeight={900} sx={{ mb: 2 }}>
        {ev.title}
      </Typography>
      <EventForm initial={ev} onSaved={() => router.refresh()} />
    </Box>
  )
}
