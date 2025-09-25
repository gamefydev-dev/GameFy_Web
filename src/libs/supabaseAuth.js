// lib/supabaseAuth.js
'use client'

import { createClient } from '@supabase/supabase-js'

// Aceita os dois conjuntos de variáveis (as “padrão” e as suas atuais)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[GameFy] Variáveis do Supabase ausentes: defina NEXT_PUBLIC_SUPABASE_URL/ANON_KEY (ou NEXT_PUBLIC_URL/ANON_KEY)'
  )
}

// ---------- client singleton ----------
let _supabase

export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  }

  return _supabase
}

export const supabase = getSupabase()

// ---------- helpers de sessão ----------
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()

  return { data, error }
}

export async function getUser() {
  const { data, error } = await supabase.auth.getUser()

  return { data, error }
}

export async function getSessionUser() {
  const { data } = await supabase.auth.getUser()

  return data?.user ?? null
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()

  return { error }
}

export function initAuthListener(callback) {
  const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
    if (typeof callback === 'function') callback(event, session)
  })

  return () => sub?.subscription?.unsubscribe?.()
}

// ---------- login/signup ----------
function getRedirectURL(fallbackPath = '/') {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${fallbackPath.startsWith('/') ? fallbackPath : `/${fallbackPath}`}`
  }

  return undefined
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  return { data, error }
}

export async function signInWithProvider(provider, redirectPath = '/') {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: getRedirectURL(redirectPath) }
  })

  return { data, error }
}

export async function signUp({ email, password, metadata = {}, redirectPath = '/login' }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata, // garante que role/name/etc vão para raw_user_meta_data
      emailRedirectTo: getRedirectURL(redirectPath)
    }
  })

  return { data, error }
}

export async function resetPasswordForEmail(email, redirectPath = '/reset-password') {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getRedirectURL(redirectPath)
  })

  return { data, error }
}

export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword })

  return { data, error }
}

// ---------- student/professor helpers ----------
export async function signUpStudent({ email, password, metadata = {} }) {
  // 1) cria conta no Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { ...metadata, role: 'student' } }
  })

  if (error) return { data, error }

  // 2) insere/atualiza no students (idempotente)
  const userId = data?.user?.id

  if (userId) {
    const insert = {
      id: userId, // PK = id
      email,
      name: metadata?.name ?? null,
      ra: metadata?.ra ?? null,
      class_code: metadata?.class_code ?? null
    }

    const { error: err2 } = await supabase.from('students').upsert(insert, { onConflict: 'id' }).select().single()

    if (err2) return { data, error: err2 }
  }

  return { data, error: null }
}

export async function signUpProfessor({ email, password, metadata = {} }) {
  // 1) cria conta com role=professor no Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { ...metadata, role: 'professor' } }
  })

  if (error) return { data, error }

  // 2) insere/atualiza em public.professors (idempotente)
  const userId = data?.user?.id

  if (userId) {
    const nowIso = new Date().toISOString()

    const insert = {
      id: userId, // PK = id (igual auth.users.id)
      email,
      name: metadata?.name ?? metadata?.username ?? email,
      role: 'Professor',
      avatar_url: `${userId}/avatar.jpeg`,
      is_active: true,
      created_at: nowIso,
      updated_at: nowIso

      // outros campos opcionais do seu schema podem ficar null
      // department, address, state, country, language, timezone, currency...
    }

    const { error: err2 } = await supabase.from('professors').upsert(insert, { onConflict: 'id' })

    if (err2) return { data, error: err2 }
  }

  return { data, error: null }
}

// Busca o perfil (student/professor)
export async function fetchCurrentProfile() {
  const { data: authUser } = await supabase.auth.getUser()
  const user = authUser?.user ?? null

  if (!user) return { role: null, profile: null }

  // students: PK = id
  const { data: s } = await supabase.from('students').select('*').eq('id', user.id).maybeSingle()

  if (s) return { role: 'student', profile: s }

  // professors: PK = id
  const { data: p } = await supabase.from('professors').select('*').eq('id', user.id).maybeSingle()

  if (p) return { role: 'professor', profile: p }

  return { role: null, profile: null }
}

// ---------- gate admin ----------
export const ADMIN_ROLES = ['owner', 'admin', 'administrator', 'professor', 'coordenador', 'coordinator']

const norm = s =>
  String(s || '')
    .trim()
    .toLowerCase()

export async function getAdminOrgs() {
  const user = await getSessionUser()

  if (!user) return []

  const { data: rows } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)

  const allowed = (rows || []).filter(r => ADMIN_ROLES.includes(norm(r.role)))

  if (!allowed.length) return []

  const orgIds = [...new Set(allowed.map(r => r.organization_id))]
  const { data: orgs } = await supabase.from('organizations').select('id, name, slug').in('id', orgIds)

  return orgs?.length ? orgs : orgIds.map(id => ({ id }))
}

export async function isAdmin() {
  const user = await getSessionUser()

  if (!user) return false

  // 1) app/user metadata
  const metaRoles = [
    user?.app_metadata?.role,
    ...(Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : []),
    user?.user_metadata?.role
  ]
    .flat()
    .filter(Boolean)
    .map(norm)

  if (metaRoles.some(r => ADMIN_ROLES.includes(r))) return true

  // 2) profiles.role (se existir tabela)
  try {
    // const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    // if (prof?.role && ADMIN_ROLES.includes(norm(prof.role))) return true
  } catch {
    /* ignore */
  }

  // 3) organization_members.role
  try {
    const { data: rows } = await supabase.from('organization_members').select('role').eq('user_id', user.id)

    if ((rows || []).some(r => ADMIN_ROLES.includes(norm(r.role)))) return true
  } catch {
    /* ignore */
  }

  return false
}

// ---------- util local ----------
function formatPath(p) {
  return p?.startsWith('/') ? p : `/${p || ''}`
}
