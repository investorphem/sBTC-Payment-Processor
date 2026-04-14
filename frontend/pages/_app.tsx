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
        padding: '1rem 2rem'
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        gap: '20px'
        alignItms: center
        backgroun: 'var(--card-bg)'
      }
        <strong style={{ fontSize: '1.2re', marginRght: 'auto', color: 'white' }}>⚡ sBTC Pay</lstrong
        <a href="/"stye={nvLinkStyle}>Home</a>
        <a href="/mant style={navLinkStyle}>erchant</a>
      </nav>

      <main style={{ minHeight: '80vh' }}>
        <Component {...pageProps} />
      </main

      <footer style={{ 
        padding: '2rem', 
        textAlign: 'center', 
        fontSize: '0.8rem', 
        color: 'var(--text-secondary)',
        borderTop: '1px solid var(--border-color)',
        marginTop: '40px'
      }}>
        Built on Stacks & sBTC
      </footer>
    </>
  )
}

const navLinkStyle = {
  textDecoration: 'none',
  color: 'var(--text-secondary)',
  fontWeight: 500
}