import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { readInvoice } from '../../lib/contract'
import { connectWallet, getUserData } from '../../lib/wallet'
import { openContractCall } from '@stacks/connect'
import { getNetwork } from '../../lib/network'
import { uintCV, contractPrincipalCV, PostConditionMode } from '@stacks/transactions'

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

        // Handle TXID (starts with 0x)
        if (String(id).startsWith('0x')) {
          const txResponse = await fetch(`${network.coreApiUrl}/extended/v1/tx/${id}`)
          const txData = await txResponse.json()

          // Check if the transaction actually contains a result
          if (txData?.tx_result?.repr) {
            const extractedId = parseInt(txData.tx_result.repr.replace(/[^0-9]/g, ''))
            if (!isNaN(extractedId)) {
              setInvoiceId(extractedId)
              const resp = await readInvoice(extractedId)
              setInvoice(resp)
            }
          }
        } else {
          // Handle simple numeric ID
          const numId = Number(id)
          if (!isNaN(numId)) {
            setInvoiceId(numId)
            const resp = await readInvoice(numId)
            setInvoice(resp)
          }
        }
      } catch (err) {
        console.error("Failed to fetch invoice:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchInvoiceFromChain()
  }, [id])

  const payWithSTX = async () => {
    if (!invoice || invoiceId === null) return
    
    await openContractCall({
      contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
      contractName: process.env.NEXT_PUBLIC_CONTRACT_NAME!,
      functionName: 'pay-invoice-stx',
      functionArgs: [
        uintCV(invoiceId), 
        uintCV(BigInt(invoice?.amount?.value || 0))
      ],
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
      functionArgs: [
        uintCV(invoiceId), 
        contractPrincipalCV(addr, name), 
        uintCV(BigInt(invoice?.amount?.value || 0))
      ],
      network: getNetwork(),
      postConditionMode: PostConditionMode.Allow,
      anchorMode: 1,
      appDetails: { name: 'sBTC Payment Processor', icon: '/favicon.ico' },
      onFinish: (data: any) => alert(`sBTC payment submitted! TXID: ${data.txId}`),
    })
  }

  // Loading and Error States
  if (loading) return <div className="container" style={{padding: '50px', textAlign: 'center'}}>Loading invoice details...</div>
  if (!invoice) return <div className="container" style={{padding: '50px', textAlign: 'center'}}>Invoice not found or still processing.</div>

  // Safe variables for rendering
  const tokenName = invoice?.token?.value || 'Tokens'
  const isSTX = String(tokenName).includes('STX')
  const rawAmount = Number(invoice?.amount?.value || 0)

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
          <label style={{ fontSize: '0.8rem', letterSpacing: '1px' }}>AMOUNT DUE</label>
          <h1 style={{ fontSize: '2.5rem', margin: '10px 0', color: isSTX ? 'var(--accent-stx)' : 'var(--accent-sbtc)' }}>
            {isSTX 
              ? (rawAmount / 1000000).toLocaleString() 
              : (rawAmount / 100000000).toFixed(8)} 
            <span style={{ fontSize: '1rem', marginLeft: '8px', color: 'white' }}>{tokenName}</span>
          </h1>
          
          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
            <p style={{ fontSize: '0.9rem', marginBottom: '5px' }}>
              <strong>Memo:</strong> {invoice?.memo?.value || 'No reference'}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Merchant: {invoice?.merchant?.value ? `${invoice.merchant.value.slice(0, 15)}...` : 'N/A'}
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
              Paying as: {userData?.profile?.stxAddress?.mainnet?.slice(0, 8) || 'Connected'}...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
