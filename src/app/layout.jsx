// Third-party Imports
import 'react-perfect-scrollbar/dist/css/styles.css'

// Style Imports
import '@/app/globals.css'

// Generated Icon CSS Imports
import '@assets/iconify-icons/generated-icons.css'

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  applicationName: 'GameFy',
  title: { default: 'GameFy', template: '%s • GameFy' },
  description: 'GameFy — plataforma acadêmica gamificada para gerir grupos de PI, avaliações e relatórios.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/web-app-manifest-192x192.png', type: 'image/png', sizes: '192x192' },
      { url: '/web-app-manifest-512x512.png', type: 'image/png', sizes: '512x512' }
    ],
    apple: { url: '/web-app-manifest-192x192.png' },
    shortcut: '/favicon.ico'
  },
  openGraph: {
    type: 'website',
    title: 'GameFy',
    siteName: 'GameFy',
    description: 'Gerencie turmas, grupos e avaliações do Projeto Integrador com praticidade.',
    images: [{ url: '/web-app-manifest-512x512.png', width: 512, height: 512, alt: 'GameFy' }]
  },
  twitter: {
    card: 'summary',
    title: 'GameFy',
    description: 'Plataforma acadêmica gamificada para grupos de PI e avaliações.',
    images: ['/web-app-manifest-512x512.png']
  }
}

// Next.js 14: themeColor agora fica no `viewport`
export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#8C57FF' },
    { media: '(prefers-color-scheme: dark)', color: '#8C57FF' }
  ]
}

const RootLayout = ({ children }) => {
  const direction = 'ltr'

  return (
    <html id='__next' dir={direction}>
      <body className='flex is-full min-bs-full flex-auto flex-col'>{children}</body>
    </html>
  )
}

export default RootLayout
