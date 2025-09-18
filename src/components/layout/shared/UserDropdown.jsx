'use client'

// React Imports
import { useEffect, useMemo, useRef, useState } from 'react'

// Next Imports
import { useRouter } from 'next/navigation'

// MUI Imports
import { styled } from '@mui/material/styles'
import Badge from '@mui/material/Badge'
import Avatar from '@mui/material/Avatar'
import Popper from '@mui/material/Popper'
import Fade from '@mui/material/Fade'
import Paper from '@mui/material/Paper'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import MenuList from '@mui/material/MenuList'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'

// Auth/DB Imports
import { supabase, getUser, signOut, initAuthListener } from '@/libs/supabaseAuth'

// Styled component for badge content
const BadgeContentSpan = styled('span')({
  width: 8,
  height: 8,
  borderRadius: '50%',
  cursor: 'pointer',
  backgroundColor: 'var(--mui-palette-success-main)',
  boxShadow: '0 0 0 2px var(--mui-palette-background-paper)'
})

const UserDropdown = () => {
  // States
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState('Usuário')
  const [categoria, setCategoria] = useState('') // professor | professora | admin | etc.
  const [avatarKey, setAvatarKey] = useState('') // caminho no bucket avatars_admin
  const [avatarUrl, setAvatarUrl] = useState('')

  // Refs
  const anchorRef = useRef(null)

  // Hooks
  const router = useRouter()

  // Carrega perfil do usuário (nome, categoria, avatar) do Supabase
  useEffect(() => {
    let unsubscribe = () => {}

    const run = async () => {
      const { data: userData } = await getUser()
      const user = userData?.user

      if (!user) return

      // 1) tenta buscar em public.professors
      const { data: profile } = await supabase
        .from('professors')
        .select('name, role, avatar_url')
        .eq('id', user.id)
        .maybeSingle()

      // 2) Fallback: usa metadados do auth
      const name =
        profile?.name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'Usuário'

      const roleRaw = profile?.role || user.user_metadata?.role || '' // ex.: 'professor' | 'professora' | 'admin'

      const avatarFromProfile = profile?.avatar_url || user.user_metadata?.avatar_url || '' // pode ser um caminho de storage (ex.: "uid123.png" ou "folder/uid123.png")

      setDisplayName(name)
      setCategoria(roleRaw)

      // Se o bucket for público, podemos gerar a URL pública
      if (avatarFromProfile) {
        const { data: pub } = supabase.storage.from('avatars_admin').getPublicUrl(avatarFromProfile)

        setAvatarKey(avatarFromProfile)
        setAvatarUrl(pub?.publicUrl || '')
      }
    }

    run()

    // Listener para mudanças de sessão (opcional)
    unsubscribe = initAuthListener(() => run())

    return () => {
      try {
        unsubscribe?.()
      } catch (_) {}
    }
  }, [])

  // Inicial da pessoa (fallback do avatar)
  const initial = useMemo(() => {
    const n = (displayName || '').trim()

    return n ? n.charAt(0).toUpperCase() : 'U'
  }, [displayName])

  const handleDropdownOpen = () => {
    setOpen(prev => !prev)
  }

  const handleDropdownClose = async (event, url) => {
    if (url) {
      router.push(url)
    }

    if (anchorRef.current && anchorRef.current.contains(event?.target)) {
      return
    }

    setOpen(false)
  }

  const handleLogout = async e => {
    await signOut()
    handleDropdownClose(e, '/login')
  }

  // Ajusta o rótulo da categoria para PT-BR amigável
  const categoriaLabel = useMemo(() => {
    const r = (categoria || '').toLowerCase()

    if (r === 'professor') return 'Professor'
    if (r === 'professora') return 'Professora'
    if (r === 'admin' || r === 'administrador') return 'Administrador'
    if (r === 'administradora') return 'Administradora'
    if (r) return r.charAt(0).toUpperCase() + r.slice(1)

    return 'Usuário'
  }, [categoria])

  return (
    <>
      <Badge
        ref={anchorRef}
        overlap='circular'
        badgeContent={<BadgeContentSpan onClick={handleDropdownOpen} />}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        className='mis-2'
      >
        <Avatar
          ref={anchorRef}
          alt={displayName}
          src={avatarUrl || undefined}
          onClick={handleDropdownOpen}
          className='cursor-pointer bs-[38px] is-[38px]'
        >
          {!avatarUrl ? initial : null}
        </Avatar>
      </Badge>

      <Popper
        open={open}
        transition
        disablePortal
        placement='bottom-end'
        anchorEl={anchorRef.current}
        className='min-is-[240px] !mbs-4 z-[1]'
      >
        {({ TransitionProps, placement }) => (
          <Fade
            {...TransitionProps}
            style={{
              transformOrigin: placement === 'bottom-end' ? 'right top' : 'left top'
            }}
          >
            <Paper className='shadow-lg'>
              <ClickAwayListener onClickAway={e => handleDropdownClose(e)}>
                <MenuList>
                  <div className='flex items-center plb-2 pli-4 gap-2' tabIndex={-1}>
                    <Avatar alt={displayName} src={avatarUrl || undefined}>
                      {!avatarUrl ? initial : null}
                    </Avatar>
                    <div className='flex items-start flex-col'>
                      <Typography className='font-medium' color='text.primary'>
                        {displayName}
                      </Typography>
                      <Typography vaMeuriant='caption'>{categoriaLabel}</Typography>
                    </div>
                  </div>

                  <Divider className='mlb-1' />

                  <MenuItem className='gap-3' onClick={e => handleDropdownClose(e, '/account-settings')}>
                    <i className='ri-user-3-line' />
                    <Typography color='text.primary'>Meu Perfil</Typography>
                  </MenuItem>

                  <div className='flex items-center plb-2 pli-4'>
                    <Button
                      fullWidth
                      variant='contained'
                      color='error'
                      size='small'
                      endIcon={<i className='ri-logout-box-r-line' />}
                      onClick={handleLogout}
                      sx={{ '& .MuiButton-endIcon': { marginInlineStart: 1.5 } }}
                    >
                      Sair
                    </Button>
                  </div>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  )
}

export default UserDropdown
