// MUI Imports
import Grid from '@mui/material/Grid'

import FormLayoutsBasic from '@views/form-layouts/FormLayoutsBasic'

const FormLayouts = () => {
  return (
    <Grid container spacing={6}>
      <Grid item xs={12} md={6}>
        <FormLayoutsBasic />
      </Grid>
    </Grid>
  )
}

export default FormLayouts
