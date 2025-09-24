'use client'

// React Imports
import { useState } from 'react'

// Next Imports
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// MUI Imports
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
import ButtonGroup from '@mui/material/ButtonGroup'

// Component Imports
import Logo from '@components/layout/shared/Logo'
import Illustrations from '@components/Illustrations'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'

// Auth Helpers (Supabase)
import { signInWithEmail, signInWithProvider, fetchCurrentProfile } from '@/libs/supabaseAuth'

const Login = ({ mode }) => {
  // States
  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState('student') // 'student' | 'professor'

  // Vars
  const darkImg = '/images/pages/auth-v1-mask-dark.png'
  const lightImg = '/images/pages/auth-v1-mask-light.png'

  // Hooks
  const router = useRouter()
  const authBackground = useImageVariant(mode, lightImg, darkImg)
  const handleClickShowPassword = () => setIsPasswordShown(show => !show)

  const handleSubmit = async e => {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const email = (formData.get('email') || '').toString().trim()
      const password = (formData.get('password') || '').toString()

      const { error } = await signInWithEmail(email, password)

      if (error) {
        setErrorMsg(error.message)
        setLoading(false)

        return
      }

      // valida papel após login
      const { role: detectedRole } = await fetchCurrentProfile()

      if (role === 'student' && detectedRole !== 'student') {
        setErrorMsg('Esta conta não é de aluno. Escolha "Sou Professor" ou use outra conta.')
        setLoading(false)

        return
      }

      if (role === 'professor' && detectedRole !== 'professor') {
        setErrorMsg('Esta conta não é de professor. Escolha "Sou Aluno" ou use outra conta.')
        setLoading(false)

        return
      }

      // redireciona por papel
      if (detectedRole === 'professor') router.push('/')
      else if (detectedRole === 'student') router.push('/alunos/notas')
      else router.push('/') // fallback
    } catch {
      setErrorMsg('Não foi possível entrar. Tente novamente.')
      setLoading(false)
    }
  }

  const handleOAuth = async provider => {
    setErrorMsg('')

    try {
      const { error } = await signInWithProvider(provider, '/')

      if (error) setErrorMsg(error.message)

      // redireciona via OAuth automaticamente
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

            {/* Seletor de papel */}
            <ButtonGroup fullWidth variant='outlined' className='mb-2'>
              <Button onClick={() => setRole('student')} variant={role === 'student' ? 'contained' : 'outlined'}>
                Sou Aluno
              </Button>
              <Button onClick={() => setRole('professor')} variant={role === 'professor' ? 'contained' : 'outlined'}>
                Sou Professor
              </Button>
            </ButtonGroup>

            {errorMsg ? (
              <Typography role='alert' color='error'>
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
                <Typography component={Link} href='/register' color='primary'>
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
