'use client'

// Next Imports
import Link from 'next/link'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'

// Component Imports
import Form from '@components/Form'
import DirectionalIcon from '@components/DirectionalIcon'
import Illustrations from '@components/Illustrations'
import Logo from '@components/layout/shared/Logo'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'

const ForgotPassword = ({ mode }) => {
  // Vars
  const darkImg = '/images/pages/auth-v1-mask-dark.png'
  const lightImg = '/images/pages/auth-v1-mask-light.png'

  // Hooks
  const authBackground = useImageVariant(mode, lightImg, darkImg)

  return (
    <div className='flex flex-col justify-center items-center min-bs-[100dvh] relative p-6'>
      <Card
        className='flex flex-col sm:is-[450px]'
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        <CardContent className='p-6 sm:!p-12'>
          <Link href='/' className='flex justify-center items-center mbe-6'>
            <Logo />
          </Link>

          <Typography variant='h4' className='text-center' sx={{ fontWeight: 700, mb: 1 }}>
            Recuperar senha 🔒
          </Typography>

          <Typography variant='body2' className='text-center' sx={{ mb: 4, opacity: 0.9 }}>
            Digite seu e-mail e enviaremos um link para você redefinir sua senha.
          </Typography>

          <Form noValidate autoComplete='off' className='flex flex-col gap-5'>
            <TextField
              autoFocus
              fullWidth
              type='email'
              label='E-mail'
              placeholder='seuemail@exemplo.com'
              InputProps={{ sx: { borderRadius: 2 } }}
            />

            <Button fullWidth variant='contained' type='submit' sx={{ py: 1.25, borderRadius: 9999 }}>
              Enviar link de redefinição
            </Button>

            <Typography className='flex justify-center items-center' color='primary' sx={{ mt: 1 }}>
              <Link href='/login' className='flex items-center gap-1'>
                <DirectionalIcon ltrIconClass='ri-arrow-left-s-line' rtlIconClass='ri-arrow-right-s-line' />
                <span>Voltar para o login</span>
              </Link>
            </Typography>
          </Form>
        </CardContent>
      </Card>

      <Illustrations maskImg={{ src: authBackground }} />
    </div>
  )
}

export default ForgotPassword
