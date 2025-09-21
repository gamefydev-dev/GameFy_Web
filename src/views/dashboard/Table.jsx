'use client'

import { useEffect, useMemo, useState, useRef } from 'react'

import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import LinearProgress from '@mui/material/LinearProgress'
import classnames from 'classnames'

import CustomAvatar from '@core/components/mui/Avatar'
import tableStyles from '@core/styles/table.module.css'
import { supabase } from '@/libs/supabaseAuth'

const AVATAR_BUCKET = 'avatars_admin'
const FALLBACK_AVATAR = '/images/avatars/1.png'
const ONLINE_WINDOW_SECONDS = 120

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
  if (/^https?:\/\//i.test(path)) return path
  const { data: signed, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 60 * 60)

  if (!error && signed?.signedUrl) return signed.signedUrl
  const { data: pub } = await supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)

  return (pub && pub.publicUrl) || FALLBACK_AVATAR
}

function roleToIcon(role) {
  const r = (role || '').toLowerCase()

  if (r.includes('admin')) return { icon: 'ri-vip-crown-line', color: 'text-primary', label: 'Admin' }
  if (r.includes('prof')) return { icon: 'ri-book-2-line', color: 'text-warning', label: 'Professor(a)' }

  return { icon: 'ri-book-2-line', color: 'text-warning', label: 'Professor(a)' }
}

function statusChip(status) {
  const st = (status || '').toLowerCase()
  const color = st === 'online' ? 'success' : st === 'pending' ? 'warning' : 'secondary'

  return <Chip className='capitalize' variant='tonal' color={color} label={st || 'offline'} size='small' />
}

function bestTs(u) {
  const cands = [u.created_at, u.updated_at].filter(Boolean)
  const t = cands.length ? Date.parse(cands[0]) : NaN

  return Number.isNaN(t) ? 0 : t
}

const Table = () => {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [recent, setRecent] = useState([])
  const mounted = useRef(true)

  async function fetchData() {
    try {
      setLoading(true)

      // 1) Professores
      const { data: profs, error } = await supabase
        .from('professors')
        .select('id, email, name, role, username, avatar_url, created_at, updated_at')
        .order('created_at', { ascending: false, nullsFirst: false })

      if (error) throw error
      const users = profs || []
      const ids = users.map(u => u.id).filter(Boolean)

      // 2) Fallback de avatar via profiles
      let profiles = []

      try {
        if (ids.length) {
          const { data: profsTbl } = await supabase.from('profiles').select('user_id, avatar_url').in('user_id', ids)

          profiles = profsTbl || []
        }
      } catch {
        profiles = []
      }

      const profAvatarMap = Object.fromEntries(profiles.map(p => [p.user_id, p.avatar_url || null]))

      // 3) Presença (se existir) — sem a tabela, todos ficam offline
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
        presence = []
      }

      const presenceMap = Object.fromEntries(presence.map(p => [p.user_id, p]))
      const now = Date.now()

      // 4) Monta linhas
      const mapped = await Promise.all(
        users.map(async u => {
          const username = u.username || '@' + (u.email?.split('@')?.[0] || 'user')

          // avatar: professors.avatar_url → profiles.avatar_url → fallback
          const avatarCandidate = normalizeAvatarPath(u.avatar_url || profAvatarMap[u.id] || '')
          const avatarSrc = await getAvatarUrl(avatarCandidate)

          const p = presenceMap[u.id]
          let status = 'offline'

          if (p) {
            const online =
              (p.status && String(p.status).toLowerCase() === 'online') ||
              (p.last_seen && now - new Date(p.last_seen).getTime() <= ONLINE_WINDOW_SECONDS * 1000)

            status = online ? 'online' : 'offline'
          }

          const { icon, color, label } = roleToIcon(u.role)

          return {
            id: u.id,
            avatarSrc,
            name: u.name || u.email || 'Professor(a)',
            username,
            email: u.email || '',
            roleIcon: icon,
            iconClass: color,
            role: label,
            status,
            created_at: u.created_at,
            _ts: bestTs(u)
          }
        })
      )

      if (!mounted.current) return
      const sorted = mapped.sort((a, b) => b._ts - a._ts)

      setRows(sorted)
      setRecent(sorted.slice(0, 8))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }

  useEffect(() => {
    mounted.current = true
    fetchData()

    // Realtime (opcional): habilite no Supabase para 'public.professors'
    const ch = supabase
      .channel('professors-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'professors' }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      mounted.current = false
      supabase.removeChannel(ch)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
        <Typography variant='h6'>Últimos professores cadastrados</Typography>
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

        <Typography variant='h6'>Todos os professores</Typography>
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
