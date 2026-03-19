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

  // --- Helper: Recursively clean Stacks Clarity Objects ---
  const cleanCV = (obj: any): any => {
    if (!obj) return null;
    if (typeof obj !== 'object') return obj;
    if (obj.value !== undefined && obj.type === undefined) return cleanCV(obj.value);
    if (obj.data !== undefined) return cleanCV(obj.data);
    
    // If it's a map/object, clean each key
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = obj[key]?.value !== undefined ? cleanCV(obj[key].value) : obj[key];
    }
    return newObj;
  };

  // --- Helper: Decode Hex Buffers ---
  const decodeHex = (val: any) => {
    const str = String(val || "");
    if (!str.startsWith('0x')) return str;
    try {
      return window.Buffer.from(str.slice(2), 'hex').toString().replace(/\0/g, '');
    } catch (e) { return str; }
  };

  useEffect(() => {
    if (!id) return;

    const fetchInvoiceFromChain = async () => {
      try {
        setLoading(true);
        const network = getNetwork();
        let finalId: number | null = null;

        if (String(id).startsWith('0x')) {
          const txResponse = await fetch(`${network.coreApiUrl}/extended/v1/tx/${id}`);
          const txData = await txResponse.json();
          if (txData?.tx_result?.repr) {
            finalId = parseInt(txData.tx_result.repr.replace(/[^0-9]/g, ''));
          }
        } else {
          finalId = Number(id);
        }

        if (finalId !== null && !isNaN(finalId)) {
          setInvoiceId(finalId);
          const resp = await readInvoice(finalId) as any;
          
          // Apply the recursive cleaner to get a flat object
          const cleaned = cleanCV(resp);
          console.log("Cleaned Invoice Data:", cleaned);
          setInvoice(cleaned);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoiceFromChain();
  }, [id]);

  // --- Derived Variables ---
  const tokenName = decodeHex(invoice?.token).toUpperCase();
  const isSTX = tokenName === "STX" || tokenName === "0X535458";
  const memoText = invoice?.memo ? decodeHex(invoice.memo) : "No reference";
  const merchantAddr = String(invoice?.merchant || "N/A");
  const rawAmount = invoice?.amount ? BigInt(invoice.amount) : BigInt(0);

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

  if (loading) return <div className="container" style={{textAlign: 'center', padding: '100px'}}>Loading invoice...</div>
  if (!invoice || (rawAmount === BigInt(0) && !loading)) return <div className="container" style={{textAlign: 'center', padding: '100px'}}>Invoice not found.</div>

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 450, margin: '40px auto' }}>
        <h2 style={{ textAlign: 'center' }}>Complete Payment</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Invoice #{invoiceId}</p>

        <div style={{ margin: '24px 0', padding: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: 16, textAlign: 'center', border: '1px solid var(--border-color)' }}>
          <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>AMOUNT DUE</label>
          <h1 style={{ fontSize: '2.5rem', margin: '10px 0', color: isSTX ? 'var(--accent-stx)' : 'var(--accent-sbtc)' }}>
            {isSTX ? (Number(rawAmount) / 1000000).toLocaleString() : (Number(rawAmount) / 100000000).toFixed(8)} 
            <span style={{ fontSize: '1.2rem', marginLeft: '10px', color: 'white' }}>{isSTX ? "STX" : "sBTC"}</span>
          </h1>
          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
            <p><strong>Memo:</strong> {memoText}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>Merchant: {merchantAddr}</p>
          </div>
        </div>

        {!userData ? (
          <button className="primary" onClick={handleConnect} style={{ width: '100%' }}>Connect Wallet to Pay</button>
        ) : (
          <button className={isSTX ? "primary" : "sbtc"} onClick={isSTX ? payWithSTX : payWithSbtc} style={{ width: '100%' }}>
            Pay with {isSTX ? "STX" : "sBTC"}
          </button>
        )}
      </div>
    </div>
  )
}
