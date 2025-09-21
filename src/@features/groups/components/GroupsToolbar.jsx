import { Stack, Button, TextField } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'

export function GroupsToolbar({
  source,
  filterQuery,
  setFilterQuery,
  onNewClass,
  onNewGroup,
  onAutoImport,
  fileInputRef,
  onPickFile,
  onFileChange
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      sx={{ mb: 2 }}
      alignItems='center'
      justifyContent='space-between'
    >
      <div style={{ fontSize: 20, fontWeight: 600 }}>
        Grupos {source === 'excel' ? '(pré-visualização do Excel)' : ''}
      </div>
      <Stack direction='row' spacing={1} alignItems='center' sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        <TextField
          size='small'
          placeholder='Buscar grupo...'
          value={filterQuery}
          onChange={e => setFilterQuery(e.target.value)}
        />
        <Button variant='outlined' startIcon={<AddIcon />} onClick={onNewClass}>
          Nova turma
        </Button>
        <Button variant='outlined' startIcon={<AddIcon />} onClick={onNewGroup}>
          Novo grupo
        </Button>
        <Button variant='contained' startIcon={<AutoFixHighIcon />} onClick={onAutoImport}>
          Auto associar & importar
        </Button>
        <input
          type='file'
          accept='.xlsx,.xls,.csv'
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
        <Button variant='contained' startIcon={<CloudUploadIcon />} onClick={onPickFile}>
          Importar Excel
        </Button>
      </Stack>
    </Stack>
  )
}
