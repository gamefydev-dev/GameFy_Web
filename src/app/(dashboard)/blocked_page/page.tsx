'use client'

import React from 'react'

import { useRouter } from 'next/navigation'

import { Box, Card, CardContent, CardHeader, Typography, Button, Stack, Alert } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SchoolIcon from '@mui/icons-material/School'

type Props = {
  detail?: string

  /** Rota alternativa do botão "Voltar" caso não queira router.back() */
  backHref?: string
}

export default function StudentNoProfessorAccess({ detail, backHref }: Props) {
  const router = useRouter()

  const handleBack = () => {
    if (backHref) {
      router.push(backHref)
    } else {
      router.back()
    }
  }

  return (
    <Box
      sx={{
        minHeight: '60vh',
        display: 'grid',
        placeItems: 'center',
        px: 2
      }}
    >
      <Card
        variant='outlined'
        sx={{
          width: '100%',
          maxWidth: 640,
          borderRadius: 3
        }}
      >
        <CardHeader
          avatar={<LockOutlinedIcon color='error' />}
          title={
            <Typography variant='h6' fontWeight={900}>
              Acesso restrito
            </Typography>
          }
          subheader='Somente professores e coordenação podem acessar esta área.'
        />
        <CardContent>
          <Stack spacing={2}>
            <Alert severity='warning'>
              Você está logado como <strong>aluno</strong> e não possui permissão para ver as funções do professor.
            </Alert>

            {detail ? (
              <Typography variant='body2' color='text.secondary'>
                {detail}
              </Typography>
            ) : null}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1 }}>
              <Button variant='contained' startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ fontWeight: 800 }}>
                Voltar
              </Button>

              <Button variant='outlined' startIcon={<SchoolIcon />} onClick={() => router.push('/alunos/notas')}>
                Ir para Minhas Notas
              </Button>
            </Stack>

            <Typography variant='caption' color='text.secondary' sx={{ mt: 1 }}>
              Se você acredita que isto é um erro, entre em contato com o coordenador do PI para revisar suas
              permissões.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
