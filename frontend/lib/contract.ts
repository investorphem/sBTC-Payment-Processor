import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { readInvoice } from '../../lib/contract'
import { connectWallet, getUserData } from '../../lib/wallet'
import { openContractCall } from '@stacks/connect'
import { getNetwork } from '../../lib/network'
import { 
  uintCV, 
  contractPrincipalCV, 
  PostConditionMode, 
  makeStandardSTXPostCondition, 
  FungibleConditionCode 
} from '@stacks/transactions'

export default function PayInvoice() {
  const router = useRouter()
  const { id } = router.query

  // --- UI & Data States ---
  const [invoice, setInvoice] = useState<any>(null)
  const [invoiceId, setInvoiceId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState<any>(null)

  // --- Payment Tracking States ---
  const [paymentTxId, setPaymentTxId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');

  // Load user on mount
  useEffect(() => {
    const user = getUserData()
    if (user) setUserData(user)
  }, [])

  // Handle Wallet Connection
  const handleConnect = async () => {
    try {
      const user = await connectWallet() as any
      if (user) setUserData(user)
    } catch (err) {
      console.error("Connection failed", err)
    }
  }

  // Helper: Decode Hex Buffers (Critical for identifying "STX")
  const decodeBuffer = (hex: string) => {
    if (!hex || !hex.startsWith('0x')) return hex;
    try {
      const bytes = Buffer.from(hex.slice(2), 'hex');
      return bytes.toString('utf8').replace(/\0/g, '');
    } catch (e) { return hex; }
  };

  // 1. Transaction Polling Logic (Checks if payment confirmed)
  useEffect(() => {
    if (!paymentTxId || paymentStatus !== 'pending') return;

    const checkStatus = async () => {
      try {
        const network = getNetwork();
        const response = await fetch(`${network.coreApiUrl}/extended/v1/tx/${paymentTxId}`);
        const data = await response.json();

        if (data.tx_status === 'success') {
          setPaymentStatus('success');
        } else if (data.tx_status && data.tx_status.includes('abort')) {
          setPaymentStatus('failed');
        }
      } catch (e) {
        console.error("Error checking tx status", e);
      }
    };

    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [paymentTxId, paymentStatus]);

  // 2. Fetch Invoice Data from Chain
  useEffect(() => {
    if (!id) return;

    const fetchInvoiceFromChain = async () => {
      try {
        setLoading(true);
        const network = getNetwork();
        let finalId: number | null = null;

        // Resolve ID if a TXID was passed in the URL
        if (String(id).startsWith('0x')) {
          const txResponse = await fetch(`${network.coreApiUrl}/extended/v1/tx/${id}`);
          const txData = await txResponse.json();
          if (txData?.tx_result?.repr) {
            const match = txData.tx_result.repr.match(/\d+/);
            if (match) finalId = parseInt(match[0]);
          }
        } else {
          finalId = Number(id);
        }

        if (finalId !== null && !isNaN(finalId)) {
          setInvoiceId(finalId);
          const data = await readInvoice(finalId);
          if (data) setInvoice(data);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoiceFromChain();
  }, [id]);

  // --- 🛑 CRITICAL GUARDS: Prevent crashes while loading ---
  if (loading) return <div className="container" style={{textAlign: 'center', padding: '100px'}}>Searching blockchain for invoice...</div>;
  if (!invoice) return <div className="container" style={{textAlign: 'center', padding: '100px'}}>Invoice #{invoiceId} not found.</div>;

  // --- DERIVED VALUES (Logic runs only after guards pass) ---
  const rawToken = invoice?.token || "";
  const decodedTokenName = decodeBuffer(rawToken).toUpperCase();
  
  // Check against Hex 0x535458, String "STX", and decoded string
  const isSTX = rawToken === "0x535458" || rawToken === "STX" || decodedTokenName === "STX";
  
  const displayAmount = isSTX 
    ? (Number(invoice?.amount || 0) / 1000000).toLocaleString() 
    : (Number(invoice?.amount || 0) / 100000000).toFixed(8);

  const executePayment = async () => {
    if (!invoice || invoiceId === null || !userData) return;
    
    const network = getNetwork();
    const amount = BigInt(invoice.amount);
    const senderAddress = userData.profile.stxAddress.mainnet;

    const postConditions = [];
    if (isSTX) {
      postConditions.push(
        makeStandardSTXPostCondition(
          senderAddress,
          FungibleConditionCode.Equal,
          amount
        )
      );
    }

    await openContractCall({
      contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
      contractName: process.env.NEXT_PUBLIC_CONTRACT_NAME!,
      functionName: isSTX ? 'pay-invoice-stx' : 'pay-invoice-ft',
      functionArgs: isSTX 
        ? [uintCV(invoiceId), uintCV(amount)] 
        : [
            uintCV(invoiceId), 
            contractPrincipalCV(
              process.env.NEXT_PUBLIC_SBTC_CONTRACT!.split('.')[0], 
              process.env.NEXT_PUBLIC_SBTC_CONTRACT!.split('.')[1]
            ), 
            uintCV(amount)
          ],
      network,
      postConditions,
      postConditionMode: PostConditionMode.Deny,
      onFinish: (data: any) => {
        setPaymentTxId(data.txId);
        setPaymentStatus('pending');
      },
    });
  }

  // --- SCREEN RENDERING ---

  if (paymentStatus === 'success') {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', borderColor: 'var(--success-green)' }}>
          <div className="success-icon">✓</div>
          <h2 className="status-text">Payment Confirmed!</h2>
          <p className="status-subtext">Invoice #{invoiceId} has been successfully settled.</p>
          <button className="primary" onClick={() => router.push('/')} style={{ width: '100%' }}>Return Home</button>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'pending') {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="loader-container">
            <div className="loader"></div>
            <h2 className="status-text">Broadcasting...</h2>
            <p className="status-subtext">Waiting for Stacks block confirmation</p>
            <a href={`https://explorer.hiro.so/txid/${paymentTxId}?chain=mainnet`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-stx)', fontSize: '0.85rem' }}>View on Explorer ↗</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 450, margin: '40px auto' }}>
        <h2 style={{ textAlign: 'center' }}>Complete Payment</h2>
        <p style={{ textAlign: 'center', opacity: 0.6, marginTop: -15, fontSize: '0.9rem' }}>Invoice #{invoiceId}</p>

        <div style={{ 
            margin: '24px 0', 
            padding: '24px', 
            background: 'rgba(255,255,255,0.03)', 
            borderRadius: 16, 
            textAlign: 'center', 
            border: `1px solid ${isSTX ? 'var(--accent-stx)' : 'var(--accent-sbtc)'}` 
        }}>
          <label>AMOUNT DUE</label>
          <h1 style={{ fontSize: '2.5rem', margin: '10px 0', color: isSTX ? 'var(--accent-stx)' : 'var(--accent-sbtc)' }}>
            {displayAmount} 
            <span style={{ fontSize: '1.2rem', marginLeft: '8px', color: 'white' }}>{isSTX ? "STX" : "sBTC"}</span>
          </h1>
          <div style={{ marginTop: '15px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
            <p style={{ margin: 0 }}><strong>Memo:</strong> {decodeBuffer(invoice.memo)}</p>
          </div>
        </div>

        {!userData ? (
          <button className="primary" onClick={handleConnect} style={{ width: '100%' }}>Connect Wallet to Pay</button>
        ) : (
          <button 
            className={isSTX ? "primary" : "sbtc"} 
            onClick={executePayment} 
            style={{ width: '100%' }}
          >
            Pay with {isSTX ? "STX" : "sBTC"}
          </button>
        )}
      </div>
    </div>
  )
}
