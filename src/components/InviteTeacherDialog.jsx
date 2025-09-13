// components/InviteTeacherDialog.jsx
'use client'

import { useState } from 'react'

import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack, Alert } from '@mui/material'

export default function InviteTeacherDialog({ open, onClose }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState(null)

  const handleInvite = async () => {
    setSending(true)
    setMsg(null)

    try {
      const res = await fetch('/api/teachers/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name })
      })

      const json = await res.json()

      if (!res.ok) throw new Error(json.error || 'Falha ao convidar professor.')

      setMsg({ sev: 'success', text: 'Convite enviado! Verifique o e-mail do professor.' })
      setEmail('')
      setName('')
    } catch (e) {
      setMsg({ sev: 'error', text: e.message })
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>Convidar professor</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {msg && <Alert severity={msg.sev}>{msg.text}</Alert>}
          <TextField label='Nome (opcional)' value={name} onChange={e => setName(e.target.value)} fullWidth />
          <TextField label='E-mail *@fecap.br' value={email} onChange={e => setEmail(e.target.value)} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
        <Button disabled={sending || !email} variant='contained' onClick={handleInvite}>
          {sending ? 'Enviando…' : 'Enviar convite'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
