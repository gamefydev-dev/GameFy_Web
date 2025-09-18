'use client'

import { useEffect, useMemo, useState } from 'react'

// MUI
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import LinearProgress from '@mui/material/LinearProgress'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import Avatar from '@mui/material/Avatar'
import Badge from '@mui/material/Badge'

// Supabase (ajuste o caminho conforme seu projeto)
import { supabase } from '@/libs/supabaseAuth' // se usa '@/libs/supabaseAuth', troque aqui!

// Helpers visuais
const Medal = ({ place }) => {
  const cfg = {
    1: { label: '1º', color: 'warning', icon: 'ri-medal-2-line' },
    2: { label: '2º', color: 'secondary', icon: 'ri-medal-line' },
    3: { label: '3º', color: 'info', icon: 'ri-medal-fill' }
  }[place] || { label: `${place}º`, color: 'default', icon: 'ri-award-line' }

  return (
    <Chip size='small' color={cfg.color} icon={<i className={cfg.icon} />} label={cfg.label} sx={{ fontWeight: 600 }} />
  )
}

const formatAvg = n => (Number.isFinite(n) ? n.toFixed(2) : '—')

const Award = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([]) // ranking agregado por grupo
  const [evalsByGroup, setEvalsByGroup] = useState({}) // group_id -> [evaluations]
  const [groupMap, setGroupMap] = useState({}) // id -> { id, name }
  const [userMap, setUserMap] = useState({}) // id -> { id, name, role }

  // Dialogs
  const [openAll, setOpenAll] = useState(false)
  const [openDetails, setOpenDetails] = useState(false)
  const [detailsGroupId, setDetailsGroupId] = useState(null)

  // Carregar dados
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError('')

        // 1) Busca avaliações
        const { data: evs, error: errE } = await supabase
          .from('evaluations')
          .select('id, group_id, evaluator_id, evaluator_role, score, comment, created_at')
          .limit(1000)

        if (errE) throw errE
        const evaluations = Array.isArray(evs) ? evs : []

        // 2) Descobre grupos e avaliadores envolvidos
        const groupIds = Array.from(new Set(evaluations.map(e => e.group_id).filter(Boolean)))
        const evaluatorIds = Array.from(new Set(evaluations.map(e => e.evaluator_id).filter(Boolean)))

        // 3) Busca grupos
        let gMap = {}

        if (groupIds.length) {
          const { data: groups, error: errG } = await supabase.from('groups').select('id, name').in('id', groupIds)

          if (errG) throw errG
          gMap = Object.fromEntries((groups || []).map(g => [g.id, g]))
        }

        // 4) Busca usuários avaliadores (para mostrar nome/role)
        let uMap = {}

        if (evaluatorIds.length) {
          const { data: users, error: errU } = await supabase
            .from('professors')
            .select('id, name, role')
            .in('id', evaluatorIds)

          if (errU) throw errU
          uMap = Object.fromEntries((users || []).map(u => [u.id, u]))
        }

        // 5) Agrega por grupo
        const byGroup = {}
        const evalBucket = {}

        for (const e of evaluations) {
          if (!e.group_id) continue

          if (!byGroup[e.group_id]) {
            byGroup[e.group_id] = {
              group_id: e.group_id,
              evaluations: 0,
              sum: 0,
              avg: 0,
              profs: 0,
              students: 0
            }
            evalBucket[e.group_id] = []
          }

          byGroup[e.group_id].evaluations += 1
          byGroup[e.group_id].sum += Number(e.score) || 0
          if (String(e.evaluator_role).toLowerCase().includes('prof')) byGroup[e.group_id].profs += 1
          else byGroup[e.group_id].students += 1

          evalBucket[e.group_id].push(e)
        }

        // calcula média
        Object.values(byGroup).forEach(r => {
          r.avg = r.evaluations ? r.sum / r.evaluations : 0
        })

        // 6) Monta array ordenado: mais avaliações desc, desempate por média desc
        const ranking = Object.values(byGroup)
          .map(r => ({
            ...r,
            group: gMap[r.group_id] || { id: r.group_id, name: `Grupo ${r.group_id.slice?.(0, 6)}` }
          }))
          .sort((a, b) => {
            if (b.evaluations !== a.evaluations) return b.evaluations - a.evaluations

            return b.avg - a.avg
          })

        setRows(ranking)
        setEvalsByGroup(evalBucket)
        setGroupMap(gMap)
        setUserMap(uMap)
      } catch (err) {
        setError('Não foi possível carregar o ranking. Verifique as tabelas e permissões do Supabase.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const top3 = useMemo(() => rows.slice(0, 3), [rows])
  const others = useMemo(() => rows.slice(3), [rows])

  const selectedGroup = useMemo(
    () => (detailsGroupId ? groupMap[detailsGroupId] || { id: detailsGroupId } : null),
    [detailsGroupId, groupMap]
  )

  const selectedEvals = useMemo(
    () => (detailsGroupId ? evalsByGroup[detailsGroupId] || [] : []),
    [detailsGroupId, evalsByGroup]
  )

  return (
    <Card>
      <CardContent className='flex flex-col gap-3 relative items-start'>
        {/* Header */}
        <div>
          <Typography variant='h5'>Ranking dos Projetos de PI 🏆</Typography>
          <Typography variant='body2' color='text.secondary'>
            Top 3 grupos por quantidade de avaliações (desempate pela média da nota)
          </Typography>
        </div>

        {/* Loading / Erro */}
        {loading && <LinearProgress sx={{ width: '100%', mt: 1 }} />}
        {!!error && <Typography color='error'>{error}</Typography>}

        {/* Conteúdo */}
        {!loading && !error && rows.length === 0 && (
          <Typography variant='body2' color='text.secondary'>
            Ainda não há avaliações.
          </Typography>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            {/* TOP 3 */}
            <Stack direction='row' spacing={2} sx={{ mt: 1, flexWrap: 'wrap' }}>
              {top3.map((r, idx) => (
                <Card key={r.group_id} sx={{ p: 2, minWidth: 240 }}>
                  <Stack spacing={1}>
                    <Stack direction='row' spacing={1} alignItems='center' justifyContent='space-between'>
                      <Stack direction='row' spacing={1} alignItems='center'>
                        <Medal place={idx + 1} />
                        <Typography variant='subtitle1' color='text.primary' fontWeight={600}>
                          {r.group?.name || `Grupo ${r.group_id.slice?.(0, 6)}`}
                        </Typography>
                      </Stack>
                      <Tooltip title='Quantidade de avaliações'>
                        <Badge badgeContent={r.evaluations} color='primary'>
                          <i className='ri-ball-pen-line' />
                        </Badge>
                      </Tooltip>
                    </Stack>

                    <Stack direction='row' spacing={2}>
                      <Chip
                        size='small'
                        icon={<i className='ri-star-smile-line' />}
                        label={`Média: ${formatAvg(r.avg)}`}
                      />
                      <Chip size='small' icon={<i className='ri-book-2-line' />} label={`Prof: ${r.profs}`} />
                      <Chip size='small' icon={<i className='ri-team-line' />} label={`Alunos: ${r.students}`} />
                    </Stack>

                    <Stack direction='row' spacing={1}>
                      <Button
                        size='small'
                        variant='contained'
                        onClick={() => {
                          setDetailsGroupId(r.group_id)
                          setOpenDetails(true)
                        }}
                      >
                        Detalhes
                      </Button>
                      <Button size='small' variant='outlined' onClick={() => setOpenAll(true)}>
                        Ver todos
                      </Button>
                    </Stack>
                  </Stack>
                </Card>
              ))}
            </Stack>

            {/* Imagem decorativa mantida (opcional) */}
            <img
              src='/images/pages/trophy.png'
              alt='troféu'
              height={96}
              className='absolute inline-end-7 bottom-6 opacity-90'
            />
          </>
        )}

        {/* Dialog: Ranking completo */}
        <Dialog open={openAll} onClose={() => setOpenAll(false)} maxWidth='md' fullWidth>
          <DialogTitle>Ranking completo</DialogTitle>
          <DialogContent dividers>
            <List disablePadding>
              {rows.map((r, idx) => (
                <div key={r.group_id}>
                  <ListItem
                    secondaryAction={
                      <Button
                        size='small'
                        onClick={() => {
                          setDetailsGroupId(r.group_id)
                          setOpenDetails(true)
                        }}
                      >
                        Detalhes
                      </Button>
                    }
                  >
                    <ListItemText
                      primary={
                        <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap'>
                          <Medal place={idx + 1} />
                          <Typography color='text.primary' fontWeight={600}>
                            {r.group?.name || `Grupo ${r.group_id.slice?.(0, 6)}`}
                          </Typography>
                        </Stack>
                      }
                      secondary={
                        <Stack direction='row' spacing={2} sx={{ mt: 0.5 }}>
                          <Typography variant='body2'>
                            Avaliações: <b>{r.evaluations}</b>
                          </Typography>
                          <Typography variant='body2'>
                            Média: <b>{formatAvg(r.avg)}</b>
                          </Typography>
                          <Typography variant='body2'>
                            Prof: <b>{r.profs}</b>
                          </Typography>
                          <Typography variant='body2'>
                            Alunos: <b>{r.students}</b>
                          </Typography>
                        </Stack>
                      }
                    />
                  </ListItem>
                  {idx < rows.length - 1 && <Divider />}
                </div>
              ))}
            </List>
          </DialogContent>
        </Dialog>

        {/* Dialog: Detalhes do grupo */}
        <Dialog open={openDetails} onClose={() => setOpenDetails(false)} maxWidth='md' fullWidth>
          <DialogTitle>
            Detalhes — {selectedGroup?.name || (detailsGroupId ? `Grupo ${detailsGroupId.slice?.(0, 6)}` : '')}
          </DialogTitle>
          <DialogContent dividers>
            {selectedEvals.length === 0 ? (
              <Typography variant='body2' color='text.secondary'>
                Sem avaliações para este grupo.
              </Typography>
            ) : (
              <List disablePadding>
                {selectedEvals
                  .slice()
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .map((e, i) => {
                    const person = userMap[e.evaluator_id]
                    const who = person?.name || e.evaluator_id?.slice?.(0, 8) || 'Avaliador'
                    const role = person?.role || e.evaluator_role || ''

                    return (
                      <div key={e.id || i}>
                        <ListItem alignItems='flex-start'>
                          <Avatar sx={{ mr: 2 }}>
                            <i
                              className={
                                String(role).toLowerCase().includes('prof') ? 'ri-book-2-line' : 'ri-user-3-line'
                              }
                            />
                          </Avatar>
                          <ListItemText
                            primary={
                              <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap'>
                                <Typography color='text.primary' fontWeight={600}>
                                  {who}
                                </Typography>
                                <Chip size='small' label={role || '—'} />
                                <Chip
                                  size='small'
                                  color='primary'
                                  icon={<i className='ri-star-smile-line' />}
                                  label={`Nota: ${formatAvg(e.score)}`}
                                />
                              </Stack>
                            }
                            secondary={
                              <Typography variant='body2' sx={{ mt: 0.5 }}>
                                {e.comment || <em>Sem comentário</em>}
                              </Typography>
                            }
                          />
                        </ListItem>
                        {i < selectedEvals.length - 1 && <Divider />}
                      </div>
                    )
                  })}
              </List>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

export default Award
