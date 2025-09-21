import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  TextField,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
  Alert
} from '@mui/material'
import { QRCodeSVG } from 'qrcode.react'

import { supabase } from '@/libs/supabaseAuth'
import { toMemberArray, genCode } from './utils'

// Nova turma
export function ClassDialog({ open, onClose, form, setForm, afterSave }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth='xs' fullWidth>
      <DialogTitle>Nova turma</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <TextField
            label='Nome da turma'
            value={form.name}
            onChange={e => setForm(s => ({ ...s, name: e.target.value }))}
            size='small'
          />
          <TextField
            label='Semestre (número)'
            type='number'
            value={form.semester}
            onChange={e => setForm(s => ({ ...s, semester: e.target.value }))}
            size='small'
          />
          <TextField
            label='Curso (opcional)'
            value={form.course_id}
            onChange={e => setForm(s => ({ ...s, course_id: e.target.value }))}
            size='small'
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant='contained'
          onClick={async () => {
            const { name, semester, course_id } = form

            if (!name?.trim()) return

            const { error } = await supabase.from('classes').insert({
              name: name.trim(),
              semester: semester ? Number(semester) : null,
              course_id: course_id || null
            })

            if (error) throw error
            onClose()
            await afterSave?.()
          }}
        >
          Criar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// Novo grupo
export function NewGroupDialog({ open, onClose, form, setForm, onReplaceMembers, afterCreate }) {
  const empty = { full_name: '', email: '', github: '' }

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>Novo grupo</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <TextField
            label='Nome do grupo'
            value={form.group_name}
            onChange={e => setForm(s => ({ ...s, group_name: e.target.value }))}
            size='small'
          />
          <TextField
            label='Código (QR)'
            value={form.code}
            onChange={e => setForm(s => ({ ...s, code: e.target.value }))}
            size='small'
          />
          <TextField
            label='GitHub do grupo (opcional)'
            value={form.github_url}
            onChange={e => setForm(s => ({ ...s, github_url: e.target.value }))}
            size='small'
          />
          <TextField
            label='Semestre (número)'
            value={form.semester}
            onChange={e => setForm(s => ({ ...s, semester: e.target.value }))}
            size='small'
          />
          <TextField
            label='Turma (id ou nome)'
            value={form.class_id}
            onChange={e => setForm(s => ({ ...s, class_id: e.target.value }))}
            size='small'
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant='contained'
          onClick={async () => {
            const { group_name, class_id, code, semester, github_url, members } = form

            if (!group_name || !class_id) return

            const { data: created, error } = await supabase
              .from('pi_groups')
              .insert({
                name: group_name.trim(),
                class_id,
                code: code || genCode(),
                semester: semester ? Number(semester) : null,
                github_url: github_url || null
              })
              .select('id')
              .single()

            if (error) throw error
            await onReplaceMembers?.(created.id, members?.length ? members : [empty, empty, empty, empty])
            onClose()
            await afterCreate?.()
          }}
        >
          Criar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// Detalhes
export function GroupDetailsDialog({ open, onClose, group }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth='md' fullWidth>
      <DialogTitle>Detalhes do grupo</DialogTitle>
      <DialogContent dividers>
        {group ? (
          <Stack spacing={2}>
            <Typography variant='h6'>{group.group_name}</Typography>
            <Typography variant='body2' color='text.secondary'>
              Código: {group.code ?? '—'}
            </Typography>
            {group.github_url ? (
              <Typography variant='body2'>
                Repositório:{' '}
                <a href={group.github_url} target='_blank' rel='noopener noreferrer'>
                  {group.github_url}
                </a>
              </Typography>
            ) : null}
            <Typography variant='subtitle2'>Integrantes</Typography>
            <TableContainer component={Paper}>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Nome</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>GitHub</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {toMemberArray(group.members).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align='center'>
                        Nenhum integrante cadastrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    toMemberArray(group.members).map((m, i) => (
                      <TableRow key={m.email || m.full_name || i}>
                        <TableCell>{m.full_name || '—'}</TableCell>
                        <TableCell>{m.email || '—'}</TableCell>
                        <TableCell>{m.github || '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Stack alignItems='center' sx={{ mt: 2 }}>
              <QRCodeSVG value={JSON.stringify({ code: group.code, group_name: group.group_name })} size={160} />
            </Stack>
          </Stack>
        ) : (
          <Alert severity='info'>Selecione um grupo.</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  )
}

// Excluir
export function DeleteDialog({ open, onClose, target, onConfirm }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth='xs' fullWidth>
      <DialogTitle>Excluir grupo</DialogTitle>
      <DialogContent dividers>
        Confirma excluir o grupo <strong>{target?.group_name || target?.name || ''}</strong>?
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button color='error' variant='contained' onClick={onConfirm}>
          Excluir
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// Auto associar & importar
export function AutoImportDialog({
  open,
  onClose,
  source,
  groups,
  rowClass,
  setRowClass,
  rowSelect,
  setRowSelect,
  classes,
  setSnack,
  onImport
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>Auto associar & importar</DialogTitle>
      <DialogContent dividers>
        <Alert severity={source === 'excel' ? 'info' : 'warning'}>
          {source === 'excel'
            ? 'Use o botão abaixo para auto associar turmas; em seguida, importe os grupos selecionados (ou todos).'
            : 'Importe uma planilha primeiro.'}
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
        <Button
          variant='contained'
          onClick={async () => {
            if (source !== 'excel') return

            const selectedKeys = Object.entries(rowSelect)
              .filter(([, v]) => !!v)
              .map(([k]) => k)

            const list = selectedKeys.length ? groups.filter(g => selectedKeys.includes(String(g.id))) : groups

            if (!list.length) {
              setSnack({ open: true, msg: 'Nenhum grupo para importar.', sev: 'info' })

              return
            }

            await onImport(list)
          }}
        >
          Importar selecionados
        </Button>
      </DialogActions>
    </Dialog>
  )
}
