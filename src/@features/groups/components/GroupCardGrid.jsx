import { Grid, Card, CardHeader, CardContent, Typography, Stack, IconButton, Button } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { QRCodeSVG } from 'qrcode.react'

import { toMemberArray } from './utils'

export function GroupCardGrid({ groups, onOpenDetails, onDelete }) {
  return (
    <Grid container spacing={3}>
      {groups.map(g => (
        <Grid item xs={12} md={6} lg={4} key={g.id || g.code || g.group_name}>
          <Card onClick={() => onOpenDetails(g)} sx={{ cursor: 'pointer' }}>
            <CardHeader
              title={`Grupo ${g.group_name}`}
              subheader={`Código: ${g.code ?? '—'}`}
              action={
                <Stack direction='row' spacing={0.5}>
                  <IconButton
                    onClick={e => {
                      e.stopPropagation()
                      onOpenDetails(g)
                    }}
                    size='small'
                    aria-label='Editar'
                  >
                    <EditIcon fontSize='small' />
                  </IconButton>
                  <IconButton
                    onClick={e => {
                      e.stopPropagation()
                      onDelete(g)
                    }}
                    size='small'
                    aria-label='Excluir'
                  >
                    <DeleteIcon fontSize='small' />
                  </IconButton>
                </Stack>
              }
            />
            <CardContent>
              <Typography variant='body2' sx={{ mb: 1 }}>
                Integrantes:
              </Typography>
              <ul style={{ marginTop: 0 }}>
                {toMemberArray(g.members)
                  .slice(0, 5)
                  .map((m, idx) => (
                    <li key={m.email || m.full_name || idx}>
                      {m.full_name || '—'} {m.email ? `(${m.email})` : ''}
                    </li>
                  ))}
                {toMemberArray(g.members).length === 0 && <li style={{ color: '#777' }}>Nenhum integrante</li>}
              </ul>

              {g.github_url ? (
                <div style={{ marginTop: 8 }}>
                  <a href={g.github_url} onClick={e => e.stopPropagation()} target='_blank' rel='noopener noreferrer'>
                    <Button size='small' variant='outlined' startIcon={<i className='ri-github-line' />}>
                      GitHub do grupo
                    </Button>
                  </a>
                </div>
              ) : null}

              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <QRCodeSVG
                  value={g.qr_content || JSON.stringify({ code: g.code, group_name: g.group_name })}
                  size={128}
                />
              </div>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )
}
