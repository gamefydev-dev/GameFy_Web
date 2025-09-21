import { supabase } from '@/libs/supabaseAuth'
import { toMemberArray, genCode, detectNormalizedClassName } from './components/utils'

// Carrega pi_groups e depois hidrata membros via pi_group_members (sem JOIN aninhado)
export async function loadGroupsFromDb() {
  // admin?
  let isAdmin = false

  try {
    const { data, error } = await supabase.rpc('is_admin')

    if (!error) isAdmin = !!data
  } catch {
    isAdmin = false
  }

  // grupos (⚠️ sem qr_content)
  const { data: groupsRaw, error: gErr } = await supabase
    .from('pi_groups')
    .select('id,name,code,github_url') // <— removido qr_content
    .order('name', { ascending: true })

  if (gErr) throw gErr

  const ids = (groupsRaw || []).map(r => r.id)

  // tenta tabela real de membros
  let membersBy = new Map()

  if (ids.length) {
    membersBy = await fetchMembersByGroupIds(ids)
  }

  const groups = (groupsRaw || []).map(r => {
    const members = membersBy.get(String(r.id)) || []

    return {
      id: r.id,
      group_name: r.name,
      code: r.code,
      github_url: r.github_url || '',

      // 🔧 gera o conteúdo do QR no front; não depende de coluna no banco
      qr_content: JSON.stringify({ code: r.code, group_name: r.name }),
      members,
      members_count: members.length
    }
  })

  // classes
  const { data: cls } = await supabase
    .from('classes')
    .select('id,name,course_id,semester')
    .order('name', { ascending: true })

  return { isAdmin, groups, classes: (cls || []).map(c => ({ ...c, id: String(c.id) })) }
}

export async function fetchMembersByGroupIds(ids) {
  // tenta pi_group_members -> fallback group_members
  const tryTables = [
    { table: 'pi_group_members', fields: 'group_id, full_name, email, github' },
    { table: 'group_members', fields: 'group_id, full_name, email, github' }
  ]

  for (const t of tryTables) {
    try {
      const { data, error } = await supabase.from(t.table).select(t.fields).in('group_id', ids)

      if (error) continue

      if (data && data.length) {
        const by = new Map()

        data.forEach(r => {
          const gid = String(r.group_id)

          if (!by.has(gid)) by.set(gid, [])
          by.get(gid).push({
            full_name: r.full_name || null,
            email: (r.email || '').toLowerCase() || null,
            github: r.github || null
          })
        })

        return by
      }
    } catch {}
  }

  return new Map()
}

// cria turma se necessário
export async function ensureClassByName(name) {
  if (!name) return null

  const { data: created, error } = await supabase
    .from('classes')
    .insert({ name })
    .select('id,name,course_id,semester')
    .single()

  if (error) {
    const { data: existing } = await supabase
      .from('classes')
      .select('id,name,course_id,semester')
      .ilike('name', name)
      .maybeSingle()

    return existing ? { ...existing, id: String(existing.id) } : null
  }

  return { ...created, id: String(created.id) }
}

// substitui membros (RPC -> tabela real -> fallback)
export async function replaceGroupMembers(groupId, members) {
  const rows = toMemberArray(members)
    .map(m => ({
      p_full_name: m.full_name || null,
      p_email: (m.email || '').toLowerCase() || null,
      p_github: m.github || null
    }))
    .filter(r => r.p_full_name || r.p_email || r.p_github)

  try {
    const { error } = await supabase.rpc('replace_group_members', { p_group_id: groupId, p_members: rows })

    if (error) throw error

    return
  } catch {
    const normalized = toMemberArray(members)
      .map(m => ({
        group_id: groupId,
        full_name: m.full_name || null,
        email: (m.email || '').toLowerCase() || null,
        github: m.github || null
      }))
      .filter(r => r.full_name || r.email || r.github)

    try {
      await supabase.from('pi_group_members').delete().eq('group_id', groupId)
      if (normalized.length) await supabase.from('pi_group_members').insert(normalized)
    } catch {
      await supabase.from('group_members').delete().eq('group_id', groupId)
      if (normalized.length) await supabase.from('group_members').insert(normalized)
    }
  }
}

// salva importação (lista de grupos vindos do Excel)
export async function saveImportedGroups({
  list,
  rowClass,
  isAdmin,
  classes,
  ensureClassByNameFn,
  replaceGroupMembersFn
}) {
  if (!isAdmin) throw new Error('Apenas professores/admin podem importar grupos.')

  const byId = new Map(classes.map(c => [String(c.id), c]))
  const byName = new Map(classes.map(c => [String(c.name).toUpperCase(), c]))

  for (const g of list) {
    // turma
    let classObj = null
    const selected = rowClass[String(g.id)]

    if (selected && (byId.get(String(selected.id)) || byName.get(String(selected.name).toUpperCase()))) {
      classObj = byId.get(String(selected.id)) || byName.get(String(selected.name).toUpperCase())
    } else {
      const guess =
        detectNormalizedClassName({ turmaText: g._excel_turma, cursoText: g._excel_curso }) || g._url_class_guess

      if (guess) classObj = byName.get(guess.toUpperCase()) || (await ensureClassByNameFn(guess))
    }

    if (!classObj) throw new Error(`Não foi possível determinar a turma do grupo "${g.group_name}".`)

    // existe?
    const { data: existed } = await supabase
      .from('pi_groups')
      .select('id')
      .eq('class_id', classObj.id)
      .eq('name', g.group_name)

    let groupId = existed?.[0]?.id

    // update github_url
    if (groupId && g.github_url) {
      await supabase.from('pi_groups').update({ github_url: g.github_url }).eq('id', groupId)
    }

    // cria se não existe (⚠️ sem qr_content)
    if (!groupId) {
      const { data: created, error: e1 } = await supabase
        .from('pi_groups')
        .insert({
          class_id: classObj.id,
          name: g.group_name,
          code: genCode(),
          semester: g._excel_sem_int ?? null,
          github_url: g.github_url || null
        })
        .select('id')
        .single()

      if (e1) throw e1
      groupId = created.id
    }

    // membros
    await replaceGroupMembersFn(groupId, g.members)
  }
}
