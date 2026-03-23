import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { connectWallet, getUserData, disconnectWallet } from '../lib/wallet'

export default function Home() {
  const [userData, setUserData] = useState<any>(null)
  
  // Updated to your actual Vercel URL and the new Project Thumbnail
  const siteUrl = 'https://sbtcpaymentprocessor.vercel.app'
  const previewImage = `${siteUrl}/og-image.png` // Using the high-impact thumbnail

  useEffect(() => {
    const user = getUserData()
    if (user) {
      setUserData(user)
    }
  }, [])

  const handleConnect = async () => {
    const user = await connectWallet() as any
    if (user) {
      setUserData(user)
    }
  }

  return (
    <div className="container" style={{ textAlign: 'center', marginTop: '5vh' }}>
      <Head>
        <title>sBTC Payment Processor | Non-Custodial Gateway</title>
        <meta name="description" content="The Stripe for Bitcoin. Accept sBTC and STX payments on Stacks Mainnet with zero middleman risk." />
        
        {/* Verification & Social Sharing */}
        <meta name="talentapp:project_verification" content="a86acc218424767d141f1f5957da49c95a9fc540fcb10b07560a8655690d4fd77eb39def76148ae15ed9901199448adea1dd6cfb62d67426a61b29c1c3744483" />
        <meta property="og:title" content="sBTC Payment Processor" />
        <meta property="og:image" content={previewImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={previewImage} />
        
        {/* Favicon Hook */}
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto', border: '1px solid rgba(85, 70, 255, 0.2)' }}>
        
        {/* 🎨 BRANDED LOGO HEADER */}
        <div style={{ marginBottom: '20px' }}>
          <img 
            src="/logo.png" 
            alt="sBTC Payment Processor" 
            style={{ width: '100px', height: '100px', marginBottom: '10px' }} 
          />
        </div>

        <h1 style={{ fontSize: '2.8rem', marginBottom: '1rem', lineHeight: '1.1' }}>
          sBTC Payment <br/>
          <span style={{ 
            background: 'linear-gradient(to right, #F7931A, #5546FF)', 
            WebkitBackgroundClip: 'text', 
            WebkitTextFillColor: 'transparent',
            fontWeight: 'bold' 
          }}>
            Processor
          </span>
        </h1>

        <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', fontSize: '1.1rem', maxWidth: '80%', margin: '0 auto 2.5rem' }}>
          Non-custodial Bitcoin commerce. Accept sBTC and STX with secure, on-chain settlement.
        </p>

        {!userData ? (
          <button 
            className="primary" 
            onClick={handleConnect}
            style={{ 
              padding: '16px 40px', 
              fontSize: '1.2rem',
              background: 'linear-gradient(45deg, #F7931A, #5546FF)', // Gradient Button
              border: 'none',
              borderRadius: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(85, 70, 255, 0.3)'
            }}
          >
            Connect Wallet to Start
          </button>
        ) : (
          <div style={{ animation: 'fadeIn 0.5s' }}>
            <div style={{ 
              background: 'rgba(85, 70, 255, 0.05)', 
              color: '#5546FF', 
              padding: '14px', 
              borderRadius: '12px',
              marginBottom: '20px',
              border: '1px solid rgba(85, 70, 255, 0.3)',
              fontWeight: '600',
              fontSize: '0.9rem'
            }}>
              Merchant: {userData.profile.stxAddress.mainnet.slice(0, 6)}...{userData.profile.stxAddress.mainnet.slice(-4)}
            </div>

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <Link href="/merchant">
                <button className="primary" style={{ background: '#5546FF', padding: '12px 24px' }}>
                  Merchant Dashboard
                </button>
              </Link>
              <button 
                onClick={() => { disconnectWallet(); setUserData(null); }}
                style={{ 
                  background: 'transparent', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  color: 'rgba(255,255,255,0.6)',
                  padding: '12px 24px'
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FEATURE GRID */}
      <div style={{ 
        marginTop: '60px', 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '25px',
        textAlign: 'left'
      }}>
        <div className="card" style={{ borderLeft: '4px solid #F7931A' }}>
          <h3 style={{ color: '#F7931A', marginBottom: '10px' }}>Bitcoin Finality</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Settled via sBTC, ensuring your business benefits from the $1T+ Bitcoin security layer.
          </p>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #5546FF' }}>
          <h3 style={{ color: '#5546FF', marginBottom: '10px' }}>Nakamoto Ready</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Optimized for 5-second block times. Instant payment detection for a smooth checkout.
          </p>
        </div>
      </div>
    </div>
  )
}
