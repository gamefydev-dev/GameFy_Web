'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'

import { fetchCurrentProfile } from '@/libs/supabaseAuth'

/**
 * Envolve a navegação. Se o usuário for "student", mostra apenas o link /alunos/notas.
 * Se for professor/admin, renderiza a navegação original (children).
 */
export default function StudentGuard({ children }) {
  const [role, setRole] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        const { role: r } = await fetchCurrentProfile()

        if (!alive) return
        setRole(r || null)
      } finally {
        if (alive) setReady(true)
      }
    })()

    return () => {
      alive = false
    }
  }, [])

  // Enquanto carrega, não renderiza nada para evitar “piscar” o menu
  if (!ready) return null

  if (role === 'student') {
    return (
      <nav>
        <Link href='/alunos/notas'>Minhas Notas</Link>
      </nav>
    )
  }

  return children || null
}
