'use client'

import { useMemo, useState } from 'react'

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

  // ENVs públicas (obrigatórias no client)
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Client com integração de cookies
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

  const handleClickShowPassword = () => setIsPasswordShown(prev => !prev)

  const defaultDestFor = r => (r === 'prof' ? '/' : '/alunos/dashboard')

  // Cookies
  const setRoleCookie = r => {
    document.cookie = `app_role=${r}; Path=/; Max-Age=${60 * 60 * 24 * 30}`
  }

  const setProfileCookie = profile => {
    const payload = {
      id: profile?.id ?? null,
      name: profile?.full_name ?? null,
      role: profile?.role ?? null, // 'professor' | 'aluno'
      category: profile?.category ?? null,
      avatarUrl: profile?.avatar_public_url ?? null
    }

    document.cookie = `app_profile=${encodeURIComponent(JSON.stringify(payload))}; Path=/; Max-Age=${60 * 60 * 24 * 7}`
  }

  // Busca perfil em uma tabela e adiciona URL pública do avatar
  const fetchProfileFrom = async (table, userId) => {
    const { data: prof, error } = await supabase
      .from(table)
      .select('id, full_name, category, email, avatar_url, role')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error(`Erro ao buscar perfil em ${table}:`, error)

      return null
    }

    if (!prof) return null

    let avatar_public_url

    if (prof.avatar_url) {
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(prof.avatar_url)

      avatar_public_url = pub?.publicUrl
    }

    return { ...prof, avatar_public_url }
  }

  // Prioriza students/professors de acordo com o seletor
  const loadProfileAndPersist = async () => {
    if (!supabase) return null
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    if (!userId) return null

    const order = role === 'aluno' ? ['students', 'professors'] : ['professors', 'students']

    let profile = null

    for (const table of order) {
      profile = await fetchProfileFrom(table, userId)
      if (profile) break
    }

    if (!profile) {
      console.warn('Nenhum perfil encontrado em students/professors para o usuário', userId)

      return null
    }

    setProfileCookie(profile)
    const roleShort = profile.role === 'professor' ? 'prof' : profile.role === 'aluno' ? 'aluno' : role

    setRoleCookie(roleShort)

    return profile
  }

  const navigateSafely = dest => {
    router.replace(dest)
    router.refresh()
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.location.pathname !== dest) {
        window.location.assign(dest)
      }
    }, 60)
  }

  const navigateAfterLogin = async () => {
    // garante que os cookies de sessão foram gravados
    await supabase.auth.getSession()
    const profile = await loadProfileAndPersist()

    const roleFromProfile = profile?.role === 'professor' ? 'prof' : profile?.role === 'aluno' ? 'aluno' : role

    const dest = searchParams.get('redirect') || defaultDestFor(roleFromProfile)

    navigateSafely(dest)
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setErrorMsg('')
    if (loading) return
    setLoading(true)

    try {
      if (!supabase) {
        setErrorMsg('Configuração do Supabase ausente.')
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

      // 🔑 Login direto no mesmo client do auth-helper
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setErrorMsg(error.message || 'Falha no login.')
        setLoading(false)

        return
      }

      await navigateAfterLogin()
    } catch (err) {
      console.error(err)
      setErrorMsg('Não foi possível entrar. Tente novamente.')
    } finally {
      setLoading(false)
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

            {/* Seletor de tipo de conta (Aluno / Professor) */}
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
            </form>
          </div>
        </CardContent>
      </Card>

      <Illustrations maskImg={{ src: authBackground }} />
    </div>
  )
}

export default Login
