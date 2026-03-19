import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { readInvoice } from '../../lib/contract'
import { connectWallet, getUserData } from '../../lib/wallet'
import { openContractCall } from '@stacks/connect'
import { getNetwork } from '../../lib/network'
import { uintCV, contractPrincipalCV, PostConditionMode, cvToJSON } from '@stacks/transactions'

export default function PayInvoice() {
  const router = useRouter()
  const { id } = router.query

  const [invoice, setInvoice] = useState<any>(null)
  const [invoiceId, setInvoiceId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState<any>(null)

  useEffect(() => {
    const user = getUserData()
    if (user) setUserData(user)
  }, [])

  const handleConnect = async () => {
    const user = await connectWallet() as any
    if (user) setUserData(user)
  }

  useEffect(() => {
    if (!id) return

    const fetchInvoiceFromChain = async () => {
      try {
        setLoading(true)
        const network = getNetwork()
        let finalId: number | null = null

        // 1. Resolve Transaction ID to Invoice ID if necessary
        if (String(id).startsWith('0x')) {
          const txResponse = await fetch(`${network.coreApiUrl}/extended/v1/tx/${id}`)
          const txData = await txResponse.json()
          if (txData?.tx_result?.repr) {
            finalId = parseInt(txData.tx_result.repr.replace(/[^0-9]/g, ''))
          }
        } else {
          finalId = Number(id)
        }

        // 2. Fetch the actual Invoice data from the contract
        if (finalId !== null && !isNaN(finalId)) {
          setInvoiceId(finalId)
          const resp = await readInvoice(finalId)
          
          // Flatten the Stacks response structure
          const actualData = resp?.value?.data || resp?.value || resp
          setInvoice(actualData)
        }
      } catch (err) {
        console.error("Failed to fetch invoice:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchInvoiceFromChain()
  }, [id])

  // --- Helper Functions to Decode Hex Buffers ---
  const decodeHex = (hex: string) => {
    if (!hex || !hex.startsWith('0x')) return hex
    try {
      return Buffer.from(hex.slice(2), 'hex').toString().replace(/\0/g, '')
    } catch (e) {
      return hex
    }
  }

  // --- Derived Variables ---
  const rawToken = invoice?.token?.value || ""
  const tokenName = decodeHex(rawToken).toUpperCase()
  const isSTX = tokenName === "STX"
  
  const rawAmount = invoice?.amount?.value ? BigInt(invoice.amount.value) : BigInt(0)
  const memoDisplay = invoice?.memo?.value ? decodeHex(invoice.memo.value) : "No reference"
  const merchantAddr = invoice?.merchant?.value || "N/A"

  const payWithSTX = async () => {
    if (!invoice || invoiceId === null) return
    await openContractCall({
      contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
      contractName: process.env.NEXT_PUBLIC_CONTRACT_NAME!,
      functionName: 'pay-invoice-stx',
      functionArgs: [uintCV(invoiceId), uintCV(rawAmount)],
      network: getNetwork(),
      postConditionMode: PostConditionMode.Allow,
      anchorMode: 1,
      appDetails: { name: 'sBTC Payment Processor', icon: '/favicon.ico' },
      onFinish: (data: any) => alert(`STX payment submitted! TXID: ${data.txId}`),
    })
  }

  const payWithSbtc = async () => {
    if (!invoice || invoiceId === null) return
    const sbtcDetails = process.env.NEXT_PUBLIC_SBTC_CONTRACT!
    const [addr, name] = sbtcDetails.split('.')
    await openContractCall({
      contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
      contractName: process.env.NEXT_PUBLIC_CONTRACT_NAME!,
      functionName: 'pay-invoice-ft',
      functionArgs: [uintCV(invoiceId), contractPrincipalCV(addr, name), uintCV(rawAmount)],
      network: getNetwork(),
      postConditionMode: PostConditionMode.Allow,
      anchorMode: 1,
      appDetails: { name: 'sBTC Payment Processor', icon: '/favicon.ico' },
      onFinish: (data: any) => alert(`sBTC payment submitted! TXID: ${data.txId}`),
    })
  }

  if (loading) return <div className="container" style={{padding: '50px', textAlign: 'center'}}>Loading invoice...</div>
  if (!invoice || rawAmount === BigInt(0)) return <div className="container" style={{padding: '50px', textAlign: 'center'}}>Invoice not found.</div>

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 450, margin: '40px auto' }}>
        <h2 style={{ textAlign: 'center' }}>Complete Payment</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Invoice #{invoiceId}</p>

        <div style={{ 
          margin: '24px 0', 
          padding: '24px', 
          background: 'rgba(255,255,255,0.03)', 
          borderRadius: 16, 
          textAlign: 'center',
          border: '1px solid var(--border-color)'
        }}>
          <label style={{ fontSize: '0.8rem', letterSpacing: '1px', opacity: 0.7 }}>AMOUNT DUE</label>
          <h1 style={{ fontSize: '2.5rem', margin: '10px 0', color: isSTX ? 'var(--accent-stx)' : 'var(--accent-sbtc)' }}>
            {isSTX 
              ? (Number(rawAmount) / 1000000).toLocaleString() 
              : (Number(rawAmount) / 100000000).toFixed(8)} 
            <span style={{ fontSize: '1.2rem', marginLeft: '10px', color: 'white' }}>{tokenName}</span>
          </h1>
          
          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
            <p style={{ fontSize: '0.95rem', marginBottom: '8px' }}>
              <strong>Memo:</strong> {memoDisplay}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
              Merchant: {merchantAddr}
            </p>
          </div>
        </div>

        {!userData ? (
          <button className="primary" onClick={handleConnect} style={{ width: '100%' }}>
            Connect Wallet to Pay
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {isSTX ? (
              <button className="primary" onClick={payWithSTX} style={{ width: '100%' }}>
                Pay with STX
              </button>
            ) : (
              <button className="sbtc" onClick={payWithSbtc} style={{ width: '100%' }}>
                Pay with sBTC
              </button>
            )}
            <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Connected: {userData?.profile?.stxAddress?.mainnet?.slice(0, 10)}...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
