'use client'

import { useState } from 'react'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

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

// helpers Supabase
import { signInWithEmail, signInWithProvider } from '@/libs/supabaseAuth'

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

  const handleClickShowPassword = () => {
    setIsPasswordShown(show => !show)
  }

  // Destino padrão por role (quando NÃO houver ?redirect=)
  const defaultDestFor = r => (r === 'prof' ? '/' : '/alunos/dashboard')

  // Persistir role em cookie (opcional para usar no header/server)
  const setRoleCookie = r => {
    document.cookie = `app_role=${r}; Path=/; Max-Age=${60 * 60 * 24 * 30}`
  }

  const handleSubmit = async e => {
    e.preventDefault()

    if (loading) return

    setErrorMsg('')
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const email = String(formData.get('email') || '').trim()
      const password = String(formData.get('password') || '')

      const { error } = await signInWithEmail(email, password)

      if (error) {
        setErrorMsg(error.message)
        setLoading(false)

        return
      }

      setRoleCookie(role)

      const dest = searchParams.get('redirect') || defaultDestFor(role)

      router.replace(dest)
      router.refresh() // força revalidação do layout/header (RSC)

      setLoading(false)
    } catch {
      setErrorMsg('Não foi possível entrar. Tente novamente.')
      setLoading(false)
    }
  }

  const handleOAuth = async provider => {
    setErrorMsg('')

    try {
      // preserva redirect e anexa role para o callback
      const base = searchParams.get('redirect') || defaultDestFor(role)
      const sep = base.includes('?') ? '&' : '?'
      const destWithRole = `${base}${sep}role=${role}`

      const { error } = await signInWithProvider(provider, destWithRole)

      if (error) setErrorMsg(error.message)

      // OAuth redireciona automaticamente
    } catch {
      setErrorMsg('Falha ao redirecionar para o provedor.')
    }
  }

  return (
    <div className='flex flex-col justify-center items-center min-bs-[100dvh] relative p-6'>
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

              <Button fullWidth variant='contained' type='submit' disabled={loading}>
                {loading ? 'Entrando…' : 'Entrar'}
              </Button>

              <div className='flex justify-center items-center flex-wrap gap-2'>
                <Typography>Novo no GameFy?</Typography>

                <Typography
                  component={Link}
                  href={`/register?role=${role}`} // abre o cadastro já no role escolhido
                  color='primary'
                >
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
