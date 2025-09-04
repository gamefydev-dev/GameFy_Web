'use client'

// React
import { useEffect, useRef, useState } from 'react'

// MUI Imports (mantidos)
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'

// Supabase helpers (CORRIGIDO: lib/ e não libs/)
import { supabase, getUser } from '@/libs/supabaseAuth'

const AVATAR_BUCKET = 'avatars_admin'
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 7 // 7 dias
const FALLBACK_AVATAR = '/images/avatars/1.png'

// Estado inicial apenas para placeholders visuais (mantido o shape)
const initialData = {
  firstName: '',
  lastName: '',
  email: '',
  organization: '', // usaremos p/ exibir a categoria/role
  phoneNumber: '',
  address: '',
  state: '',
  zipCode: '',
  country: 'br',
  language: 'portuguese',
  timezone: 'gmt-03',
  currency: 'brl'
}

const languageData = ['Portuguese', 'English', 'Spanish', 'French', 'German']

// Normaliza o valor salvo no banco para um caminho válido do Storage:
// - se já for http(s), retorna como está (URL direta)
// - se vier com "avatars_admin/..." remove o prefixo do bucket
// - remove barras iniciais redundantes
function normalizeAvatarPath(raw) {
  if (!raw) return ''
  const val = String(raw).trim()

  if (/^https?:\/\//i.test(val)) return val
  let p = val.replace(/^\/+/, '')

  if (p.startsWith(`${AVATAR_BUCKET}/`)) p = p.slice(AVATAR_BUCKET.length + 1)

  return p
}

// Tenta gerar uma URL utilizável a partir do caminho no bucket
async function getAvatarUrl(path) {
  // Se já é URL absoluta, devolve
  if (/^https?:\/\//i.test(path)) return path

  // 1) Tenta Signed URL (bucket privado com RLS)
  const { data: signed, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, SIGNED_URL_EXPIRY)

  if (!error && signed?.signedUrl) return signed.signedUrl

  // 2) Fallback para Public URL (se o objeto/bucket for público)
  const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)

  // cache-busting leve para evitar imagem antiga
  const bust = `cb=${Date.now()}`

  return pub?.publicUrl ? `${pub.publicUrl}${pub.publicUrl.includes('?') ? '&' : '?'}${bust}` : FALLBACK_AVATAR
}

const AccountDetails = () => {
  // States (mantidos)
  const [formData, setFormData] = useState(initialData)
  const [fileInput, setFileInput] = useState('')
  const [imgSrc, setImgSrc] = useState(FALLBACK_AVATAR)
  const [language, setLanguage] = useState(['Portuguese'])

  // Supabase control
  const [userId, setUserId] = useState('')
  const [avatarPath, setAvatarPath] = useState('')
  const fileRef = useRef(null)

  // Helpers visuais (mantidos)
  const handleDelete = value => setLanguage(current => current.filter(item => item !== value))
  const handleChange = event => setLanguage(event.target.value)
  const handleFormChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }))

  // Carregar perfil do Supabase
  useEffect(() => {
    const load = async () => {
      try {
        const { data: u } = await getUser()
        const user = u?.user

        if (!user) return

        setUserId(user.id)

        // Busca users_app
        const { data: profile } = await supabase
          .from('users_app')
          .select('name, role, avatar_url, contact, address, state, zip_code, country, language, timezone, currency')
          .eq('id', user.id)
          .maybeSingle()

        const fullName =
          profile?.name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || ''

        const [firstName, ...lastParts] = fullName.split(' ')
        const lastName = lastParts.join(' ')

        // Monta estado mantendo o mesmo shape visual
        setFormData({
          firstName: firstName || '',
          lastName: lastName || '',
          email: user.email || '',
          organization: profile?.role || user.user_metadata?.role || '',
          phoneNumber: profile?.contact || '',
          address: profile?.address || '',
          state: profile?.state || '',
          zipCode: profile?.zip_code || '',
          country: profile?.country || 'br',
          language: profile?.language || 'portuguese',
          timezone: profile?.timezone || 'gmt-03',
          currency: profile?.currency || 'brl'
        })

        // Idiomas (chips)
        setLanguage(Array.isArray(profile?.language) ? profile.language : [profile?.language || 'Portuguese'])

        // Avatar
        const rawPath = profile?.avatar_url || user.user_metadata?.avatar_url || ''
        const normalized = normalizeAvatarPath(rawPath)

        setAvatarPath(normalized)

        if (normalized) {
          const url = await getAvatarUrl(normalized)

          setImgSrc(url)
        } else {
          setImgSrc(FALLBACK_AVATAR)
        }
      } catch {
        setImgSrc(FALLBACK_AVATAR)
      }
    }

    load()
  }, [])

  // Upload/preview (mantido o estilo)
  const handleFileInputChange = async ev => {
    const f = ev.target.files?.[0]

    if (!f || !userId) return

    // Preview imediato
    const reader = new FileReader()

    reader.onload = () => setImgSrc(reader.result || FALLBACK_AVATAR)
    reader.readAsDataURL(f)

    // Envia para Storage
    const ext = f.name.split('.').pop()
    const fileName = `avatar.${ext || 'png'}`
    const path = `${userId}/${fileName}`

    const { error: upErr } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, f, { upsert: true, cacheControl: '3600' })

    if (upErr) return

    setAvatarPath(path)

    // Salva no perfil (sempre caminho relativo!)
    await supabase.from('users_app').update({ avatar_url: path }).eq('id', userId)

    // Atualiza preview com URL utilizável
    const url = await getAvatarUrl(path)

    setImgSrc(url)
  }

  const handleFileInputReset = () => {
    setFileInput('')
    setImgSrc(FALLBACK_AVATAR)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Salvar (mantendo o mesmo botão “Save Changes”)
  const handleSave = async e => {
    e.preventDefault()

    const name = [formData.firstName, formData.lastName].filter(Boolean).join(' ').trim()

    const payload = {
      id: userId,
      name: name || null,
      role: formData.organization || null, // mapeando o campo "Organization" p/ categoria (professor/professora/admin)
      contact: formData.phoneNumber || null,
      address: formData.address || null,
      state: formData.state || null,
      zip_code: formData.zipCode || null,
      country: formData.country || null,
      language: language && language.length ? language : formData.language || null,
      timezone: formData.timezone || null,
      currency: formData.currency || null
    }

    await supabase.from('users_app').upsert(payload, { onConflict: 'id' })
  }

  return (
    <Card>
      <CardContent className='mbe-5'>
        <div className='flex max-sm:flex-col items-center gap-6'>
          <img height={100} width={100} className='rounded' src={imgSrc} alt='Profile' />
          <div className='flex flex-grow flex-col gap-4'>
            <div className='flex flex-col sm:flex-row gap-4'>
              <Button component='label' size='small' variant='contained' htmlFor='account-settings-upload-image'>
                Enviar nova foto
                <input
                  ref={fileRef}
                  hidden
                  type='file'
                  value={fileInput}
                  accept='image/png, image/jpeg'
                  onChange={handleFileInputChange}
                  id='account-settings-upload-image'
                />
              </Button>
              <Button size='small' variant='outlined' color='error' onClick={handleFileInputReset}>
                Resetar
              </Button>
            </div>
            <Typography>Permitido JPG, GIF ou PNG. Tamanho máx. 800K</Typography>
          </div>
        </div>
      </CardContent>

      <CardContent>
        <form onSubmit={handleSave}>
          <Grid container spacing={5}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label='Nome'
                value={formData.firstName}
                placeholder='Seu nome'
                onChange={e => handleFormChange('firstName', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label='Sobrenome'
                value={formData.lastName}
                placeholder='Seu sobrenome'
                onChange={e => handleFormChange('lastName', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label='E-mail'
                value={formData.email}
                placeholder='voce@exemplo.com'
                disabled
                onChange={e => handleFormChange('email', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label='Categoria (Professor(a)/Admin)'
                value={formData.organization}
                placeholder='professor | professora | admin'
                onChange={e => handleFormChange('organization', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label='Telefone/WhatsApp'
                value={formData.phoneNumber}
                placeholder='(xx) xxxxx-xxxx'
                onChange={e => handleFormChange('phoneNumber', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label='Endereço'
                value={formData.address}
                placeholder='Rua, número, bairro'
                onChange={e => handleFormChange('address', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label='Estado'
                value={formData.state}
                placeholder='SP, RJ...'
                onChange={e => handleFormChange('state', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type='text'
                label='CEP'
                value={formData.zipCode}
                placeholder='00000-000'
                onChange={e => handleFormChange('zipCode', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>País</InputLabel>
                <Select
                  label='País'
                  value={formData.country}
                  onChange={e => handleFormChange('country', e.target.value)}
                >
                  <MenuItem value='br'>Brasil</MenuItem>
                  <MenuItem value='usa'>USA</MenuItem>
                  <MenuItem value='uk'>UK</MenuItem>
                  <MenuItem value='de'>Alemanha</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Idioma(s)</InputLabel>
                <Select
                  multiple
                  label='Idioma(s)'
                  value={language}
                  onChange={handleChange}
                  renderValue={selected => (
                    <div className='flex flex-wrap gap-2'>
                      {selected.map(value => (
                        <Chip
                          key={value}
                          clickable
                          deleteIcon={
                            <i className='ri-close-circle-fill' onMouseDown={event => event.stopPropagation()} />
                          }
                          size='small'
                          label={value}
                          onDelete={() => handleDelete(value)}
                        />
                      ))}
                    </div>
                  )}
                >
                  {languageData.map(name => (
                    <MenuItem key={name} value={name}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Fuso horário</InputLabel>
                <Select
                  label='Fuso horário'
                  value={formData.timezone}
                  onChange={e => handleFormChange('timezone', e.target.value)}
                  MenuProps={{ PaperProps: { style: { maxHeight: 250 } } }}
                >
                  <MenuItem value='gmt-03'>(GMT-03:00) Brasília</MenuItem>
                  <MenuItem value='gmt-04'>(GMT-04:00) Manaus</MenuItem>
                  <MenuItem value='gmt-05'>(GMT-05:00) Acre</MenuItem>
                  <MenuItem value='gmt-02'>(GMT-02:00) Fernando de Noronha</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Moeda</InputLabel>
                <Select
                  label='Moeda'
                  value={formData.currency}
                  onChange={e => handleFormChange('currency', e.target.value)}
                >
                  <MenuItem value='brl'>BRL</MenuItem>
                  <MenuItem value='usd'>USD</MenuItem>
                  <MenuItem value='eur'>EUR</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} className='flex gap-4 flex-wrap'>
              <Button variant='contained' type='submit'>
                Salvar alterações
              </Button>
              <Button variant='outlined' type='reset' color='secondary' onClick={() => setFormData(initialData)}>
                Resetar
              </Button>
            </Grid>
          </Grid>
        </form>
      </CardContent>
    </Card>
  )
}

export default AccountDetails
