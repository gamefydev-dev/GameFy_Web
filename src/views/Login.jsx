'use client'

import React, { useMemo, useState } from 'react'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Checkbox from '@mui/material/Checkbox'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import Divider from '@mui/material/Divider'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'

import Logo from '@components/layout/shared/Logo'
import Illustrations from '@components/Illustrations'
import themeConfig from '@configs/themeConfig'
import { useImageVariant } from '@core/hooks/useImageVariant'

const Login = ({ mode }) => {
  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState('aluno') // 'aluno' | 'prof'

  const darkImg = '/images/pages/auth-v1-mask-dark.png'
  const lightImg = '/images/pages/auth-v1-mask-light.png'

  const router = useRouter()
  const searchParams = useSearchParams()
  const authBackground = useImageVariant(mode, lightImg, darkImg)

  // ✅ ENVs públicas (client-side)
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // ✅ Client do Supabase (NUNCA use SERVICE_ROLE no client)
  const supabase = useMemo(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY')

      return null
    }

    return createClientComponentClient({
      supabaseUrl: SUPABASE_URL,
      supabaseKey: SUPABASE_ANON_KEY
    })
  }, [SUPABASE_URL, SUPABASE_ANON_KEY])

  const handleClickShowPassword = () => setIsPasswordShown(show => !show)

  // Destino padrão por role (quando NÃO houver ?redirect=)
  const defaultDestFor = r => (r === 'prof' ? '/' : '/alunos/dashboard')

  // Persistir role em cookie (opcional)
  const setRoleCookie = r => {
    document.cookie = `app_role=${r}; Path=/; Max-Age=${60 * 60 * 24 * 30}`
  }

  // Navegação segura (SPA + fallback hard)
  const navigateSafely = dest => {
    router.replace(dest)
    router.refresh()
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.location.pathname !== dest) {
        window.location.assign(dest)
      }
    }, 80)
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (loading) return

    setErrorMsg('')
    setLoading(true)

    try {
      if (!supabase) {
        setErrorMsg('Configuração do Supabase ausente. Verifique as variáveis públicas.')
        setLoading(false)

        return
      }

      const formData = new FormData(e.currentTarget)
      const email = String(formData.get('email') || '').trim()
      const password = String(formData.get('password') || '')

      if (!email || !password) {
        setErrorMsg('Informe e-mail e senha.')
        setLoading(false)

        return
      }

      // ▶ Login direto pelo Supabase
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setErrorMsg(error.message)
        setLoading(false)

        return
      }

      // Sincroniza cookies (importante p/ middleware na Vercel)
      await supabase.auth.getSession()

      setRoleCookie(role)

      const dest = searchParams.get('redirect') || defaultDestFor(role)

      navigateSafely(dest)
    } catch {
      setErrorMsg('Não foi possível entrar. Tente novamente.')
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = async provider => {
    setErrorMsg('')

    try {
      if (!supabase) {
        setErrorMsg('Configuração do Supabase ausente. Verifique as variáveis públicas.')

        return
      }

      const base = searchParams.get('redirect') || defaultDestFor(role)
      const sep = base.includes('?') ? '&' : '?'
      const destWithRole = `${base}${sep}role=${role}`

      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const redirectTo = `${origin}${destWithRole}`

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo }
      })

      if (error) setErrorMsg(error.message)
    } catch {
      setErrorMsg('Falha ao redirecionar para o provedor.')
    }
  }

  return (
    <div className='flex flex-col justify-center items-center min-bs-[100dvh] relative p-6'>
      {!SUPABASE_URL || !SUPABASE_ANON_KEY ? (
        <Typography color='error' className='mb-4'>
          Configuração do Supabase ausente. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.
        </Typography>
      ) : null}

      <Card className='flex flex-col sm:is-[450px]'>
        <CardContent className='p-6 sm:!p-12'>
          <Link href='/' className='flex justify-center items-center mbe-6' aria-label='Ir para a home do GameFy'>
            <Logo />
          </Link>

          <div className='flex flex-col gap-5'>
            <div>
              <Typography variant='h4'>{`Bem-vindo ao ${themeConfig?.templateName || 'GameFy'}! 👋🏻`}</Typography>
              <Typography className='mbs-1'>
                Faça login para continuar sua jornada gamificada de aprendizado.
              </Typography>
            </div>

            {/* Seletor de tipo de conta */}
            <ToggleButtonGroup
              exclusive
              value={role}
              onChange={(_, v) => v && setRole(v)}
              aria-label='Tipo de conta'
              fullWidth
              size='small'
            >
              <ToggleButton value='aluno' aria-label='Aluno'>
                Aluno
              </ToggleButton>
              <ToggleButton value='prof' aria-label='Professor'>
                Professor
              </ToggleButton>
            </ToggleButtonGroup>

            {errorMsg ? (
              <Typography role='alert' aria-live='polite' color='error'>
                {errorMsg}
              </Typography>
            ) : null}

            <form noValidate autoComplete='off' onSubmit={handleSubmit} className='flex flex-col gap-5'>
              <TextField autoFocus fullWidth label='E-mail' type='email' name='email' />
              <TextField
                fullWidth
                label='Senha'
                name='password'
                id='outlined-adornment-password'
                type={isPasswordShown ? 'text' : 'password'}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position='end'>
                      <IconButton
                        size='small'
                        edge='end'
                        onClick={handleClickShowPassword}
                        onMouseDown={e => e.preventDefault()}
                        aria-label={isPasswordShown ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        <i className={isPasswordShown ? 'ri-eye-off-line' : 'ri-eye-line'} />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />

              <div className='flex justify-between items-center gap-x-3 gap-y-1 flex-wrap'>
                <FormControlLabel control={<Checkbox />} label='Lembrar de mim' />
                <Typography className='text-end' color='primary' component={Link} href='/forgot-password'>
                  Esqueceu a senha?
                </Typography>
              </div>

              <Button
                fullWidth
                variant='contained'
                type='submit'
                disabled={loading || !SUPABASE_URL || !SUPABASE_ANON_KEY}
              >
                {loading ? 'Entrando…' : 'Entrar'}
              </Button>

              <div className='flex justify-center items-center flex-wrap gap-2'>
                <Typography>Novo no GameFy?</Typography>
                <Typography component={Link} href={`/register?role=${role}`} color='primary'>
                  Criar conta
                </Typography>
              </div>

              <Divider className='gap-3'>ou</Divider>

              <div className='flex justify-center items-center gap-2'>
                <IconButton
                  size='small'
                  className='text-github'
                  aria-label='Entrar com GitHub'
                  onClick={() => handleOAuth('github')}
                >
                  <i className='ri-github-fill' />
                </IconButton>
                <IconButton
                  size='small'
                  className='text-googlePlus'
                  aria-label='Entrar com Google'
                  onClick={() => handleOAuth('google')}
                >
                  <i className='ri-google-fill' />
                </IconButton>
                <IconButton
                  size='small'
                  className='text-facebook'
                  aria-label='Entrar com Facebook'
                  onClick={() => handleOAuth('facebook')}
                >
                  <i className='ri-facebook-fill' />
                </IconButton>
                <IconButton
                  size='small'
                  className='text-twitter'
                  aria-label='Entrar com X/Twitter'
                  onClick={() => handleOAuth('twitter')}
                >
                  <i className='ri-twitter-fill' />
                </IconButton>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>

      <Illustrations maskImg={{ src: authBackground }} />
    </div>
  )
}

export default Login
