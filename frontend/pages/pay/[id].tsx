import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { readInvoice } from '../../lib/contract'
import { connectWallet, getUserData } from '../../lib/wallet'
import { openContractCall } from '@stacks/connect'
import { getNetwork } from '../../lib/network'
import { uintCV, standardPrincipalCV } from '@stacks/transactions'

export default function PayInvoice() {
  const router = useRouter()
  const { id } = router.query
  
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState<any>(null)

  // 1. Handle Wallet Connection State
  useEffect(() => {
    const user = getUserData()
    if (user) setUserData(user)
  }, [])

  const handleConnect = async () => {
    const user = await connectWallet()
    setUserData(user)
  }

  // 2. Fetch Invoice Data
  useEffect(() => {
    if (!id) return
    const fetchInvoice = async () => {
      try {
        setLoading(true)
        const resp = await readInvoice(Number(id))
        setInvoice(resp)
      } catch (err) {
        console.error("Failed to fetch invoice:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchInvoice()
  }, [id])

  // 3. Payment Logic
  const payWithSTX = async () => {
    if (!invoice) return
    const txOptions: any = {
      contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
      contractName: process.env.NEXT_PUBLIC_CONTRACT_NAME!,
      functionName: 'pay-invoice-stx',
      functionArgs: [
        uintCV(Number(id || 0)), 
        uintCV(BigInt(invoice.amount.value)) // Use BigInt for safety
      ],
      network: getNetwork(),
      appDetails: { name: 'sBTC Payment Processor', icon: '/favicon.ico' },
      onFinish: (data: any) => alert(`STX payment submitted! TXID: ${data.txId}`),
    }
    await openContractCall(txOptions)
  }

  const payWithSbtc = async () => {
    if (!invoice) return
    const tokenContract = process.env.NEXT_PUBLIC_SBTC_CONTRACT!
    const txOptions: any = {
      contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
      contractName: process.env.NEXT_PUBLIC_CONTRACT_NAME!,
      functionName: 'pay-invoice-ft',
      functionArgs: [
        uintCV(Number(id || 0)), 
        standardPrincipalCV(tokenContract), 
        uintCV(BigInt(invoice.amount.value))
      ],
      network: getNetwork(),
      appDetails: { name: 'sBTC Payment Processor', icon: '/favicon.ico' },
      onFinish: (data: any) => alert(`sBTC payment submitted! TXID: ${data.txId}`),
    }
    await openContractCall(txOptions)
  }

  // 4. Render States
  if (loading) return <div style={{ padding: 24 }}>Loading invoice details...</div>
  if (!invoice) return <div style={{ padding: 24 }}>Invoice not found.</div>

  return (
    <div style={{ padding: 24, maxWidth: 500, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <h2 style={{ marginTop: 0 }}>Pay Invoice #{id}</h2>
        
        <div style={{ marginBottom: 20, backgroundColor: '#f9f9f9', padding: 16, borderRadius: 8 }}>
          <p style={{ margin: '4px 0', color: '#666' }}>Amount Due</p>
          <h1 style={{ margin: 0 }}>
            {/* Format amount based on STX (6 decimals) or sBTC (8 decimals) */}
            {invoice.token?.value === 'STX' 
              ? (Number(invoice.amount.value) / 1000000).toLocaleString() 
              : (Number(invoice.amount.value) / 100000000).toFixed(8)} 
            {' '}{invoice.token?.value}
          </h1>
          <p style={{ marginTop: 12, fontSize: '0.9em' }}>
            <strong>Memo:</strong> {invoice.memo?.value || 'No description'}
          </p>
          <p style={{ fontSize: '0.8em', color: '#888' }}>
            Merchant: {invoice.merchant?.value.slice(0, 12)}...
          </p>
        </div>

        {!userData ? (
          <button 
            onClick={handleConnect}
            style={{ width: '100%', padding: 12, backgroundColor: '#000', color: '#fff', borderRadius: 8, cursor: 'pointer' }}
          >
            Connect Wallet to Pay
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button 
              onClick={payWithSTX} 
              style={{ padding: 12, backgroundColor: '#5546FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
            >
              Pay with STX
            </button>
            <button 
              onClick={payWithSbtc} 
              style={{ padding: 12, backgroundColor: '#F7931A', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
            >
              Pay with sBTC
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.8em', color: '#666' }}>
              Connected: {userData.profile.stxAddress.mainnet.slice(0, 6)}...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
