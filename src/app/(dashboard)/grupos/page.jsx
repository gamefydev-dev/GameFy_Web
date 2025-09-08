'use client'

import { useEffect, useState } from 'react'

// MUI
import { Card, CardHeader, CardContent, Typography, Grid, Button, Alert, LinearProgress } from '@mui/material'

// QR Code
import { QRCodeSVG } from 'qrcode.react'

import { supabase } from '@/libs/supabaseAuth'

export default function GroupsPage() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const loadGroups = async () => {
      try {
        setLoading(true)
        setError('')

        // checa se o usuário é admin/professor/coordenador
        const { data: adminCheck, error: errAdmin } = await supabase.rpc('is_admin')

        if (!errAdmin) setIsAdmin(adminCheck)

        // busca os grupos com membros
        const { data, error } = await supabase
          .from('groups_with_members')
          .select('*')
          .order('code', { ascending: true })

        if (error) throw error
        setGroups(data || [])
      } catch (e) {
        console.error(e)
        setError(e.message || 'Erro ao carregar grupos')
      } finally {
        setLoading(false)
      }
    }

    loadGroups()
  }, [])

  if (loading) return <LinearProgress />
  if (error) return <Alert severity='error'>{error}</Alert>

  return (
    <Grid container spacing={3}>
      {groups.map(g => (
        <Grid item xs={12} md={6} lg={4} key={g.id}>
          <Card>
            <CardHeader title={`Grupo ${g.group_name}`} subheader={`Código: ${g.code}`} />
            <CardContent>
              <Typography variant='body2' sx={{ mb: 1 }}>
                Membros ({g.members_count}):
              </Typography>
              <ul>
                {g.members?.map(m => (
                  <li key={m.email}>
                    {m.full_name} ({m.email})
                  </li>
                ))}
              </ul>

              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <QRCodeSVG value={g.qr_content} size={128} />
              </div>

              {isAdmin && (
                <Button
                  variant='contained'
                  color='primary'
                  sx={{ mt: 2 }}
                  onClick={() => alert(`Adicionar membro ao grupo ${g.code}`)}
                >
                  Adicionar Membro
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )
}
