import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>sBTC Payment Processor</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <nav style={{ 
        padding: '1rem 2rem', 
        borderBottom: '1px solid #eaeaea',
        display: 'flex',
        gap: '20px',
        alignItems: 'center'
      }}>
        <strong style={{ fontSize: '1.2rem', marginRight: 'auto' }}>⚡ sBTC Pay</strong>
        <a href="/" style={navLinkStyle}>Home</a>
        <a href="/merchant" style={navLinkStyle}>Merchant Dashboard</a>
      </nav>

      <main style={{ minHeight: '80vh' }}>
        <Component {...pageProps} />
      </main>

      <footer style={{ 
        padding: '2rem', 
        textAlign: 'center', 
        fontSize: '0.8rem', 
        color: '#666',
        borderTop: '1px solid #eaeaea',
        marginTop: '40px'
      }}>
        Built on Stacks & sBTC
      </footer>
    </>
  )
}

const navLinkStyle = {
  textDecoration: 'none',
  color: '#0070f3',
  fontWeight: 500
}
