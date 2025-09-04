'use client'

// MUI Imports
import { useEffect, useMemo, useState, useCallback } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Checkbox from '@mui/material/Checkbox'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListItemText from '@mui/material/ListItemText'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'

// Component Imports
import { formatDistanceToNowStrict } from 'date-fns'

import { ptBR } from 'date-fns/locale'

import Link from '@components/Link'
import Form from '@components/Form'

// Style Imports
import tableStyles from '@core/styles/table.module.css'

// Supabase
import { supabase, getUser } from '@/libs/supabaseAuth'

// Utils

// ----------------------------------------------------
// Configs simples
// ----------------------------------------------------
const HOURS_AHEAD = 24 // janela (h) para “evento próximo”

const DEFAULT_TABLE_DATA = [
  { type: 'Novidades para você', email: true, browser: true, app: true },
  { type: 'Atividade da conta', email: true, browser: true, app: true },
  { type: 'Novo login/navegador', email: true, browser: true, app: false },
  { type: 'Novo dispositivo', email: true, browser: false, app: false }
]

// etiqueta por tipo
const typeChip = type => {
  switch (type) {
    case 'event':
      return <Chip size='small' color='primary' label='Evento' />
    case 'mention':
      return <Chip size='small' color='secondary' label='Menção' />
    case 'github':
      return <Chip size='small' color='info' label='GitHub' />
    case 'error':
      return <Chip size='small' color='error' label='Erro' />
    default:
      return <Chip size='small' label='Geral' />
  }
}

// ícone no avatar
const typeIcon = type => {
  switch (type) {
    case 'event':
      return <i className='ri-calendar-event-line' />
    case 'mention':
      return <i className='ri-at-line' />
    case 'github':
      return <i className='ri-github-fill' />
    case 'error':
      return <i className='ri-error-warning-line' />
    default:
      return <i className='ri-notification-3-line' />
  }
}

