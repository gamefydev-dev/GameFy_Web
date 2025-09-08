'use client'
import React from 'react'

import { useRouter } from 'next/navigation'

import { Box, Typography } from '@mui/material'

import EventForm from '../../../../components/events/EventForm'

export default function NewEventPage() {
  const router = useRouter()

  return (
    <Box>
      <Typography variant='h4' fontWeight={900} sx={{ mb: 2 }}>
        Novo evento
      </Typography>
      <EventForm onSaved={ev => router.push(`/admin/eventos/${ev.id}`)} />
    </Box>
  )
}
