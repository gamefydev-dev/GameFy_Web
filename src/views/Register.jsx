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

// Component Imports
import Illustrations from '@components/Illustrations'
import Logo from '@components/layout/shared/Logo'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'

// Auth Helpers (Supabase)
import { signUp, signInWithProvider } from '@/libs/supabaseAuth'

const Register = ({ mode }) => {
  // States
  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

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
    setSuccessMsg('')
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const username = (formData.get('username') || '').toString().trim()
      const email = (formData.get('email') || '').toString().trim()
      const password = (formData.get('password') || '').toString()

      const { error } = await signUp({
        email,
        password,
        metadata: { username },

        // após confirmar e-mail, usuário volta para /login
        redirectPath: '/login'
      })

      setLoading(false)

      if (error) {
        setErrorMsg(error.message)

        return
      }

      setSuccessMsg('Conta criada! Verifique seu e-mail para confirmar o cadastro.')

      // opcional: enviar para /login após alguns segundos
      // setTimeout(() => router.push('/login'), 2000)
    } catch {
      setLoading(false)
      setErrorMsg('Não foi possível criar a conta. Tente novamente.')
    }
  }

  const handleOAuth = async provider => {
    setErrorMsg('')
    setSuccessMsg('')
    const { error } = await signInWithProvider(provider, '/')

    if (error) setErrorMsg(error.message)

    // redireciona via OAuth automaticamente pelo Supabase
  }

  return (
    <div className='flex flex-col justify-center items-center min-bs-[100dvh] relative p-6'>
      <Card className='flex flex-col sm:is-[450px]'>
        <CardContent className='p-6 sm:!p-12'>
          <Link href='/' className='flex justify-center items-start mbe-6' aria-label='Ir para a home do GameFy'>
            <Logo />
          </Link>

          <Typography variant='h4'>
            Comece sua aventura no <b>GameFy</b> 🚀
          </Typography>

          <div className='flex flex-col gap-5'>
            <Typography className='mbs-1'>Crie sua conta para desbloquear missões, rankings e conquistas.</Typography>

            {errorMsg ? (
              <Typography role='alert' color='error'>
                {errorMsg}
              </Typography>
            ) : null}

            {successMsg ? (
              <Typography role='status' color='success.main'>
                {successMsg}
              </Typography>
            ) : null}

            <form noValidate autoComplete='off' onSubmit={handleSubmit} className='flex flex-col gap-5'>
              <TextField autoFocus fullWidth label='Nome de usuário' name='username' />
              <TextField fullWidth label='E-mail' type='email' name='email' />
              <TextField
                fullWidth
                label='Senha'
                name='password'
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

              <FormControlLabel
                control={<Checkbox />}
                label={
                  <>
                    <span>Concordo com a </span>
                    <Link className='text-primary' href='/privacy' onClick={e => e.preventDefault()}>
                      Política de Privacidade
                    </Link>
                    <span> e os </span>
                    <Link className='text-primary' href='/terms' onClick={e => e.preventDefault()}>
                      Termos de Uso
                    </Link>
                  </>
                }
              />

              <Button fullWidth variant='contained' type='submit' disabled={loading}>
                {loading ? 'Criando…' : 'Criar conta'}
              </Button>

              <div className='flex justify-center items-center flex-wrap gap-2'>
                <Typography>Já possui conta?</Typography>
                <Typography component={Link} href='/login' color='primary'>
                  Entrar
                </Typography>
              </div>

              <Divider className='gap-3'>ou</Divider>

              <div className='flex justify-center items-center gap-2'>
                <IconButton
                  size='small'
                  className='text-github'
                  aria-label='Cadastrar com GitHub'
                  onClick={() => handleOAuth('github')}
                >
                  <i className='ri-github-fill' />
                </IconButton>
                <IconButton
                  size='small'
                  className='text-googlePlus'
                  aria-label='Cadastrar com Google'
                  onClick={() => handleOAuth('google')}
                >
                  <i className='ri-google-fill' />
                </IconButton>
                <IconButton
                  size='small'
                  className='text-facebook'
                  aria-label='Cadastrar com Facebook'
                  onClick={() => handleOAuth('facebook')}
                >
                  <i className='ri-facebook-fill' />
                </IconButton>
                <IconButton
                  size='small'
                  className='text-twitter'
                  aria-label='Cadastrar com X/Twitter'
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

export default Register
