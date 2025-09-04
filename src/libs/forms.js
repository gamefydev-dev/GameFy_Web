// libs/forms.js
import { supabase } from '@/libs/supabaseAuth'

const BUCKET = 'form_covers'

// Normaliza extensão e decide content-type
function getExtAndContentType(file) {
  const ext = (file.name?.split('.').pop() || '').toLowerCase()

  const contentType =
    file.type ||
    (ext === 'png'
      ? 'image/png'
      : ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'webp'
          ? 'image/webp'
          : 'application/octet-stream')

  return { ext, contentType }
}

/**
 * Upload da capa do formulário.
 * - Usa o mesmo path para upload e para assinar a URL
 * - Faz upsert = true para substituir a capa
 */
export async function uploadFormCover(file, formId) {
  // 1) Garante usuário autenticado
  const { data: u, error: uErr } = await supabase.auth.getUser()

  if (uErr) throw uErr
  const user = u?.user

  if (!user) throw new Error('Não autenticado')

  // 2) Monta caminho seguro: <uid>/<formId>/cover.<ext>
  const ext = (file.name?.split('.').pop() || 'png').toLowerCase()
  const fileName = `cover.${ext}`
  const path = `${user.id}/${formId}/${fileName}`

  // 3) Faz upload (upsert exige UPDATE policy; já cobrimos)
  const { error: upErr } = await supabase.storage.from('form_covers').upload(path, file, {
    upsert: true,
    cacheControl: '3600',
    contentType: file.type || 'image/*'
  })

  if (upErr) throw upErr

  // 4) Gera uma signed URL pra exibir a capa
  const { data: signed, error: sErr } = await supabase.storage.from('form_covers').createSignedUrl(path, 60 * 60 * 24) // 24h

  if (sErr) throw sErr

  return { path, url: signed?.signedUrl || '' }
}

/**
 * upsertForm
 * - INSERT quando não houver id (NÃO envia 'id' no payload → usa DEFAULT do Postgres)
 * - UPDATE quando houver id
 */
export async function upsertForm({ id, title, description, slug, is_published }) {
  // usuário autenticado
  const { data: userData, error: userErr } = await supabase.auth.getUser()

  if (userErr) throw userErr
  const owner = userData?.user?.id

  if (!owner) throw new Error('Usuário não autenticado')

  const base = {
    owner,
    title,
    description,
    slug,
    is_published: !!is_published
  }

  if (!id) {
    // INSERT → não inclua 'id' para acionar o DEFAULT (gen_random_uuid)
    const { data, error } = await supabase.from('forms').insert(base).select('*').single()

    if (error) throw error

    return data
  } else {
    // UPDATE → atualiza pelo id existente
    const { data, error } = await supabase.from('forms').update(base).eq('id', id).select('*').single()

    if (error) throw error

    return data
  }
}

/**
 * replaceQuestions
 * - apaga e recria as questões do form mantendo a ordem
 */
export async function replaceQuestions(formId, questions) {
  if (!formId) throw new Error('formId vazio')

  // remove todas as questões anteriores
  const { error: delErr } = await supabase.from('form_questions').delete().eq('form_id', formId)

  if (delErr) throw delErr

  const rows = (questions || []).map((q, idx) => ({
    form_id: formId,
    type: q.type,
    label: q.label,
    required: !!q.required,
    options: q.options || null,
    order_index: idx
  }))

  if (!rows.length) return []

  const { data, error } = await supabase.from('form_questions').insert(rows).select('*')

  if (error) throw error

  // ordena no client para devolver em ordem, caso precise
  return [...data].sort((a, b) => a.order_index - b.order_index)
}

/**
 * getFormBySlug
 * - retorna form + questões
 */
export async function getFormBySlug(slug) {
  if (!slug) throw new Error('Slug ausente.')

  // 1) Busca o formulário
  const { data: form, error: fe } = await supabase
    .from('forms')
    .select('id, title, description, cover_path, slug, is_published')
    .eq('slug', slug)
    .maybeSingle()

  if (fe) throw fe
  if (!form) throw new Error('Formulário não encontrado.')
  if (!form.is_published) throw new Error('Formulário não publicado.')

  // 2) Busca as perguntas visíveis ao público (RLS cuida do filtro)
  const { data: questions, error: qe } = await supabase
    .from('form_questions')
    .select('id, type, label, required, options, order_index')
    .eq('form_id', form.id)
    .order('order_index', { ascending: true })

  if (qe) throw qe

  return { form, questions: questions || [] }
}

/**
 * submitForm
 * - cria uma response e grava answers (value como jsonb)
 */
export async function submitForm({ formId, answersMap }) {
  const { data: userData } = await supabase.auth.getUser()
  const respondent = userData?.user?.id || null

  const { data: response, error: insErr } = await supabase
    .from('form_responses')
    .insert({ form_id: formId, respondent_id: respondent, status: 'submitted' })
    .select('id')
    .single()

  if (insErr) throw insErr

  const answers = Object.entries(answersMap).map(([question_id, value]) => ({
    response_id: response.id,
    question_id,

    // jsonb: mantém arrays/objetos; converte primitivo para string
    value: Array.isArray(value) ? value : typeof value === 'object' && value !== null ? value : String(value ?? '')
  }))

  if (answers.length) {
    const { error: ansErr } = await supabase.from('form_answers').insert(answers)

    if (ansErr) throw ansErr
  }

  return response
}
