// src/app/(dashboard)/calendario/page.jsx
'use client'

import { useEffect, useRef, useState } from 'react'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import ptBr from '@fullcalendar/core/locales/pt-br'

import {
  Card,
  CardHeader,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Stack,
  Snackbar,
  Alert,
  Autocomplete
} from '@mui/material'

import { supabase } from '@/libs/supabaseAuth'

const iso = dt => (dt instanceof Date ? dt : new Date(dt)).toISOString()

export default function CalendarPage() {
  // Guarda o intervalo como string para evitar loops
  const [range, setRange] = useState({ startIso: null, endIso: null })
  const lastRangeRef = useRef({ startIso: null, endIso: null })

  const [events, setEvents] = useState([])
  const [isFaculty, setIsFaculty] = useState(false)
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' })

  // Dialog
  const [open, setOpen] = useState(false)

  const [form, setForm] = useState({
    id: null,
    title: '',
    description: '',
    location: '',
    start_at: null,
    end_at: null,
    all_day: false,
    color: '#1976d2',
    published: true,
    attendees: []
  })

  const [facultyOptions, setFacultyOptions] = useState([])

  // Helpers
  const loadFaculty = async (q = null) => {
    const { data, error } = await supabase.rpc('search_faculty', { q })

    if (!error) setFacultyOptions(data || [])
  }

  const loadEvents = async () => {
    if (!range.startIso || !range.endIso) return

    try {
      // 1) Eventos do Supabase
      const { data: evs, error: e1 } = await supabase
        .from('calendar_events')
        .select('id, title, description, location, start_at, end_at, all_day, color, published, created_by')
        .gte('start_at', range.startIso)
        .lte('end_at', range.endIso)
        .order('start_at', { ascending: true })

      if (e1) throw e1

      const ids = (evs || []).map(e => e.id)
      let attendeesByEvent = new Map()

      if (ids.length) {
        const { data: atts } = await supabase
          .from('calendar_event_attendees')
          .select('event_id, user_id')
          .in('event_id', ids)

        attendeesByEvent = new Map(ids.map(id => [id, []]))
        ;(atts || []).forEach(a => {
          const arr = attendeesByEvent.get(a.event_id) || []

          arr.push(a.user_id)
          attendeesByEvent.set(a.event_id, arr)
        })
      }

      const supaEvents = (evs || []).map(e => ({
        id: e.id,
        title: e.title,
        start: e.start_at,
        end: e.end_at,
        allDay: e.all_day,
        backgroundColor: e.color || undefined,
        borderColor: e.color || undefined,
        extendedProps: {
          ...e,
          attendee_ids: attendeesByEvent.get(e.id) || [],
          source: 'supabase'
        }
      }))

      // 2) Eventos da Fecap Tech (API route)
      let fecapEvents = []

      try {
        const res = await fetch(
          `/api/fecaptech-events?start=${encodeURIComponent(range.startIso)}&end=${encodeURIComponent(range.endIso)}`
        )

        const json = await res.json()

        if (Array.isArray(json?.events)) fecapEvents = json.events
      } catch (_) {
        // se a API cair, seguimos com os do supabase
      }

      // 3) Mescla
      setEvents([...supaEvents, ...fecapEvents])
    } catch {
      setSnack({ open: true, msg: 'Erro ao carregar eventos', sev: 'error' })
    }
  }

  // Permissão
  useEffect(() => {
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id

      if (!uid) {
        setIsFaculty(false)

        return
      }

      const { data: isAdm } = await supabase.rpc('is_admin')

      setIsFaculty(!!isAdm)

      if (isAdm == null) {
        const { data: fac } = await supabase.rpc('search_faculty', { q: null })

        setIsFaculty((fac || []).some(f => f.user_id === uid))
      }

      await loadFaculty()
    })()
  }, [])

  // Carrega quando o range mudar
  useEffect(() => {
    loadEvents()
  }, [range.startIso, range.endIso])

  // Handlers do calendário
  const onDateClick = arg => {
    if (!isFaculty) return
    const start = arg.date
    const end = new Date(start.getTime() + (arg.allDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000))

    setForm({
      id: null,
      title: '',
      description: '',
      location: '',
      start_at: start,
      end_at: end,
      all_day: !!arg.allDay,
      color: '#1976d2',
      published: true,
      attendees: []
    })
    setOpen(true)
  }

  const onEventClick = async clickInfo => {
    const e = clickInfo.event
    const ep = e.extendedProps || {}

    // Eventos da Fecap (source= fecaptech) são somente leitura
    if (ep.source === 'fecaptech') return

    const { data: ids } = await supabase.from('calendar_event_attendees').select('user_id').eq('event_id', e.id)

    let selected = []

    if (ids?.length) {
      const idList = ids.map(x => x.user_id)
      const { data: fac } = await supabase.rpc('search_faculty', { q: null })

      selected = (fac || []).filter(f => idList.includes(f.user_id))
    }

    setForm({
      id: e.id,
      title: e.title,
      description: ep.description || '',
      location: ep.location || '',
      start_at: e.start,
      end_at: e.end || e.start,
      all_day: !!ep.all_day,
      color: ep.color || '#1976d2',
      published: !!ep.published,
      attendees: selected
    })
    setOpen(true)
  }

  const onEventDropOrResize = async changeInfo => {
    const ep = changeInfo.event.extendedProps || {}

    if (!isFaculty || ep.source === 'fecaptech') {
      changeInfo.revert()

      return
    }

    try {
      const ev = changeInfo.event

      const { error } = await supabase
        .from('calendar_events')
        .update({ start_at: iso(ev.start), end_at: iso(ev.end || ev.start), all_day: ev.allDay })
        .eq('id', ev.id)

      if (error) throw error
      setSnack({ open: true, msg: 'Evento atualizado', sev: 'success' })
    } catch {
      setSnack({ open: true, msg: 'Erro ao atualizar datas', sev: 'error' })
      changeInfo.revert()
    }
  }

  const saveEvent = async () => {
    if (!isFaculty) return

    const payload = {
      title: form.title?.trim(),
      description: form.description || null,
      location: form.location || null,
      start_at: iso(form.start_at),
      end_at: iso(form.end_at),
      all_day: !!form.all_day,
      color: form.color || null,
      published: !!form.published
    }

    try {
      let eventId = form.id

      if (!eventId) {
        const { data: u } = await supabase.auth.getUser()
        const uid = u?.user?.id

        const { data, error } = await supabase
          .from('calendar_events')
          .insert({ ...payload, created_by: uid })
          .select('id')
          .single()

        if (error) throw error
        eventId = data.id
      } else {
        const { error } = await supabase.from('calendar_events').update(payload).eq('id', eventId)

        if (error) throw error
      }

      const { data: prev } = await supabase.from('calendar_event_attendees').select('user_id').eq('event_id', eventId)

      const prevIds = new Set((prev || []).map(p => p.user_id))
      const nextIds = new Set((form.attendees || []).map(a => a.user_id))

      const toRemove = [...prevIds].filter(id => !nextIds.has(id))

      if (toRemove.length) {
        const { error } = await supabase
          .from('calendar_event_attendees')
          .delete()
          .eq('event_id', eventId)
          .in('user_id', toRemove)

        if (error) throw error
      }

      const toAdd = [...nextIds].filter(id => !prevIds.has(id))

      if (toAdd.length) {
        const rows = toAdd.map(uid => ({ event_id: eventId, user_id: uid, role: 'professor' }))
        const { error } = await supabase.from('calendar_event_attendees').insert(rows)

        if (error) throw error
      }

      setOpen(false)
      await loadEvents()
      setSnack({ open: true, msg: 'Evento salvo', sev: 'success' })
    } catch (err) {
      setSnack({ open: true, msg: err.message || 'Erro ao salvar', sev: 'error' })
    }
  }

  const deleteEvent = async () => {
    if (!isFaculty || !form.id) return

    try {
      const { error } = await supabase.from('calendar_events').delete().eq('id', form.id)

      if (error) throw error
      setOpen(false)
      await loadEvents()
      setSnack({ open: true, msg: 'Evento excluído', sev: 'success' })
    } catch (err) {
      setSnack({ open: true, msg: err.message || 'Erro ao excluir', sev: 'error' })
    }
  }

  return (
    <Card>
      <CardHeader
        title='Calendário'
        subheader={isFaculty ? 'Você pode criar/editar/excluir eventos' : 'Visualização'}
      />
      <CardContent>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          locales={[ptBr]}
          locale='pt-br'
          firstDay={1}
          initialView='dayGridMonth'
          height='auto'
          selectable={isFaculty}
          editable={isFaculty}
          droppable={false}
          eventResizableFromStart
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
          }}
          events={events}
          datesSet={({ start, end }) => {
            const startIso = start.toISOString()
            const endIso = end.toISOString()
            const prev = lastRangeRef.current

            if (prev.startIso !== startIso || prev.endIso !== endIso) {
              lastRangeRef.current = { startIso, endIso }
              setRange({ startIso, endIso })
            }
          }}
          dateClick={onDateClick}
          eventClick={onEventClick}
          eventDrop={onEventDropOrResize}
          eventResize={onEventDropOrResize}
          nowIndicator
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        />
      </CardContent>

      {/* Dialog Criar/Editar */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{form.id ? 'Editar evento' : 'Novo evento'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label='Título'
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              fullWidth
            />
            <TextField
              label='Descrição'
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label='Local'
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                type='datetime-local'
                label='Início'
                value={form.start_at ? new Date(form.start_at).toISOString().slice(0, 16) : ''}
                onChange={e => setForm(f => ({ ...f, start_at: new Date(e.target.value) }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                type='datetime-local'
                label='Fim'
                value={form.end_at ? new Date(form.end_at).toISOString().slice(0, 16) : ''}
                onChange={e => setForm(f => ({ ...f, end_at: new Date(e.target.value) }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            <Stack direction='row' spacing={2} alignItems='center'>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.all_day}
                    onChange={e => setForm(f => ({ ...f, all_day: e.target.checked }))}
                  />
                }
                label='Dia inteiro'
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.published}
                    onChange={e => setForm(f => ({ ...f, published: e.target.checked }))}
                  />
                }
                label='Publicado'
              />
              <TextField
                type='color'
                label='Cor'
                value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                sx={{ width: 120 }}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            <Autocomplete
              multiple
              options={facultyOptions}
              getOptionLabel={o => `${o.full_name} (${o.email})`}
              value={form.attendees}
              onChange={(e, val) => setForm(f => ({ ...f, attendees: val }))}
              filterSelectedOptions
              renderInput={params => (
                <TextField {...params} label='Professores / Participantes' placeholder='Buscar...' />
              )}
              onInputChange={async (e, v) => {
                await loadFaculty(v)
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          {form.id ? (
            <Button color='error' onClick={deleteEvent}>
              Excluir
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant='contained' onClick={saveEvent}>
            {form.id ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert onClose={() => setSnack(s => ({ ...s, open: false }))} severity={snack.sev} sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Card>
  )
}
