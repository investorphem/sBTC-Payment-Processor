import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { connectWallet, getUserData, disconnectWallet } from '../lib/wallet'

export default function Home() {
  const [userData, setUserData] = useState<any>(null)
  const siteUrl = 'https://sbtcpaymentprocessor.vercel.app'
  const previewImage = `${siteUrl}/preview.png`

  // 1. Check for an active session when the page loads
  useEffect(() => {
    const user = getUserData()
    if (user) {
      setUserData(user)
    }
  }, [])

  // 2. Handle the connect button click
  const handleConnect = async () => {
    // Cast to 'any' to prevent the Vercel "truthiness" build error
    const user = await connectWallet() as any
    if (user) {
      setUserData(user)
    }
  }

  return (
    <div className="container" style={{ textAlign: 'center', marginTop: '5vh' }}>
      <Head>
        <title>sBTC Payment Processor</title>
        <meta name="description" content="Accept sBTC and STX payments on Stacks Mainnet with secure onchain settlement." />
        <meta name="talentapp:project_verification" content="a86acc218424767d141f1f5957da49c95a9fc540fcb10b07560a8655690d4fd77eb39def76148ae15ed9901199448adea1dd6cfb62d67426a61b29c1c3744483" />
        <meta property="og:title" content="sBTC Payment Processor" />
        <meta property="og:image" content={previewImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
          sBTC Payment <span style={{ color: 'var(--accent-sbtc)' }}>Processor</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', fontSize: '1.1rem' }}>
          Accept sBTC and STX payments on Stacks Mainnet with secure on-chain settlement.
        </p>

        {!userData ? (
          <button 
            className="primary" 
            onClick={handleConnect}
            style={{ padding: '16px 40px', fontSize: '1.1rem' }}
          >
            Connect Wallet to Start
          </button>
        ) : (
          <div style={{ animation: 'fadeIn 0.5s' }}>
            <div style={{ 
              background: 'rgba(85, 70, 255, 0.1)', 
              color: 'var(--accent-stx)', 
              padding: '12px', 
              borderRadius: '12px',
              marginBottom: '20px',
              border: '1px solid var(--accent-stx)',
              fontWeight: 'bold'
            }}>
              Connected: {userData.profile.stxAddress.mainnet.slice(0, 12)}...
            </div>
            
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <Link href="/merchant">
                <button className="primary">Merchant Dashboard</button>
              </Link>
              <button 
                onClick={() => { disconnectWallet(); setUserData(null); }}
                style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'white' }}
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: '60px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        <div className="card" style={{ textAlign: 'left' }}>
          <h3 style={{ color: 'var(--accent-sbtc)' }}>Bitcoin Finality</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Settled on Bitcoin via sBTC, ensuring the highest level of security for your commerce.</p>
        </div>
        <div className="card" style={{ textAlign: 'left' }}>
          <h3 style={{ color: 'var(--accent-stx)' }}>Smart Invoices</h3>
          <p style={{ color: 'var(--text-secondary)' }}>On-chain indexing allows you to track payments without a centralized database.</p>
        </div>
      </div>
    </div>
  )
}
