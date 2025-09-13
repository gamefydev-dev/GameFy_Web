// components/AccountSecurity.jsx
'use client'
import { useState } from 'react'

import { Stack, TextField, Button, Alert } from '@mui/material'

import { supabase } from '@/libs/supabaseAuth'

export default function AccountSecurity() {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const changePassword = async () => {
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.updateUser({ password: pw })

    if (error) setMsg({ sev: 'error', text: error.message })
    else setMsg({ sev: 'success', text: 'Senha atualizada!' })
    setBusy(false)
    setPw('')
  }

  return (
    <Stack spacing={2}>
      {msg && <Alert severity={msg.sev}>{msg.text}</Alert>}
      <TextField label='Nova senha' type='password' value={pw} onChange={e => setPw(e.target.value)} />
      <Button disabled={!pw || busy} variant='contained' onClick={changePassword}>
        {busy ? 'Salvando…' : 'Atualizar senha'}
      </Button>
    </Stack>
  )
}
