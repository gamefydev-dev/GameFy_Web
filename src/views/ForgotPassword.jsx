'use client'

// React
import { useState, useEffect } from 'react'

// Next
import Link from 'next/link'

// MUI
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'

// Components
import Form from '@components/Form'
import DirectionalIcon from '@components/DirectionalIcon'
import Illustrations from '@components/Illustrations'
import Logo from '@components/layout/shared/Logo'

// Hooks
import { useImageVariant } from '@core/hooks/useImageVariant'

// Supabase (ajuste se seu client exporta diferente)
import { supabase } from '@/libs/supabaseAuth'

const ForgotPassword = ({ mode }) => {
  // Vars
  const darkImg = '/images/pages/auth-v1-mask-dark.png'
  const lightImg = '/images/pages/auth-v1-mask-light.png'

  // Hooks
  const authBackground = useImageVariant(mode, lightImg, darkImg)

  // State
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Se você já usa "Lembrar de mim", podemos pré-carregar o email salvo
  useEffect(() => {
    const remembered = localStorage.getItem('rememberedEmail')

    if (remembered) setEmail(remembered)
  }, [])

  const handleSubmit = async e => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const trimmed = email.trim()

    if (!trimmed) {
      setErrorMsg('Informe um e-mail válido.')

      return
    }

    setLoading(true)

    try {
      // URL para onde o Supabase vai redirecionar após o usuário clicar no link do e-mail
      // Crie uma página/rota que finalize a troca de senha (ex: /auth/update-password)
      const redirectTo = `${window.location.origin}/auth/update-password`

      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo })

      if (error) {
        setErrorMsg(error.message || 'Não foi possível enviar o e-mail de redefinição.')
      } else {
        setSuccessMsg('Enviamos um link de redefinição para o seu e-mail. Verifique sua caixa de entrada e o spam.')
      }
    } catch {
      setErrorMsg('Ocorreu um erro ao solicitar a redefinição. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='flex flex-col justify-center items-center min-bs-[100dvh] relative p-6'>
      <Card
        className='flex flex-col sm:is-[450px]'
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        <CardContent className='p-6 sm:!p-12'>
          <Link href='/' className='flex justify-center items-center mbe-6'>
            <Logo />
          </Link>

          <Typography variant='h4' className='text-center' sx={{ fontWeight: 700, mb: 1 }}>
            Recuperar senha 🔒
          </Typography>

          <Typography variant='body2' className='text-center' sx={{ mb: 4, opacity: 0.9 }}>
            Digite seu e-mail e enviaremos um link para você redefinir sua senha.
          </Typography>

          {errorMsg && (
            <Alert severity='error' sx={{ mb: 2 }}>
              {errorMsg}
            </Alert>
          )}
          {successMsg && (
            <Alert severity='success' sx={{ mb: 2 }}>
              {successMsg}
            </Alert>
          )}

          <Form noValidate autoComplete='off' onSubmit={handleSubmit} className='flex flex-col gap-5'>
            <TextField
              autoFocus
              fullWidth
              type='email'
              label='E-mail'
              name='email'
              placeholder='seuemail@exemplo.com'
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              InputProps={{ sx: { borderRadius: 2 } }}
            />

            <Button
              fullWidth
              variant='contained'
              type='submit'
              disabled={loading}
              sx={{ py: 1.25, borderRadius: 9999 }}
            >
              {loading ? 'Enviando…' : 'Enviar link de redefinição'}
            </Button>

            <Typography className='flex justify-center items-center' color='primary' sx={{ mt: 1 }}>
              <Link href='/login' className='flex items-center gap-1'>
                <DirectionalIcon ltrIconClass='ri-arrow-left-s-line' rtlIconClass='ri-arrow-right-s-line' />
                <span>Voltar para o login</span>
              </Link>
            </Typography>
          </Form>
        </CardContent>
      </Card>

      <Illustrations maskImg={{ src: authBackground }} />
    </div>
  )
}

export default ForgotPassword
