// src/libs/forms.js
import { supabase } from '@/libs/supabaseAuth'

const BUCKET = 'form_covers'

// Normaliza extensão e content-type
function getExtAndContentType(file) {
  const ext = (file?.name?.split('.').pop() || 'jpg').toLowerCase()

  const contentType = file?.type || (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg')

  return { ext, contentType }
}

/**
 * Upload da capa do formulário.
 * Caminho privado aceito pelas policies: <uid>/<formId>/cover.<ext>
 * Usa upsert para evitar 409 quando substituir a capa.
 */
export async function uploadFormCover(file, formId) {
  if (!file || !formId) throw new Error('Arquivo ou formId ausentes.')

  const { data: u, error: uErr } = await supabase.auth.getUser()

  if (uErr) throw uErr
  const uid = u?.user?.id

  if (!uid) throw new Error('Não autenticado')

  const { ext, contentType } = getExtAndContentType(file)
  const path = `${uid}/${formId}/cover.${ext}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, cacheControl: '3600', contentType })

  if (upErr) throw upErr

  const { data: signed, error: sErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24) // 24h

  if (sErr) throw sErr

  return { path, url: signed?.signedUrl || '' }
}

/**
 * upsertForm
 * - INSERT quando não houver id
 * - UPDATE quando houver id
 * Aceita opcionalmente cover_path (se você quiser persistir depois do upload).
 */
export async function upsertForm({ id, title, description, slug, is_published, cover_path } = {}) {
  const { data: u, error: userErr } = await supabase.auth.getUser()

  if (userErr) throw userErr
  const owner = u?.user?.id

  if (!owner) throw new Error('Usuário não autenticado')

  const base = {
    owner,
    title,
    description: description ?? null,
    slug: slug ?? null,
    is_published: !!is_published,
    ...(cover_path ? { cover_path } : {})
  }

  if (!id) {
    // INSERT (não enviar id → usa DEFAULT do Postgres)
    const { data, error } = await supabase
      .from('forms')
      .insert(base)
      .select('id, title, slug, is_published, cover_path, owner')
      .single()

    if (error) throw error

    return data
  } else {
    // UPDATE por id
    const { data, error } = await supabase
      .from('forms')
      .update(base)
      .eq('id', id)
      .select('id, title, slug, is_published, cover_path, owner')
      .single()

    if (error) throw error

    return data
  }
}

/**
 * replaceQuestions
 * - apaga e recria as questões do form, na ordem recebida
 * No banco a coluna é 'position' (não 'order_index').
 * Retornamos com alias 'order_index' para não quebrar sua UI.
 */
export async function replaceQuestions(formId, questions) {
  if (!formId) throw new Error('formId vazio')

  // Remove todas as anteriores (RLS: apenas dono consegue)
  const { error: delErr } = await supabase.from('form_questions').delete().eq('form_id', formId)

  if (delErr) throw delErr

  const rows = (questions || []).map((q, idx) => ({
    form_id: formId,
    position: idx, // <- coluna correta no SQL
    type: q.type,
    label: q.label,
    required: !!q.required,
    options: q.options && q.options.length ? q.options : null
  }))

  if (!rows.length) return []

  const { data, error } = await supabase
    .from('form_questions')
    .insert(rows)
    .select('id, type, label, required, options, order_index:position') // alias p/ UI

  if (error) throw error

  // já vem ordenado pelo array; se quiser garantir:
  return [...data].sort((a, b) => a.order_index - b.order_index)
}

/**
 * getFormBySlug
 * - retorna form + questões (só permite visualizar se publicado)
 * Evita 409 com limit(1) + maybeSingle().
 */
export async function getFormBySlug(slug) {
  if (!slug) throw new Error('Slug ausente.')

  const { data: form, error: fe } = await supabase
    .from('forms')
    .select('id, title, description, cover_path, slug, is_published')
    .eq('slug', slug)
    .limit(1)
    .maybeSingle()

  if (fe) throw fe
  if (!form) throw new Error('Formulário não encontrado.')
  if (!form.is_published) throw new Error('Formulário não publicado.')

  const { data: questions, error: qe } = await supabase
    .from('form_questions')
    .select('id, type, label, required, options, order_index:position')
    .eq('form_id', form.id)
    .order('position', { ascending: true })

  if (qe) throw qe

  return { form, questions: questions || [] }
}

/**
 * submitForm
 * - cria (ou reaproveita) a submissão do usuário e grava respostas
 * Usa as tabelas: form_submissions + form_answers
 */
export async function submitForm({ formId, answersMap }) {
  if (!formId) throw new Error('formId ausente.')
  const { data: u, error: uErr } = await supabase.auth.getUser()

  if (uErr) throw uErr
  const uid = u?.user?.id || null

  // 1) Pega submissão existente do usuário para este form (1 por usuário)
  const { data: existing, error: qErr } = await supabase
    .from('form_submissions')
    .select('id')
    .eq('form_id', formId)
    .eq('respondent_user_id', uid)
    .limit(1)
    .maybeSingle()

  if (qErr) throw qErr

  let submissionId = existing?.id

  // 2) Se não existir, cria
  if (!submissionId) {
    const { data: sub, error: sErr } = await supabase
      .from('form_submissions')
      .insert({ form_id: formId, respondent_user_id: uid })
      .select('id')
      .single()

    if (sErr) throw sErr
    submissionId = sub.id
  }

  // 3) Monta respostas (jsonb)
  const entries = Object.entries(answersMap || {})

  if (!entries.length) return { submissionId }

  const toJsonValue = v => {
    if (Array.isArray(v)) return v
    if (v === null || v === undefined) return null
    if (typeof v === 'number' || typeof v === 'boolean') return v
    if (typeof v === 'object') return v // já é JSON

    return String(v) // string/others
  }

  const items = entries.map(([question_id, value]) => ({
    submission_id: submissionId,
    form_id: formId,
    question_id,
    value: toJsonValue(value)
  }))

  // 4) Insere respostas (sem upsert para manter “uma vez só”)
  const { error: aErr } = await supabase.from('form_answers').insert(items)

  if (aErr) {
    // Se já respondeu mesmas perguntas: unique(submission_id, question_id)
    if (aErr.code === '23505') {
      throw new Error('Você já enviou este formulário.')
    }

    throw aErr
  }

  return { submissionId }
}
