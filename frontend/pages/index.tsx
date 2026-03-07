import Head from 'next/head'
import Link from 'next/link'
import { connectWallet } from '../lib/wallet'

export default function Home() {
  const siteUrl = 'https://sbtcpaymentprocessor.vercel.app'
  const previewImage = `${siteUrl}/preview.png`

  return (
    <div style={{ padding: 24 }}>
      <Head>
        {/* Title */}
        <title>sBTC Payment Processor</title>

        {/* Basic SEO */}
        <meta
          name="description"
          content="Accept sBTC and STX payments on Stacks Maiicre onchain settlement."
        />
        <meta
          name="keywords"
          content="sbtc, stacks, bitcoin payments, stx, web3 ets, blochain payment processor"
        />
        <meta name="author" content="Investorphem" />
        <meta name="theme-color" content="#000000" />

        {/* Domain Verification */}
        <meta
          name="talentapp:project_verification"
          content="a86acc218424767d141f1f5957da49c95a9fc540fcb10b07560a8655690d4fd77eb39def76148ae15ed9901199448adea1dd6cfb62d67426a61b29c1c3744483"
        />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="sBTC Payment Processor" />
        <meta
          property="og:description"
          content="Accept sBTC and STX payments on Stacks Mainnet with secure onchain settlement."
        />
        <meta property="og:url" content={siteUrl} />
        <meta property="og:image" content={previewImage} />
        <meta property="og:site_name" content="sBTC Payment Processor" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="sBTC Payment Processor" />
        <meta
          name="twitter:description"
          content="Accept sBTC and STX payments on Stacks Mainnet with secure onchain settlement."
        />
        <meta name="twitter:image" content={previewImage} />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon.png" />
      </Head>

      <h1>sBTC Payment Processor</h1>
      <p>Accept sBTC and STX payments on Stacks Mainnet.</p>

      <div style={{ marginTop: 16 }}>
        <button onClick={() => connectWallet()}>
          Connect Wallet
        </button>

        <span style={{ marginLeft: 12 }}>
          <Link href="/merchant">Merchant Dashboard</Link>
        </span>
      </div>
    </div>
  )
}