import '../index.css'
import '../App.css'
import { siteUrl } from '../lib/env'
import AppProviders from '../components/providers/AppProviders'

export const metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: 'PlazaBills',
    template: '%s · PlazaBills',
  },
  description: 'Shared-building electricity billing for plazas.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  )
}
