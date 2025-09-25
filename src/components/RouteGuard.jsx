'use client'

import { useEffect, useState } from 'react'

import { useRouter, usePathname } from 'next/navigation'

import { CircularProgress, Box } from '@mui/material'

import { fetchCurrentProfile } from '@/libs/supabaseAuth'

/**
 * RouteGuard
 * - Bloqueia ALUNOS (role === 'student') quando allowStudents = false
 * - Bloqueia usuários sem sessão/perfil (role null/undefined)
 * - Libera professores/coordenação
 *
 * Props:
 * - allowStudents?: boolean (default false) → se true, alunos passam
 * - loginPath?: string (default '/login')
 * - blockedPath?: string (default '/app/blocked_page')
 */
export default function RouteGuard({
  children,
  allowStudents = false,
  loginPath = '/login',
  blockedPath = '/app/blocked_page'
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        // Deve retornar { role } quando logado; null/undefined se não logado
        const profile = await fetchCurrentProfile()
        const role = profile?.role ?? null

        // Sem sessão/perfil → envia para login
        if (!role) {
          const to = `${loginPath}?redirect=${encodeURIComponent(pathname)}`

          if (alive) router.replace(to)

          return
        }

        // Aluno e não permitido aqui → envia para página de bloqueio
        if (role === 'student' && !allowStudents) {
          const to = `${blockedPath}?from=${encodeURIComponent(pathname)}`

          if (alive) router.replace(to)

          return
        }

        // Permitido → renderiza conteúdo
        if (alive) setChecking(false)
      } catch (e) {
        // Erro ao checar → tratar como não autenticado
        const to = `${loginPath}?redirect=${encodeURIComponent(pathname)}`

        if (alive) router.replace(to)
      }
    })()

    return () => {
      alive = false
    }
  }, [router, pathname, allowStudents, loginPath, blockedPath])

  // Loading enquanto verifica / redireciona
  if (checking) {
    return (
      <Box
        sx={{
          height: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          px: 2
        }}
      >
        <CircularProgress />
        <span>Verificando permissões…</span>
      </Box>
    )
  }

  // Autorizado
  return children
}
