'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { Stack, LinearProgress, Alert, Snackbar } from '@mui/material'

import { GroupsToolbar } from '@/@features/groups/components/GroupsToolbar'
import { GroupsExcelPreview } from '@/@features/groups/components/GroupsExcelPreview'
import { GroupCardGrid } from '@/@features/groups/components/GroupCardGrid'
import {
  ClassDialog,
  NewGroupDialog,
  GroupDetailsDialog,
  DeleteDialog,
  AutoImportDialog
} from '@/@features/groups/components/Dialogs'
import { buildGroupsFromRows, detectNormalizedClassName, toMemberArray, genCode } from '@/@features/groups/components/utils'
import { loadGroupsFromDb, ensureClassByName, saveImportedGroups, replaceGroupMembers } from '@/@features/groups/api'

// Página principal
export default function Page() {
  // base
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  // origem: db vs excel
  const [source, setSource] = useState('db') // 'db' | 'excel'

  // dados principais
  const [groups, setGroups] = useState([]) // sempre no formato {id, group_name, code, github_url, qr_content, members[]}
  const [classes, setClasses] = useState([])

  // seleção/filtros
  const [rowClass, setRowClass] = useState({}) // mapping groupKey -> class object {id,...}
  const [rowSelect, setRowSelect] = useState({}) // mapping groupKey -> boolean
  const [filterQuery, setFilterQuery] = useState('')

  // dialogs
  const [dlgClassOpen, setDlgClassOpen] = useState(false)
  const [dlgGroupOpen, setDlgGroupOpen] = useState(false)
  const [dlgDetailsOpen, setDlgDetailsOpen] = useState(false)
  const [detailsGroup, setDetailsGroup] = useState(null)
  const [dlgDeleteOpen, setDlgDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [autoOpen, setAutoOpen] = useState(false)

  // formulários
  const [formClass, setFormClass] = useState({ name: '', semester: '', course_id: '' })
  const emptyMember = { full_name: '', email: '', github: '' }

  const [formGroup, setFormGroup] = useState({
    group_name: '',
    class_id: '',
    semester: '',
    code: genCode(),
    github_url: '',
    members: [{ ...emptyMember }, { ...emptyMember }, { ...emptyMember }, { ...emptyMember }]
  })

  // UI
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'info' })
  const fileInputRef = useRef(null)

  // ---------- LOAD ----------
  const refresh = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await loadGroupsFromDb()

      setGroups(res.groups)
      setClasses(res.classes)
      setIsAdmin(res.isAdmin)
      setSource('db')
    } catch (e) {
      setError(e.message || 'Erro ao carregar grupos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  // ---------- EXCEL ----------
  const handlePickFile = () => fileInputRef.current?.click()

  const handleFileChange = async e => {
    try {
      const file = e.target.files?.[0]

      if (!file) return
      const { read, utils } = await import('xlsx')
      const wb = read(await file.arrayBuffer())
      const rows = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
      const parsed = buildGroupsFromRows(rows)

      // auto-atribuir turma
      const byName = new Map(classes.map(c => [String(c.name).toUpperCase(), c]))
      const next = {}

      for (const g of parsed) {
        const guess =
          detectNormalizedClassName({ turmaText: g._excel_turma, cursoText: g._excel_curso }) || g._url_class_guess

        if (guess && byName.has(guess.toUpperCase())) next[String(g.id)] = byName.get(guess.toUpperCase())
      }

      setGroups(parsed)
      setRowClass(next)
      setRowSelect({})
      setSource('excel')
      setSnack({ open: true, msg: 'Grupos carregados do Excel.', sev: 'success' })
    } catch (e) {
      setError(e.message || 'Falha ao processar Excel')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ---------- SALVAR IMPORTAÇÃO ----------
  const saveImported = async list => {
    await saveImportedGroups({
      list,
      rowClass,
      isAdmin,
      classes,
      ensureClassByNameFn: ensureClassByName,
      replaceGroupMembersFn: async (id, members) => {
        await replaceGroupMembers(id, members)

        // hidrata local imediatamente
        setGroups(prev => prev.map(g => (String(g.id) === String(id) ? { ...g, members } : g)))
      }
    })
    setSnack({ open: true, msg: 'Grupos e membros salvos com sucesso.', sev: 'success' })
    await refresh()
  }

  // ---------- DELETE ----------
  const doDelete = async gid => {
    const { supabase } = await import('@/libs/supabaseAuth')
    const { error } = await supabase.from('pi_groups').delete().eq('id', gid)

    if (error) throw error
    setSnack({ open: true, msg: 'Grupo excluído.', sev: 'success' })
    await refresh()
  }

  // ---------- FILTER ----------
  const filtered = useMemo(
    () =>
      groups.filter(g =>
        String(g.group_name || '')
          .toLowerCase()
          .includes(filterQuery.toLowerCase())
      ),
    [groups, filterQuery]
  )

  // ---------- RENDER ----------
  if (loading) {
    return (
      <Stack sx={{ p: 2 }}>
        <LinearProgress />
      </Stack>
    )
  }

  if (error) {
    return (
      <Stack sx={{ p: 2 }}>
        <Alert severity='error'>{error}</Alert>
      </Stack>
    )
  }

  return (
    <>
      <GroupsToolbar
        source={source}
        filterQuery={filterQuery}
        setFilterQuery={setFilterQuery}
        onNewClass={() => setDlgClassOpen(true)}
        onNewGroup={() => setDlgGroupOpen(true)}
        onAutoImport={() => {
          if (source !== 'excel') {
            setSnack({ open: true, msg: 'Importe um Excel primeiro.', sev: 'info' })

            return
          }

          setAutoOpen(true)
        }}
        fileInputRef={fileInputRef}
        onPickFile={handlePickFile}
        onFileChange={handleFileChange}
      />

      {source === 'excel' ? (
        <GroupsExcelPreview
          groups={filtered}
          classes={classes}
          rowClass={rowClass}
          setRowClass={setRowClass}
          rowSelect={rowSelect}
          setRowSelect={setRowSelect}
          setSnack={setSnack}
        />
      ) : (
        <GroupCardGrid
          groups={filtered}
          onOpenDetails={g => {
            setDetailsGroup(g)
            setDlgDetailsOpen(true)
          }}
          onDelete={g => {
            setDeleteTarget(g)
            setDlgDeleteOpen(true)
          }}
        />
      )}

      {/* Dialogs */}
      <ClassDialog
        open={dlgClassOpen}
        onClose={() => setDlgClassOpen(false)}
        form={formClass}
        setForm={setFormClass}
        afterSave={refresh}
      />

      <NewGroupDialog
        open={dlgGroupOpen}
        onClose={() => setDlgGroupOpen(false)}
        form={formGroup}
        setForm={setFormGroup}
        onReplaceMembers={async (id, members) => {
          await replaceGroupMembers(id, members)
          await refresh()
        }}
        afterCreate={refresh}
      />

      <GroupDetailsDialog open={dlgDetailsOpen} onClose={() => setDlgDetailsOpen(false)} group={detailsGroup} />

      <DeleteDialog
        open={dlgDeleteOpen}
        onClose={() => setDlgDeleteOpen(false)}
        target={deleteTarget}
        onConfirm={async () => {
          if (!deleteTarget?.id) return
          await doDelete(deleteTarget.id)
          setDlgDeleteOpen(false)
          setDeleteTarget(null)
        }}
      />

      <AutoImportDialog
        open={autoOpen}
        onClose={() => setAutoOpen(false)}
        source={source}
        groups={groups}
        rowClass={rowClass}
        setRowClass={setRowClass}
        rowSelect={rowSelect}
        setRowSelect={setRowSelect}
        classes={classes}
        setSnack={setSnack}
        onImport={async selectedList => {
          await saveImported(selectedList)
          setAutoOpen(false)
        }}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        message={snack.msg}
      />
    </>
  )
}
