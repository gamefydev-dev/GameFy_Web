// Next Imports
import Link from 'next/link'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Switch from '@mui/material/Switch'

// Component Imports
import CustomIconButton from '@core/components/mui/IconButton'

// --- Somente GitHub (conectado/desconectado) ---
const connectedAccountsArr = [
  {
    checked: true, // ajuste para o estado real depois
    title: 'GitHub',
    logo: '/images/logos/github.png',
    subtitle: 'Gerencie seus repositórios Git'
  }
]

// (Opcional) Exibir GitHub também como "social" — por enquanto sem vínculo real
const socialAccountsArr = [
  {
    title: 'GitHub',
    isConnected: false, // ajuste quando houver OAuth
    username: '', // ex.: '@seu-usuario'
    logo: '/images/logos/github.png',
    href: 'https://github.com' // ex.: 'https://github.com/seu-usuario'
  }
]

const Connections = () => {
  return (
    <Card>
      <Grid container>
        <Grid item xs={12} md={6}>
          <CardHeader title='Contas Conectadas' subheader='Exiba/integre conteúdo das contas conectadas' />
          <CardContent className='flex flex-col gap-4'>
            {connectedAccountsArr.map((item, index) => (
              <div key={index} className='flex items-center justify-between gap-4'>
                <div className='flex flex-grow items-center gap-4'>
                  <img height={32} width={32} src={item.logo} alt={item.title} />
                  <div className='flex-grow'>
                    <Typography className='font-medium' color='text.primary'>
                      {item.title}
                    </Typography>
                    <Typography variant='body2'>{item.subtitle}</Typography>
                  </div>
                </div>
                {/* Futuro: ligar/desligar integração com GitHub OAuth */}
                <Switch defaultChecked={item.checked} />
              </div>
            ))}
          </CardContent>
        </Grid>

        {/* Só renderiza se quiser mostrar o bloco “Social” com GitHub também */}
        {socialAccountsArr.length > 0 && (
          <Grid item xs={12} md={6}>
            <CardHeader title='Contas Sociais' subheader='Vincule suas contas para exibir conteúdo' />
            <CardContent className='flex flex-col gap-4'>
              {socialAccountsArr.map((item, index) => (
                <div key={index} className='flex items-center justify-between gap-4'>
                  <div className='flex flex-grow items-center gap-4'>
                    <img height={32} width={32} src={item.logo} alt={item.title} />
                    <div className='flex-grow'>
                      <Typography className='font-medium' color='text.primary'>
                        {item.title}
                      </Typography>
                      {item.isConnected && item.username ? (
                        <Typography color='primary' component={Link} href={item.href || '/'} target='_blank'>
                          {item.username}
                        </Typography>
                      ) : (
                        <Typography variant='body2'>Não conectado</Typography>
                      )}
                    </div>
                  </div>
                  <CustomIconButton variant='outlined' color={item.isConnected ? 'error' : 'secondary'}>
                    <i className={item.isConnected ? 'ri-delete-bin-7-line' : 'ri-links-line'} />
                  </CustomIconButton>
                </div>
              ))}
            </CardContent>
          </Grid>
        )}
      </Grid>
    </Card>
  )
}

export default Connections
