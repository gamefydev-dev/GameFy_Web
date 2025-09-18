'use client'

// React
import { useEffect, useRef, useState } from 'react'

// MUI
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
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'

// Supabase helpers (corrigido: lib/ e não libs/)
import { supabase, getUser } from '@/libs/supabaseAuth'

const AVATAR_BUCKET = 'avatars_admin'
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 7 // 7 dias
const FALLBACK_AVATAR = '/images/avatars/1.png'
const MAX_FILE_BYTES = 800 * 1024

const languageOptions = ['Portuguese', 'English', 'Spanish', 'French', 'German']

const initialData = {
  firstName: '',
  lastName: '',
  email: '',
  organization: '',
  phoneNumber: '',
  address: '',
  state: '',
  zipCode: '',
  country: 'br',
  language: 'portuguese',
  timezone: 'gmt-03',
  currency: 'brl'
}

// Normaliza o valor salvo no banco para um caminho válido do Storage
function normalizeAvatarPath(raw) {
  if (!raw) return ''
  const val = String(raw).trim()

  if (/^https?:\/\//i.test(val)) return val
  let p = val.replace(/^\/+/, '')

  if (p.startsWith(`${AVATAR_BUCKET}/`)) p = p.slice(AVATAR_BUCKET.length + 1)

  return p
}

// Assina URL ou cai para public URL se o bucket/objeto for público
async function getAvatarUrl(path) {
  if (!path) return FALLBACK_AVATAR
  if (/^https?:\/\//i.test(path)) return path

  const { data: signed, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, SIGNED_URL_EXPIRY)

  if (!error && signed?.signedUrl) return signed.signedUrl

  const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  const bust = `cb=${Date.now()}`

  return pub?.publicUrl ? `${pub.publicUrl}${pub.publicUrl.includes('?') ? '&' : '?'}${bust}` : FALLBACK_AVATAR
}

export default function AccountDetails() {
  const [formData, setFormData] = useState(initialData)
  const [imgSrc, setImgSrc] = useState(FALLBACK_AVATAR)
  const [language, setLanguage] = useState(['Portuguese'])

  const [userId, setUserId] = useState('')
  const [avatarPath, setAvatarPath] = useState('')
  const [fileInput, setFileInput] = useState('')

  const [saving, setSaving] = useState(false)
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' })
  const fileRef = useRef(null)

  const handleDeleteChip = value => setLanguage(current => current.filter(item => item !== value))
  const handleChangeChips = event => setLanguage(event.target.value)
  const setField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }))

  // Carrega dados do usuário + professors
  useEffect(() => {
    ;(async () => {
      try {
        const { data: u } = await getUser()
        const user = u?.user

        if (!user) return

        setUserId(user.id)

        const { data: profile } = await supabase
          .from('professors')
          .select('name, role, avatar_url, contact, address, state, zip_code, country, language, timezone, currency')
          .eq('id', user.id)
          .maybeSingle()

        const fullName =
          profile?.name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || ''

        const [firstName, ...lastParts] = (fullName || '').split(' ')
        const lastName = lastParts.join(' ')

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
          language: Array.isArray(profile?.language) ? profile.language[0] : profile?.language || 'Portuguese',
          timezone: profile?.timezone || 'gmt-03',
          currency: profile?.currency || 'brl'
        })

        setLanguage(Array.isArray(profile?.language) ? profile.language : [profile?.language || 'Portuguese'])

        const normalized = normalizeAvatarPath(profile?.avatar_url || user.user_metadata?.avatar_url || '')

        setAvatarPath(normalized)
        setImgSrc(await getAvatarUrl(normalized))
      } catch (e) {
        setImgSrc(FALLBACK_AVATAR)
      }
    })()
  }, [])

  // Upload e preview
  const handleFileInputChange = async ev => {
    const f = ev.target.files?.[0]

    if (!f || !userId) return

    if (f.size > MAX_FILE_BYTES) {
      setSnack({ open: true, msg: 'Imagem acima de 800KB', sev: 'error' })
      if (fileRef.current) fileRef.current.value = ''

      return
    }

    const reader = new FileReader()

    reader.onload = () => setImgSrc(reader.result || FALLBACK_AVATAR)
    reader.readAsDataURL(f)

    const ext = (f.name.split('.').pop() || 'png').toLowerCase()
    const path = `${userId}/avatar.${ext}`

    const { error: upErr } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, f, { upsert: true, cacheControl: '3600' })

    if (upErr) {
      setSnack({ open: true, msg: 'Falha ao enviar imagem', sev: 'error' })

      return
    }

    setAvatarPath(path)
    const url = await getAvatarUrl(path)

    setImgSrc(url)

    // Salva o caminho relativo no professors
    await supabase.from('professors').upsert({ id: userId, avatar_url: path }, { onConflict: 'id' })
    setSnack({ open: true, msg: 'Foto atualizada', sev: 'success' })
  }

  const handleFileInputReset = async () => {
    setFileInput('')
    setImgSrc(FALLBACK_AVATAR)
    if (fileRef.current) fileRef.current.value = ''
    if (!userId) return
    await supabase.from('professors').update({ avatar_url: null }).eq('id', userId)
    setAvatarPath('')
  }

  const handleSave = async e => {
    e.preventDefault()
    if (!userId) return

    setSaving(true)

    try {
      const name = [formData.firstName, formData.lastName].filter(Boolean).join(' ').trim() || null

      const payload = {
        id: userId,
        name,
        role: formData.organization || null,
        contact: formData.phoneNumber || null,
        address: formData.address || null,
        state: formData.state || null,
        zip_code: formData.zipCode || null,
        country: formData.country || 'br',
        language: language && language.length ? language : [formData.language || 'Portuguese'],
        timezone: formData.timezone || 'gmt-03',
        currency: formData.currency || 'brl',
        avatar_url: avatarPath || null
      }

      const { error } = await supabase.from('professors').upsert(payload, { onConflict: 'id' })

      if (error) throw error

      // (Opcional) manter 'profiles' em sincronia para exibir nome/role em outros pontos
      await supabase
        .from('profiles')
        .upsert({ id: userId, full_name: payload.name, role: payload.role }, { onConflict: 'id' })

      setSnack({ open: true, msg: 'Dados salvos!', sev: 'success' })
    } catch {
      setSnack({ open: true, msg: 'Erro ao salvar', sev: 'error' })
    } finally {
      setSaving(false)
    }
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
                  accept='image/png, image/jpeg, image/gif'
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
                onChange={e => setField('firstName', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label='Sobrenome'
                value={formData.lastName}
                placeholder='Seu sobrenome'
                onChange={e => setField('lastName', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField fullWidth label='E-mail' value={formData.email} disabled placeholder='voce@exemplo.com' />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label='Categoria (Professor(a)/Admin)'
                value={formData.organization}
                placeholder='professor | professora | admin'
                onChange={e => setField('organization', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label='Telefone/WhatsApp'
                value={formData.phoneNumber}
                placeholder='(xx) xxxxx-xxxx'
                onChange={e => setField('phoneNumber', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label='Endereço'
                value={formData.address}
                placeholder='Rua, número, bairro'
                onChange={e => setField('address', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label='Estado'
                value={formData.state}
                placeholder='SP, RJ...'
                onChange={e => setField('state', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type='text'
                label='CEP'
                value={formData.zipCode}
                placeholder='00000-000'
                onChange={e => setField('zipCode', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>País</InputLabel>
                <Select label='País' value={formData.country} onChange={e => setField('country', e.target.value)}>
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
                  onChange={handleChangeChips}
                  renderValue={selected => (
                    <div className='flex flex-wrap gap-2'>
                      {selected.map(value => (
                        <Chip
                          key={value}
                          clickable
                          deleteIcon={<i className='ri-close-circle-fill' onMouseDown={e => e.stopPropagation()} />}
                          size='small'
                          label={value}
                          onDelete={() => handleDeleteChip(value)}
                        />
                      ))}
                    </div>
                  )}
                >
                  {languageOptions.map(name => (
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
                  onChange={e => setField('timezone', e.target.value)}
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
                <Select label='Moeda' value={formData.currency} onChange={e => setField('currency', e.target.value)}>
                  <MenuItem value='brl'>BRL</MenuItem>
                  <MenuItem value='usd'>USD</MenuItem>
                  <MenuItem value='eur'>EUR</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} className='flex gap-4 flex-wrap'>
              <Button variant='contained' type='submit' disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </Button>
              <Button variant='outlined' type='reset' color='secondary' onClick={() => setFormData(initialData)}>
                Resetar
              </Button>
            </Grid>
          </Grid>
        </form>
      </CardContent>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert onClose={() => setSnack(s => ({ ...s, open: false }))} severity={snack.sev} sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Card>
  )
}