const Notifications = () => {
  // usuário
  const [userId, setUserId] = useState(null)

  // feed
  const [items, setItems] = useState([]) // {id,type,title,body,created_at,read_at,meta}
  const [loadingFeed, setLoadingFeed] = useState(true)

  // preferências
  const [prefsTable, setPrefsTable] = useState(DEFAULT_TABLE_DATA)
  const [sendWhen, setSendWhen] = useState('online')
  const [savingPrefs, setSavingPrefs] = useState(false)

  // contadores
  const unreadCount = useMemo(() => items.filter(n => !n.read_at).length, [items])

  // ----------------------------------------------------
  // Helpers de feed
  // ----------------------------------------------------
  const addLocal = useCallback(notif => {
    setItems(prev => {
      const key = notif.id ? `id:${notif.id}` : `local:${notif.localKey}`
      const seen = new Set(prev.map(p => (p.id ? `id:${p.id}` : `local:${p.localKey}`)))

      if (seen.has(key)) return prev

      return [notif, ...prev].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    })
  }, [])

  const fetchNotifications = useCallback(async uid => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!error && Array.isArray(data)) {
      setItems(prev => {
        // mantém os locais e adiciona os do servidor
        const merged = [...data, ...prev.filter(p => p.localKey)]
        const deduped = []
        const seen = new Set()

        for (const n of merged) {
          const key = n.id ? `id:${n.id}` : `local:${n.localKey}`

          if (!seen.has(key)) {
            seen.add(key)
            deduped.push(n)
          }
        }

        return deduped.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      })
    }
  }, [])

  const checkUpcomingEvents = useCallback(
    async uid => {
      const now = new Date()
      const until = new Date(now.getTime() + HOURS_AHEAD * 3600 * 1000).toISOString()

      const { data, error } = await supabase
        .from('events')
        .select('id, title, start_at, location, participants')
        .gte('start_at', now.toISOString())
        .lte('start_at', until)
        .order('start_at', { ascending: true })
        .limit(20)

      if (error || !Array.isArray(data)) return

      // Supondo que 'participants' é uuid[]; ajuste se for outro schema
      for (const ev of data) {
        if (Array.isArray(ev.participants) && !ev.participants.includes(uid)) continue
        addLocal({
          localKey: `event-${ev.id}`,
          type: 'event',
          title: `Evento em breve: ${ev.title}`,
          body: ev.location ? `Local: ${ev.location}` : 'Você tem um evento nas próximas 24h.',
          created_at: ev.start_at,
          read_at: null,
          meta: { event_id: ev.id, start_at: ev.start_at }
        })
      }
    },
    [addLocal]
  )

  const fetchMentions = useCallback(
    async uid => {
      const { data, error } = await supabase
        .from('mentions')
        .select('id, context, created_at, mentioned_user_id')
        .eq('mentioned_user_id', uid)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!error && Array.isArray(data)) {
        data.forEach(m =>
          addLocal({
            localKey: `mention-${m.id}`,
            type: 'mention',
            title: 'Você foi mencionado(a)',
            body: m.context || 'Há uma nova menção a você.',
            created_at: m.created_at,
            read_at: null,
            meta: { mention_id: m.id }
          })
        )
      }
    },
    [addLocal]
  )

  const fetchGithubStatus = useCallback(
    async uid => {
      const { data, error } = await supabase
        .from('integration_github_status')
        .select('connected, message, updated_at')
        .eq('user_id', uid)
        .maybeSingle()

      if (!error && data) {
        addLocal({
          localKey: `github-${uid}`,
          type: 'github',
          title: data.connected ? 'GitHub conectado' : 'GitHub desconectado',
          body:
            data.message ||
            (data.connected ? 'Sua conta GitHub está vinculada.' : 'Sua conta GitHub não está vinculada.'),
          created_at: data.updated_at || new Date().toISOString(),
          read_at: null,
          meta: { connected: data.connected }
        })
      }
    },
    [addLocal]
  )

  const markAsRead = async n => {
    if (n.id) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
    }

    setItems(prev =>
      prev.map(p => (p.id === n.id || p.localKey === n.localKey ? { ...p, read_at: new Date().toISOString() } : p))
    )
  }

  const markAll = async () => {
    const ids = items.filter(n => !n.read_at && n.id).map(n => n.id)

    if (ids.length) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids)
    }

    setItems(prev => prev.map(p => (p.read_at ? p : { ...p, read_at: new Date().toISOString() })))
  }

  const clearRead = () => {
    setItems(prev => prev.filter(p => !p.read_at))
  }

  // ----------------------------------------------------
  // Preferências
  // ----------------------------------------------------
  const loadPrefs = useCallback(async uid => {
    const { data, error } = await supabase
      .from('notification_prefs')
      .select('send_when, matrix')
      .eq('user_id', uid)
      .maybeSingle()

    if (!error && data) {
      setSendWhen(data.send_when || 'online')

      if (Array.isArray(data.matrix) && data.matrix.length) {
        setPrefsTable(data.matrix)
      }
    }
  }, [])

  const savePrefs = async e => {
    e?.preventDefault?.()
    if (!userId) return
    setSavingPrefs(true)

    try {
      await supabase.from('notification_prefs').upsert(
        {
          user_id: userId,
          send_when: sendWhen,
          matrix: prefsTable
        },
        { onConflict: 'user_id' }
      )
    } finally {
      setSavingPrefs(false)
    }
  }

  // ----------------------------------------------------
  // Browser notification permission
  // ----------------------------------------------------
  const requestBrowserPermission = async e => {
    e?.preventDefault?.()

    try {
      if (!('Notification' in window)) return
      const res = await Notification.requestPermission()

      // opcional: gerar uma notificação de teste
      if (res === 'granted') {
        new Notification('Notificações ativadas 🎉', { body: 'Você receberá alertas do GameFy neste navegador.' })
      }
    } catch {}
  }

  // ----------------------------------------------------
  // Boot / Realtime
  // ----------------------------------------------------
  useEffect(() => {
    let channel
    
    ;(async () => {
      const { data } = await getUser()
      const uid = data?.user?.id

      if (!uid) return
      setUserId(uid)

      setLoadingFeed(true)
      await Promise.all([
        fetchNotifications(uid),
        loadPrefs(uid),
        checkUpcomingEvents(uid),
        fetchMentions(uid),
        fetchGithubStatus(uid)
      ])
      setLoadingFeed(false)

      // Realtime para novas notificações
      channel = supabase
        .channel('notifications-feed')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
          payload => {
            const row = payload.new

            setItems(prev => [row, ...prev].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
          }
        )
        .subscribe()
    })()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [fetchNotifications, loadPrefs, checkUpcomingEvents, fetchMentions, fetchGithubStatus])

  // ----------------------------------------------------
  // Render
  // ----------------------------------------------------
  return (
    <Card>
      <CardHeader
        title='Notificações'
        subheader={
          <>
            Para enviar alertas no seu navegador, precisamos de permissão. &nbsp;
            <Link className='text-primary' href='#' onClick={requestBrowserPermission}>
              Permitir
            </Link>
          </>
        }
        action={
          <Stack direction='row' spacing={1}>
            <Tooltip title='Marcar todas como lidas'>
              <Button size='small' variant='outlined' onClick={markAll}>
                Marcar todas
              </Button>
            </Tooltip>
            <Tooltip title='Limpar notificações lidas da lista'>
              <Button size='small' color='secondary' variant='outlined' onClick={clearRead}>
                Limpar lidas
              </Button>
            </Tooltip>
          </Stack>
        }
      />

      {/* Preferences form (mantém o visual da sua tabela) */}
      <Form onSubmit={savePrefs}>
        <div className='overflow-x-auto'>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>E-mail</th>
                <th>Navegador</th>
                <th>App</th>
              </tr>
            </thead>
            <tbody className='border-be'>
              {prefsTable.map((row, idx) => (
                <tr key={idx}>
                  <td>
                    <Typography color='text.primary'>{row.type}</Typography>
                  </td>
                  <td>
                    <Checkbox
                      checked={!!row.email}
                      onChange={e => {
                        const next = [...prefsTable]

                        next[idx] = { ...next[idx], email: e.target.checked }
                        setPrefsTable(next)
                      }}
                    />
                  </td>
                  <td>
                    <Checkbox
                      checked={!!row.browser}
                      onChange={e => {
                        const next = [...prefsTable]

                        next[idx] = { ...next[idx], browser: e.target.checked }
                        setPrefsTable(next)
                      }}
                    />
                  </td>
                  <td>
                    <Checkbox
                      checked={!!row.app}
                      onChange={e => {
                        const next = [...prefsTable]

                        next[idx] = { ...next[idx], app: e.target.checked }
                        setPrefsTable(next)
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <CardContent>
          <Typography className='mbe-6 font-medium'>Quando devemos enviar as notificações?</Typography>
          <Grid container spacing={6}>
            <Grid item xs={12} sm={6} md={4}>
              <Select fullWidth value={sendWhen} onChange={e => setSendWhen(e.target.value)}>
                <MenuItem value='online'>Apenas quando eu estiver online</MenuItem>
                <MenuItem value='anytime'>A qualquer momento</MenuItem>
              </Select>
            </Grid>
            <Grid item xs={12} className='flex gap-4 flex-wrap'>
              <Button variant='contained' type='submit' disabled={savingPrefs}>
                {savingPrefs ? 'Salvando…' : 'Salvar alterações'}
              </Button>
              <Button
                variant='outlined'
                color='secondary'
                type='reset'
                onClick={() => {
                  setPrefsTable(DEFAULT_TABLE_DATA)
                  setSendWhen('online')
                }}
              >
                Resetar
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Form>

      {/* Feed de notificações funcionais */}
      <CardContent>
        <Typography className='mbe-4 font-medium'>
          {loadingFeed ? 'Carregando notificações…' : unreadCount ? `${unreadCount} não lida(s)` : 'Tudo em dia'}
        </Typography>

        {loadingFeed ? null : items.length === 0 ? (
          <Typography variant='body2' color='text.secondary'>
            Sem notificações por enquanto.
          </Typography>
        ) : (
          <List disablePadding>
            {items.map((n, idx) => {
              const when = n.created_at
                ? formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true, locale: ptBR })
                : ''

              const unread = !n.read_at

              return (
                <div key={n.id || n.localKey || idx}>
                  <ListItem
                    secondaryAction={
                      unread ? (
                        <Button size='small' variant='text' onClick={() => markAsRead(n)}>
                          Marcar como lida
                        </Button>
                      ) : null
                    }
                    sx={{
                      borderRadius: 2,
                      bgcolor: unread ? 'action.hover' : 'transparent'
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar>{typeIcon(n.type)}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap'>
                          <Typography className='font-medium' color='text.primary'>
                            {n.title || 'Notificação'}
                          </Typography>
                          {typeChip(n.type)}
                          <Typography variant='caption' color='text.secondary'>
                            {when}
                          </Typography>
                        </Stack>
                      }
                      secondary={<Typography variant='body2'>{n.body || ''}</Typography>}
                    />
                  </ListItem>
                  {idx < items.length - 1 && <Divider sx={{ my: 1.5 }} />}
                </div>
              )
            })}
          </List>
        )}
      </CardContent>
    </Card>
  )
}

export default Notifications
