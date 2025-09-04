'use client'

// React
import { useEffect, useMemo, useState } from 'react'

// MUI
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import LinearProgress from '@mui/material/LinearProgress'

// Third-party
import classnames from 'classnames'

// Components
import CustomAvatar from '@core/components/mui/Avatar'

// Styles
import tableStyles from '@core/styles/table.module.css'

// Supabase
import { supabase } from '@/libs/supabaseAuth'

// ---------------------------------------------
// Config
// ---------------------------------------------
const AVATAR_BUCKET = 'avatars_admin' // ajuste se seus avatares de aluno estiverem em outro bucket
const FALLBACK_AVATAR = '/images/avatars/1.png'
const ONLINE_WINDOW_SECONDS = 120 // considera online se last_seen <= 2 min

// ---------------------------------------------
// Helpers
// ---------------------------------------------
function normalizeAvatarPath(raw) {
  if (!raw) return ''
  const val = String(raw).trim()

  if (/^https?:\/\//i.test(val)) return val
  let p = val.replace(/^\/+/, '')

  if (p.startsWith(`${AVATAR_BUCKET}/`)) p = p.slice(AVATAR_BUCKET.length + 1)

  return p
}

async function getAvatarUrl(path) {
  if (!path) return FALLBACK_AVATAR

  // se for URL completa
  if (/^https?:\/\//i.test(path)) return path

  // tenta URL assinada; se não der, usa pública
  const { data: signed, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 60 * 60) // 1h

  if (!error && signed?.signedUrl) return signed.signedUrl
  const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)

  return pub?.publicUrl || FALLBACK_AVATAR
}

function roleToIcon(role) {
  const r = (role || '').toLowerCase()

  if (r.includes('admin')) return { icon: 'ri-vip-crown-line', color: 'text-primary', label: 'Admin' }
  if (r.includes('prof')) return { icon: 'ri-book-2-line', color: 'text-warning', label: 'Professor(a)' }

  return { icon: 'ri-user-3-line', color: 'text-success', label: 'Aluno(a)' }
}

function statusChip(status) {
  const st = (status || '').toLowerCase()

  const color =
    st === 'online' ? 'success' : st === 'inactive' ? 'secondary' : st === 'pending' ? 'warning' : 'secondary'

  return <Chip className='capitalize' variant='tonal' color={color} label={st || 'offline'} size='small' />
}

// ---------------------------------------------
// Component
// ---------------------------------------------
const Table = () => {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([]) // todos alunos
  const [recent, setRecent] = useState([]) // últimos criados

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)

        // 1) Busca ALUNOS em users_app
        const { data: users, error } = await supabase
          .from('users_app')
          .select('id, email, name, role, username, avatar_url, created_at')
          .or('role.ilike.%aluno%,role.ilike.%aluna%,role.ilike.%student%')
          .order('created_at', { ascending: false })

        if (error) throw error

        const ids = (users || []).map(u => u.id).filter(Boolean)

        // 2) Busca presença (opcional). Se a tabela não existir, captura erro.
        let presence = []

        try {
          if (ids.length) {
            const { data: pres } = await supabase
              .from('user_presence')
              .select('user_id, last_seen, status')
              .in('user_id', ids)

            presence = pres || []
          }
        } catch {
          presence = [] // sem tabela de presença => todos offline
        }

        const presenceMap = Object.fromEntries(presence.map(p => [p.user_id, p]))

        // 3) Monta linhas com avatar e status
        const now = Date.now()

        const mapped = await Promise.all(
          (users || []).map(async u => {
            const username = u.username || '@' + (u.email?.split('@')?.[0] || 'user')
            const avatarPath = normalizeAvatarPath(u.avatar_url || '')
            const avatarSrc = await getAvatarUrl(avatarPath)

            const p = presenceMap[u.id]
            let status = 'offline'

            if (p) {
              const flagOnline =
                (p.status && String(p.status).toLowerCase() === 'online') ||
                (p.last_seen && now - new Date(p.last_seen).getTime() <= ONLINE_WINDOW_SECONDS * 1000)

              status = flagOnline ? 'online' : 'offline'
            }

            const { icon, color, label } = roleToIcon(u.role)

            return {
              id: u.id,
              avatarSrc,
              name: u.name || u.email || 'Usuário',
              username,
              email: u.email || '',
              roleIcon: icon,
              iconClass: color,
              role: label,
              status,
              created_at: u.created_at
            }
          })
        )

        setRows(mapped)
        setRecent(mapped.slice(0, 8)) // “últimos alunos criados”
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const contentTable = useMemo(() => {
    const renderRows = data => (
      <tbody>
        {data.map(row => (
          <tr key={row.id}>
            <td className='!plb-1'>
              <div className='flex items-center gap-3'>
                <CustomAvatar src={row.avatarSrc} size={34} />
                <div className='flex flex-col'>
                  <Typography color='text.primary' className='font-medium'>
                    {row.name}
                  </Typography>
                  <Typography variant='body2'>{row.username}</Typography>
                </div>
              </div>
            </td>
            <td className='!plb-1'>
              <Typography>{row.email}</Typography>
            </td>
            <td className='!plb-1'>
              <div className='flex gap-2 items-center'>
                <i className={classnames(row.roleIcon, row.iconClass, 'text-[22px]')} />
                <Typography color='text.primary'>{row.role}</Typography>
              </div>
            </td>
            <td className='!pb-1'>{statusChip(row.status)}</td>
          </tr>
        ))}
      </tbody>
    )

    return { renderRows }
  }, [])

  return (
    <Card>
      <CardContent className='flex flex-col gap-4'>
        <Typography variant='h6'>Últimos alunos cadastrados</Typography>
        {loading ? (
          <LinearProgress />
        ) : (
          <div className='overflow-x-auto'>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Email</th>
                  <th>Função</th>
                  <th>Status</th>
                </tr>
              </thead>
              {contentTable.renderRows(recent)}
            </table>
          </div>
        )}

        <Divider className='my-4' />

        <Typography variant='h6'>Todos os alunos</Typography>
        {loading ? (
          <LinearProgress />
        ) : (
          <div className='overflow-x-auto'>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Email</th>
                  <th>Função</th>
                  <th>Status</th>
                </tr>
              </thead>
              {contentTable.renderRows(rows)}
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default Table
