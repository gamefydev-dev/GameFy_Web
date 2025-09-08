'use client'

import { useEffect, useMemo, useState } from 'react'

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import {
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Chip,
  Tooltip,
  Divider,
  Typography,
  Autocomplete,
  Checkbox,
  FormControlLabel
} from '@mui/material'
import { Add, Edit, Delete, ContentPaste, Label as LabelIcon } from '@mui/icons-material'
import { format } from 'date-fns'
import ptBR from 'date-fns/locale/pt-BR'

import { supabase } from '@/libs/supabaseAuth'

const fmt = d => (d ? format(new Date(d), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '')

export default function KanbanPage() {
  const [board, setBoard] = useState(null)
  const [columns, setColumns] = useState([]) // [{id,title,position}]
  const [cardsByCol, setCardsByCol] = useState({}) // {colId: [cards]}
  const [labels, setLabels] = useState([])
  const [faculty, setFaculty] = useState([])
  const [isFaculty, setIsFaculty] = useState(false)

  // dialogs
  const [openCol, setOpenCol] = useState(false)
  const [colForm, setColForm] = useState({ id: null, title: '' })

  const [openCard, setOpenCard] = useState(false)

  const [cardForm, setCardForm] = useState({
    id: null,
    board_id: null,
    column_id: null,
    title: '',
    description: '',
    due_date: '',
    archived: false,
    assignees: [],
    label_ids: []
  })

  // ------------ load helpers -------------
  async function ensureBoard() {
    // pega primeiro board existente; se não houver, cria um
    const { data: me } = await supabase.auth.getUser()
    const uid = me?.user?.id

    const { data: b1 } = await supabase
      .from('kanban_boards')
      .select('id, title')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (b1) return b1
    if (!uid) throw new Error('Não autenticado')

    const { data: created, error } = await supabase
      .from('kanban_boards')
      .insert({ title: 'Kanban da Fecap Tech', created_by: uid })
      .select('id, title')
      .single()

    if (error) throw error

    // cria colunas padrão
    await supabase.from('kanban_columns').insert([
      { board_id: created.id, title: 'A Fazer', position: 0 },
      { board_id: created.id, title: 'Em Progresso', position: 1 },
      { board_id: created.id, title: 'Concluído', position: 2 }
    ])

    return created
  }

  async function loadBoard() {
    const b = await ensureBoard()

    setBoard(b)

    // permissão
    const { data: isAdm } = await supabase.rpc('is_admin')

    setIsFaculty(!!isAdm)

    // faculty para atribuição
    const { data: fac } = await supabase.rpc('search_faculty', { q: null })

    setFaculty(fac || [])

    // labels
    const { data: labs } = await supabase
      .from('kanban_labels')
      .select('*')
      .eq('board_id', b.id)
      .order('name', { ascending: true })

    setLabels(labs || [])

    // columns
    const { data: cols } = await supabase
      .from('kanban_columns')
      .select('*')
      .eq('board_id', b.id)
      .order('position', { ascending: true })

    setColumns(cols || [])

    // cards por coluna
    const { data: cards } = await supabase
      .from('kanban_cards')
      .select('id, board_id, column_id, title, description, due_date, position, archived')
      .eq('board_id', b.id)
      .order('position', { ascending: true })

    const map = {}

    ;(cols || []).forEach(c => (map[c.id] = []))
    ;(cards || []).forEach(cd => {
      if (!map[cd.column_id]) map[cd.column_id] = []
      map[cd.column_id].push(cd)
    })
    setCardsByCol(map)
  }

  useEffect(() => {
    loadBoard()
  }, [])

  // ------------- CRUD columns -------------
  const openNewColumn = () => {
    setColForm({ id: null, title: '' })
    setOpenCol(true)
  }
  const openEditColumn = col => {
    setColForm({ id: col.id, title: col.title })
    setOpenCol(true)
  }

  const saveColumn = async () => {
    if (!board) return
    if (!colForm.title?.trim()) return

    if (!colForm.id) {
      await supabase
        .from('kanban_columns')
        .insert({ board_id: board.id, title: colForm.title, position: columns.length })
    } else {
      await supabase.from('kanban_columns').update({ title: colForm.title }).eq('id', colForm.id)
    }

    setOpenCol(false)
    await loadBoard()
  }

  const deleteColumn = async colId => {
    if (!confirm('Excluir esta coluna e todos os cards dentro?')) return
    await supabase.from('kanban_columns').delete().eq('id', colId)
    await loadBoard()
  }

  // ------------- CRUD cards ---------------
  const openNewCard = column => {
    setCardForm({
      id: null,
      board_id: board.id,
      column_id: column.id,
      title: '',
      description: '',
      due_date: '',
      archived: false,
      assignees: [],
      label_ids: []
    })
    setOpenCard(true)
  }

  const openEditCard = async card => {
    // carrega assignees e labels
    const { data: asgs } = await supabase.from('kanban_card_assignees').select('user_id').eq('card_id', card.id)

    const assignees = (asgs || []).map(a => faculty.find(f => f.user_id === a.user_id)).filter(Boolean)

    const { data: labs } = await supabase.from('kanban_card_labels').select('label_id').eq('card_id', card.id)

    const label_ids = (labs || []).map(l => l.label_id)

    setCardForm({
      id: card.id,
      board_id: card.board_id,
      column_id: card.column_id,
      title: card.title,
      description: card.description || '',
      due_date: card.due_date ? new Date(card.due_date).toISOString().slice(0, 16) : '',
      archived: !!card.archived,
      assignees,
      label_ids
    })
    setOpenCard(true)
  }

  const saveCard = async () => {
    const payload = {
      board_id: cardForm.board_id,
      column_id: cardForm.column_id,
      title: cardForm.title?.trim(),
      description: cardForm.description || null,
      due_date: cardForm.due_date ? new Date(cardForm.due_date).toISOString() : null,
      archived: !!cardForm.archived
    }

    let cardId = cardForm.id

    if (!cardId) {
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id

      const { data, error } = await supabase
        .from('kanban_cards')
        .insert({ ...payload, position: cardsByCol[cardForm.column_id]?.length || 0, created_by: uid })
        .select('id')
        .single()

      if (error) throw error
      cardId = data.id
    } else {
      await supabase.from('kanban_cards').update(payload).eq('id', cardId)
    }

    // sincroniza assignees
    const { data: prevA } = await supabase.from('kanban_card_assignees').select('user_id').eq('card_id', cardId)

    const prevIds = new Set((prevA || []).map(a => a.user_id))
    const nextIds = new Set((cardForm.assignees || []).map(a => a.user_id))
    const toRemove = [...prevIds].filter(id => !nextIds.has(id))
    const toAdd = [...nextIds].filter(id => !prevIds.has(id))

    if (toRemove.length)
      await supabase.from('kanban_card_assignees').delete().eq('card_id', cardId).in('user_id', toRemove)
    if (toAdd.length)
      await supabase.from('kanban_card_assignees').insert(toAdd.map(id => ({ card_id: cardId, user_id: id })))

    // sincroniza labels
    const { data: prevL } = await supabase.from('kanban_card_labels').select('label_id').eq('card_id', cardId)

    const prevLab = new Set((prevL || []).map(l => l.label_id))
    const nextLab = new Set(cardForm.label_ids || [])
    const labRemove = [...prevLab].filter(id => !nextLab.has(id))
    const labAdd = [...nextLab].filter(id => !prevLab.has(id))

    if (labRemove.length)
      await supabase.from('kanban_card_labels').delete().eq('card_id', cardId).in('label_id', labRemove)
    if (labAdd.length)
      await supabase.from('kanban_card_labels').insert(labAdd.map(id => ({ card_id: cardId, label_id: id })))

    setOpenCard(false)
    await loadBoard()
  }

  const deleteCard = async cardId => {
    if (!confirm('Excluir este card?')) return
    await supabase.from('kanban_cards').delete().eq('id', cardId)
    await loadBoard()
  }

  // ------------- DND handlers -------------
  const onDragEnd = async result => {
    const { destination, source, draggableId, type } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    if (type === 'COLUMN') {
      // mover coluna
      await supabase.rpc('kanban_move_column', {
        p_board_id: board.id,
        p_column_id: draggableId,
        p_new_index: destination.index
      })
      await loadBoard()

      return
    }

    // mover card
    const cardId = draggableId
    const fromCol = source.droppableId
    const toCol = destination.droppableId
    const toIndex = destination.index

    await supabase.rpc('kanban_move_card', {
      p_board_id: board.id,
      p_card_id: cardId,
      p_to_column_id: toCol,
      p_to_index: toIndex
    })
    await loadBoard()
  }

  // ------------- UI helpers --------------
  const columnCards = colId => cardsByCol[colId] || []

  // ------------- Render ------------------
  return (
    <div style={{ padding: 16 }}>
      <Stack direction='row' alignItems='center' spacing={2} sx={{ mb: 2 }}>
        <Typography variant='h5'>Kanban</Typography>
        <div style={{ flex: 1 }} />
        <Button variant='outlined' startIcon={<Add />} onClick={openNewColumn}>
          Nova Coluna
        </Button>
      </Stack>

      {board && (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId='board' direction='horizontal' type='COLUMN'>
            {provided => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                style={{ display: 'flex', gap: 16, alignItems: 'flex-start', overflowX: 'auto' }}
              >
                {columns.map((col, idx) => (
                  <Draggable draggableId={col.id} index={idx} key={col.id}>
                    {provCol => (
                      <div
                        ref={provCol.innerRef}
                        {...provCol.draggableProps}
                        style={{ ...provCol.draggableProps.style, minWidth: 320 }}
                      >
                        <Card>
                          <CardHeader
                            title={col.title}
                            action={
                              <Stack direction='row' spacing={1}>
                                <Tooltip title='Renomear'>
                                  <IconButton size='small' onClick={() => openEditColumn(col)}>
                                    <Edit fontSize='inherit' />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title='Excluir coluna'>
                                  <IconButton size='small' color='error' onClick={() => deleteColumn(col.id)}>
                                    <Delete fontSize='inherit' />
                                  </IconButton>
                                </Tooltip>
                                <span {...provCol.dragHandleProps} style={{ cursor: 'grab' }}>
                                  <Tooltip title='Arraste para mover'>
                                    <IconButton size='small'>
                                      <ContentPaste fontSize='inherit' />
                                    </IconButton>
                                  </Tooltip>
                                </span>
                              </Stack>
                            }
                          />
                          <CardContent>
                            <Button fullWidth size='small' startIcon={<Add />} onClick={() => openNewCard(col)}>
                              Novo card
                            </Button>
                            <Divider sx={{ my: 1 }} />
                            <Droppable droppableId={col.id} type='CARD'>
                              {prov => (
                                <div ref={prov.innerRef} {...prov.droppableProps}>
                                  {columnCards(col.id).map((cd, i) => (
                                    <Draggable draggableId={cd.id} index={i} key={cd.id}>
                                      {provCard => (
                                        <div
                                          ref={provCard.innerRef}
                                          {...provCard.draggableProps}
                                          {...provCard.dragHandleProps}
                                        >
                                          <Card sx={{ mb: 1, cursor: 'pointer' }} onClick={() => openEditCard(cd)}>
                                            <CardContent>
                                              <Typography variant='subtitle2'>{cd.title}</Typography>
                                              {cd.due_date && (
                                                <Typography variant='caption' color='text.secondary'>
                                                  Venc.: {fmt(cd.due_date)}
                                                </Typography>
                                              )}
                                            </CardContent>
                                          </Card>
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {prov.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Dialog Coluna */}
      <Dialog open={openCol} onClose={() => setOpenCol(false)}>
        <DialogTitle>{colForm.id ? 'Renomear coluna' : 'Nova coluna'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label='Título da coluna'
            fullWidth
            sx={{ mt: 1 }}
            value={colForm.title}
            onChange={e => setColForm({ ...colForm, title: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCol(false)}>Cancelar</Button>
          <Button onClick={saveColumn} variant='contained'>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Card */}
      <Dialog open={openCard} onClose={() => setOpenCard(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{cardForm.id ? 'Editar card' : 'Novo card'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label='Título'
              value={cardForm.title}
              onChange={e => setCardForm({ ...cardForm, title: e.target.value })}
              fullWidth
            />
            <TextField
              label='Descrição'
              value={cardForm.description}
              onChange={e => setCardForm({ ...cardForm, description: e.target.value })}
              fullWidth
              multiline
              minRows={3}
            />
            <TextField
              type='datetime-local'
              label='Data de vencimento'
              value={cardForm.due_date}
              onChange={e => setCardForm({ ...cardForm, due_date: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />

            <Autocomplete
              multiple
              options={faculty}
              value={cardForm.assignees}
              onChange={(e, val) => setCardForm({ ...cardForm, assignees: val })}
              getOptionLabel={o => `${o.full_name} (${o.email})`}
              renderInput={params => (
                <TextField {...params} label='Responsáveis (professores)' placeholder='Buscar...' />
              )}
              onInputChange={async (e, v) => {
                const { data } = await supabase.rpc('search_faculty', { q: v || null })

                setFaculty(data || [])
              }}
            />

            <Autocomplete
              multiple
              options={labels}
              value={labels.filter(l => cardForm.label_ids.includes(l.id))}
              onChange={(e, val) => setCardForm({ ...cardForm, label_ids: val.map(x => x.id) })}
              getOptionLabel={o => o.name}
              renderTags={value => (
                <Stack direction='row' spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {value.map(v => (
                    <Chip key={v.id} icon={<LabelIcon />} label={v.name} sx={{ background: v.color, color: '#fff' }} />
                  ))}
                </Stack>
              )}
              renderInput={params => <TextField {...params} label='Labels' placeholder='Selecionar labels' />}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={cardForm.archived}
                  onChange={e => setCardForm({ ...cardForm, archived: e.target.checked })}
                />
              }
              label='Arquivado'
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          {cardForm.id ? (
            <Button color='error' onClick={() => deleteCard(cardForm.id)}>
              Excluir
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => setOpenCard(false)}>Cancelar</Button>
          <Button variant='contained' onClick={saveCard}>
            {cardForm.id ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
