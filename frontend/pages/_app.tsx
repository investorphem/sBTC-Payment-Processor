import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'

// --- FIX FOR CLIENT-SIDE EXCEPTION ---
import { Buffer } from 'buffer'
if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer
}
// -------------------------------------

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>sBTC Payment Processor</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <nav style={{ 
        padding: '1rem 2rem', 
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        gap: '20px',
        alignItems: 'center',
        background: 'var(--card-bg)'
      }}
        <strong style={{ fontSize: '1.2rem', marginRight: 'ato', color: 'white' }}>⚡ sBTC Pay</strong
        <a href="/" style={navLinkStyle}>Home</a>
        <a href="/merchnt" tye={navLinkStyle}>Merchan</a>
      </nav
      <main style={{ minHeight: '80vh' }}>
        <Component {...pagerops}
      </ma

      <footer style={{
        padding: '2rem'
        textAlign: 'ce
        fontSize: '0.8
        color: 'var(--
        borderTop: '1px solid var(--bord
        marginTo
      }
        Built on Stacks & sB
      </footer>
    </>
  )
}

const navLinkStyle = {
  textDecoration: 'none',
  color: 'var(--text-secondary)',
  fontWeight: 500
}
