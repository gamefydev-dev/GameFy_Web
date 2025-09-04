// MUI Imports
import Grid from '@mui/material/Grid'

// Components Imports
import Award from '@views/dashboard/Award'
import Transactions from '@views/dashboard/Transactions'
import WeeklyOverview from '@views/dashboard/WeeklyOverview'
import LineChart from '@views/dashboard/LineChart'
import Table from '@views/dashboard/Table'

const DashboardAnalytics = () => {
  return (
    <Grid container spacing={6}>
      {/* Premiação */}
      <Grid item xs={12} md={4}>
        <Award />
      </Grid>

      {/* Transações */}
      <Grid item xs={12} md={8}>
        <Transactions />
      </Grid>

      {/* Visão semanal */}
      <Grid item xs={12} md={6} lg={4}>
        <WeeklyOverview />
      </Grid>

      {/* Gráfico de linha */}
      <Grid item xs={12} md={6} lg={4}>
        <LineChart />
      </Grid>

      {/* Tabela completa */}
      <Grid item xs={12}>
        <Table />
      </Grid>
    </Grid>
  )
}

export default DashboardAnalytics
