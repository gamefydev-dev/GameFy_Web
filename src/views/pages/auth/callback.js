// pages/auth/callback.js
import { useEffect } from 'react'

import { useRouter } from 'next/router'

import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuth = async () => {
      const supabase = createBrowserSupabaseClient()
      const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href)

      if (error) {
        console.error('Erro ao trocar código pela sessão:', error)
      }

      // pega o ?redirect=... ou manda pro "/"
      const redirectTo = router.query.redirect || '/'

      router.replace(redirectTo)
    }

    handleAuth()
  }, [router])

  return <p>Finalizando login...</p>
}
