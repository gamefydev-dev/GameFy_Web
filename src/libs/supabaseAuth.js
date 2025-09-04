// lib/supabaseAuth.js

// Importa o cliente JS do Supabase
import { createClient } from '@supabase/supabase-js'

// Lê variáveis do .env (devem existir no .env.local)
const SUPABASE_URL = process.env.NEXT_PUBLIC_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Ajuda a detectar problemas de configuração logo no início
  // (não quebra a build; apenas alerta no console do servidor/cliente)
  // eslint-disable-next-line no-console
  console.warn('[GameFy] Supabase .env ausentes: verifique NEXT_PUBLIC_URL e NEXT_PUBLIC_ANON_KEY')
}

// Singleton do cliente para evitar múltiplas instâncias
let _supabase

export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  }

  return _supabase
}

// Exporta também como conveniência
export const supabase = getSupabase()

/**
 * Utilitário para obter a URL de redirecionamento segura (client-side)
 * Cai para undefined em ambiente server para evitar erro de window
 */
function getRedirectURL(fallbackPath = '/') {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${fallbackPath.startsWith('/') ? fallbackPath : `/${fallbackPath}`}`
  }

  return undefined
}

/**
 * LOGIN com email/senha
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{data:any,error:any}>}
 */
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  return { data, error }
}

/**
 * LOGIN via OAuth (Google, GitHub, Facebook, Twitter, etc.)
 * @param {'google'|'github'|'facebook'|'twitter'|'azure'|'bitbucket'|'gitlab'|'keycloak'} provider
 * @param {string} [redirectPath='/'] caminho local para retornar após login
 */
export async function signInWithProvider(provider, redirectPath = '/') {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getRedirectURL(redirectPath)
    }
  })

  return { data, error }
}

/**
 * SIGN UP (registro)
 * @param {{email:string,password:string,metadata?:Record<string,any>,redirectPath?:string}} params
 */
export async function signUp({ email, password, metadata = {}, redirectPath = '/login' }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: getRedirectURL(redirectPath) // link de confirmação por email
    }
  })

  return { data, error }
}

/**
 * Solicita email de redefinição de senha
 * @param {string} email
 * @param {string} [redirectPath='/reset-password'] rota da sua página que troca a senha
 */
export async function resetPasswordForEmail(email, redirectPath = '/reset-password') {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getRedirectURL(redirectPath)
  })

  return { data, error }
}

/**
 * Atualiza a senha do usuário já autenticado (após entrar no app)
 * @param {string} newPassword
 */
export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword })

  return { data, error }
}

/**
 * Retorna sessão atual
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()

  return { data, error }
}

/**
 * Retorna usuário atual
 */
export async function getUser() {
  const { data, error } = await supabase.auth.getUser()

  return { data, error }
}

/**
 * Logout
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()

  return { error }
}

/**
 * Listener de mudanças na sessão (login/logout/refresh)
 * @param {(event:string, session:any)=>void} callback
 * @returns {() => void} unsubscribe
 */
export function initAuthListener(callback) {
  const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
    if (typeof callback === 'function') callback(event, session)
  })

  return () => {
    sub?.subscription?.unsubscribe?.()
  }
}
