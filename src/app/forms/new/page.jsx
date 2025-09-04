// src/app/forms/new/page.jsx
'use client'

import Grid from '@mui/material/Grid'

import NewFormBuilder from '@/@views/forms/NewFormBuilder'

export default function NewFormPage() {
  return (
    <Grid container spacing={6} justifyContent='center'>
      <Grid item xs={12} md={6}>
        <NewFormBuilder />
      </Grid>
    </Grid>
  )
}
