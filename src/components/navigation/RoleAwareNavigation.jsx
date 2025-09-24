'use client'

import { useEffect, useMemo, useState } from 'react'

import { fetchCurrentProfile } from '@/libs/supabaseAuth'

// Exemplo genérico de item de navegação:
// { label: 'Dashboard', path: '/prof/dashboard', icon: <.../>, children: [...] }
// Você pode adaptar para o shape que já usa hoje.
function filterByRole(items, role) {
  if (role === 'professor') return items

  // Para alunos: permitir apenas /alunos/notas (e filhos, se houver)
  const allowPath = '/alunos/notas'

  const keepItem = item =>
    item?.path === allowPath ||
    (item?.path && item.path.startsWith(allowPath + '/')) ||
    (Array.isArray(item?.children) && item.children.some(keepItem))

  // Faz uma cópia filtrando recursivamente
  const filterTree = list =>
    (list || [])
      .map(it => ({
        ...it,
        children: it.children ? filterTree(it.children) : undefined
      }))
      .filter(keepItem)

  return filterTree(items)
}

export default function RoleAwareNavigation({ items, NavComponent }) {
  const [role, setRole] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let isMounted = true

    ;(async () => {
      try {
        const { role: r } = await fetchCurrentProfile()

        if (!isMounted) return
        setRole(r || null)
      } finally {
        if (isMounted) setReady(true)
      }
    })()

    return () => {
      isMounted = false
    }
  }, [])

  const filtered = useMemo(() => filterByRole(items, role), [items, role])

  // Enquanto carrega, você pode retornar skeleton/placeholder
  if (!ready) return null

  // NavComponent é o componente real do seu menu lateral (ex.: <VerticalNav items={...} />)
  // Assim você não precisa reescrever seu visual.
  return <NavComponent items={filtered} />
}
