'use client'

import { useState, useMemo } from 'react'

import {
  Box,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  Stack,
  Typography,
  Alert,
  Snackbar,
  FormControlLabel,
  Switch,
  InputAdornment,
  IconButton,
  CircularProgress
} from '@mui/material'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import SendIcon from '@mui/icons-material/Send'
import BoltIcon from '@mui/icons-material/Bolt'

function genStrongPassword(len = 12) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVXYZ'
  const lower = 'abcdefghijkmnpqrstuvxyz'
  const digits = '23456789'
  const symbols = '!@$%*?&#'
  const all = upper + lower + digits + symbols
  const pick = set => set[Math.floor(Math.random() * set.length)]
  let pwd = pick(upper) + pick(lower) + pick(digits) + pick(symbols)

  for (let i = pwd.length; i < len; i++) pwd += pick(all)

  return pwd
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}

export default function InviteTeachersClient() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [usePresetPassword, setUsePresetPassword] = useState(true)
  const [password, setPassword] = useState('Fecap@2025!')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ open: false, msg: '', severity: 'success' })

  const canSubmit = useMemo(() => {
    const hasEmail = email.trim().length > 5 && email.includes('@')
    const passOk = !usePresetPassword || (usePresetPassword && password.trim().length >= 8)

    return hasEmail && passOk
  }, [email, password, usePresetPassword])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit || loading) return

    try {
      setLoading(true)

      const payload = {
        email: email.trim(),
        name: name.trim() || undefined,
        password: usePresetPassword ? password || undefined : undefined
      }

      const res = await fetch('/api/teachers/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) throw new Error(data?.error || data?.message || `Erro ${res.status}`)
      setToast({
        open: true,
        severity: 'success',
        msg: usePresetPassword
          ? 'Professor criado com senha padrão. Ele poderá alterá-la depois.'
          : 'Convite enviado por e-mail (magic link).'
      })
      setName('')
    } catch (err) {
      setToast({ open: true, severity: 'error', msg: err.message || 'Falha ao enviar convite' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 820, mx: 'auto' }}>
      <Card variant='outlined'>
        <CardHeader
          title='Convidar Professores'
          subheader='Crie o usuário via magic link ou defina uma senha padrão (pode ser trocada).'
        />
        <CardContent>
          <Stack component='form' spacing={3} onSubmit={handleSubmit}>
            <TextField
              label='E-mail do professor'
              type='email'
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder='prof@fecap.br'
              fullWidth
              required
            />
            <TextField
              label='Nome (opcional)'
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder='Ex.: Prof. Maria Silva'
              fullWidth
            />
            <FormControlLabel
              control={<Switch checked={usePresetPassword} onChange={e => setUsePresetPassword(e.target.checked)} />}
              label='Usar senha pré-montada (desligue para enviar magic link)'
            />
            {usePresetPassword && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label='Senha padrão'
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  inputProps={{ minLength: 8 }}
                  fullWidth
                  required
                  helperText='Mínimo 8 caracteres.'
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position='end'>
                        <IconButton onClick={() => setShowPassword(v => !v)} edge='end'>
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
                <Button variant='outlined' onClick={() => setPassword(genStrongPassword())} startIcon={<BoltIcon />}>
                  Gerar senha forte
                </Button>
              </Stack>
            )}
            <Stack direction='row' spacing={2} alignItems='center'>
              <Button
                type='submit'
                variant='contained'
                disabled={!canSubmit || loading}
                startIcon={loading ? <CircularProgress size={18} /> : <SendIcon />}
              >
                {usePresetPassword ? 'Criar com senha padrão' : 'Enviar magic link'}
              </Button>
              <Typography variant='body2' color='text.secondary'>
                Domínio recomendado: <b>@fecap.br</b>
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Snackbar
        open={toast.open}
        autoHideDuration={5000}
        onClose={() => setToast(t => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToast(t => ({ ...t, open: false }))}
          severity={toast.severity}
          variant='filled'
          sx={{ width: '100%' }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}
