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
import Alert from '@mui/material/Alert'

// Component Imports
import Illustrations from '@components/Illustrations'
import Logo from '@components/layout/shared/Logo'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'

// Auth Helpers (Supabase)
import { signUp, signInWithProvider, signUpStudent } from '@/libs/supabaseAuth'

const Register = ({ mode }) => {
  // States
  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
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
    setSuccessMsg('')
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const username = (formData.get('username') || '').toString().trim()
      const email = (formData.get('email') || '').toString().trim().toLowerCase()
      const password = (formData.get('password') || '').toString()

      // nome "bonitinho"
      const name = username

      if (role === 'student') {
        const ra = (formData.get('ra') || '').toString().trim()

        const { error } = await signUpStudent({
          email,
          password,
          metadata: { username, name, ra }
        })

        if (error) throw error
        setSuccessMsg('Conta de aluno criada! Verifique seu e-mail para confirmar.')
        setLoading(false)

        return
      }

      // ===== PROF ====
      // regra de permissão: OU convite OU domínio institucional
      // ajuste conforme sua regra real
      const invited = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('invite')
      const allowedDomain = email.endsWith('@fecap.br') || email.endsWith('@gamefy.education')

      if (!invited && !allowedDomain) {
        setLoading(false)
        setErrorMsg('Cadastro de professor permitido apenas com convite ou e-mail institucional.')

        return
      }

      // cria usuário com metadata de professor
      const { data, error } = await signUp({
        email,
        password,
        metadata: { username, name, role: 'professor' }
      })

      if (error) throw error

      // (Opcional) criar/atualizar perfil na sua tabela
      // Se você tiver um endpoint Next API que insere em public.professors/profiles, descomente:
      // await fetch('/api/create-professor-profile', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ user_id: data?.user?.id, name, email })
      // })

      setSuccessMsg('Conta de professor criada! Verifique seu e-mail para confirmar.')
      setLoading(false)
    } catch (err) {
      setLoading(false)
      setErrorMsg(err?.message || 'Não foi possível criar a conta. Tente novamente.')
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
      <Card className='flex flex-col sm:is-[520px]'>
        <CardContent className='p-6 sm:!p-12'>
          <Link href='/' className='flex justify-center items-start mbe-6' aria-label='Ir para a home do GameFy'>
            <Logo />
          </Link>

          <Typography variant='h4'>
            Comece sua aventura no <b>GameFy</b> 🚀
          </Typography>

          {/* Seletor de papel */}
          <div className='mt-3 mb-2'>
            <ButtonGroup fullWidth variant='outlined'>
              <Button onClick={() => setRole('student')} variant={role === 'student' ? 'contained' : 'outlined'}>
                Sou Aluno
              </Button>
              <Button onClick={() => setRole('professor')} variant={role === 'professor' ? 'contained' : 'outlined'}>
                Sou Professor
              </Button>
            </ButtonGroup>
          </div>

          {role === 'professor' && (
            <Alert severity='info' className='mb-3'>
              Contas de <b>Professor</b> são criadas pela coordenação. Solicite acesso pelo canal oficial.
            </Alert>
          )}

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
              <TextField autoFocus fullWidth label='Nome Completo' name='username' />

              {/* Campos comuns */}
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

              {/* Campos extras quando Aluno */}
              {role === 'student' && (
                <>
                  <TextField fullWidth label='RA (opcional)' name='ra' />
                </>
              )}

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
                {loading
                  ? role === 'student'
                    ? 'Criando…'
                    : 'Validando…'
                  : role === 'student'
                    ? 'Criar conta'
                    : 'Solicitar (via Coordenação)'}
              </Button>

              <div className='flex justify-center items-center flex-wrap gap-2'>
                <Typography>Já possui conta?</Typography>
                <Typography component={Link} href='/login' color='primary'>
                  Entrar
                </Typography>
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
