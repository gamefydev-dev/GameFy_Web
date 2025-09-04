'use client'

// MUI Imports (mantidos)
import { useState } from 'react'

import { useRouter } from 'next/navigation'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Button from '@mui/material/Button'

// Extra

import { supabase } from '@/libs/supabaseAuth' // corrigido: lib/ (não libs/)

const AccountDelete = () => {
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  const handleDeactivate = async () => {
    setErrorMsg('')
    setLoading(true)

    try {
      const { data: u, error: userErr } = await supabase.auth.getUser()

      if (userErr) throw userErr

      const uid = u?.user?.id

      if (!uid) {
        throw new Error('Usuário não autenticado.')
      }

      const { error: updErr } = await supabase
        .from('users_app')
        .update({ deactivated_at: new Date().toISOString() })
        .eq('id', uid)

      if (updErr) throw updErr

      const { error: soErr } = await supabase.auth.signOut()

      if (soErr) throw soErr

      router.push('/login')
    } catch (err) {
      setErrorMsg('Não foi possível desativar a conta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader title='Desativar conta' />
      <CardContent className='flex flex-col items-start gap-6'>
        <FormControlLabel
          control={<Checkbox checked={checked} onChange={e => setChecked(e.target.checked)} />}
          label='Confirmo a desativação da minha conta'
        />

        <Button
          variant='contained'
          color='error'
          type='button'
          disabled={!checked || loading}
          onClick={handleDeactivate}
        >
          {loading ? 'Desativando…' : 'Desativar conta'}
        </Button>

        {errorMsg ? <span className='text-error'>{errorMsg}</span> : null}
      </CardContent>
    </Card>
  )
}

export default AccountDelete
