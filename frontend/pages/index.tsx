import Head from 'next/head'
import Link from 'next/link'
import { connectWallet } from '../lib/wallet'

export default function Home() {
  return (
    <div style={{ padding: 24 }}>
      <Head><title>sBTC Payment Processor</title></Head>
      <h1>sBTC Payment Processor — MAINNET</h1>
      <p>Accept sBTC and STX payments on Stacks Mainnet.</p>
      <div style={{ marginTop: 16 }}>
        <button onClick={() => connectWallet()}>Connect Wallet</button>
        <span style={{ marginLeft: 12 }}><Link href="/merchant">Merchant Dashboard</Link></span>
      </div>
    </div>
  )
}
