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

  const [invoice, setInvoice] = useState<any>(null)
  const [invoiceId, setInvoiceId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState<any>(null)
  const [paymentTxId, setPaymentTxId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');

  useEffect(() => {
    const user = getUserData()
    if (user) setUserData(user)
  }, [])

  const handleConnect = async () => {
    try {
      const user = await connectWallet() as any
      if (user) setUserData(user)
    } catch (err) {
      console.error("Connection failed", err)
    }
  }

  // --- 🛠️ ROBUST DECODING HELPER ---
  const decodeClarityValue = (val: any) => {
    if (!val) return "";
    // If it's a hex string from an API
    if (typeof val === 'string' && val.startsWith('0x')) {
      try {
        return Buffer.from(val.slice(2), 'hex').toString('utf8').replace(/\0/g, '');
      } catch (e) { return val; }
    }
    // If it's an object with a data property (Uint8Array)
    if (val.data && val.data instanceof Uint8Array) {
      return Buffer.from(val.data).toString('utf8').replace(/\0/g, '');
    }
    // If it's wrapped in a 'value' key (Clarity Response/Optional)
    if (val.value) return decodeClarityValue(val.value);
    
    return String(val);
  };

  useEffect(() => {
    if (!id || !router.isReady) return;

    const fetchInvoiceFromChain = async () => {
      try {
        setLoading(true);
        const network = getNetwork();
        let finalId: number | null = null;

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
  }, [id, router.isReady]);

  // --- 🕵️ TRANSACTION POLLING ---
  useEffect(() => {
    if (!paymentTxId || paymentStatus !== 'pending') return;
    const checkStatus = async () => {
      try {
        const network = getNetwork();
        const response = await fetch(`${network.coreApiUrl}/extended/v1/tx/${paymentTxId}`);
        const data = await response.json();
        if (data.tx_status === 'success') setPaymentStatus('success');
        if (data.tx_status?.includes('abort')) setPaymentStatus('failed');
      } catch (e) { console.error(e); }
    };
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [paymentTxId, paymentStatus]);

  // --- 🛑 CRITICAL GUARDS: Prevent "Client-side exception" ---
  if (loading) return <div className="container" style={{textAlign: 'center', padding: '100px'}}>Loading Invoice...</div>;
  if (!invoice) return <div className="container" style={{textAlign: 'center', padding: '100px'}}>Invoice Not Found</div>;

  // --- ✅ SAFE DATA ACCESS ---
  const tokenName = decodeClarityValue(invoice.token).toUpperCase();
  const isSTX = tokenName === "STX" || invoice.token === "0x535458";
  
  const displayAmount = isSTX 
    ? (Number(invoice.amount || 0) / 1000000).toLocaleString() 
    : (Number(invoice.amount || 0) / 100000000).toFixed(8);

  const memoDisplay = invoice.memo ? decodeClarityValue(invoice.memo) : "No memo";

  const executePayment = async () => {
    if (!invoice || invoiceId === null || !userData) return;
    const network = getNetwork();
    const amount = BigInt(invoice.amount);
    const senderAddress = userData.profile.stxAddress.mainnet;

    const postConditions = isSTX ? [
      makeStandardSTXPostCondition(senderAddress, FungibleConditionCode.Equal, amount)
    ] : [];

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

  // --- UI RENDERING ---
  if (paymentStatus === 'success') {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', borderColor: '#28a745' }}>
          <h2>Payment Confirmed!</h2>
          <p>Invoice #{invoiceId} paid successfully.</p>
          <button className="primary" onClick={() => router.push('/')} style={{width:'100%'}}>Done</button>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'pending') {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="loader"></div>
          <h2>Processing...</h2>
          <a href={`https://explorer.hiro.so/txid/${paymentTxId}?chain=mainnet`} target="_blank" rel="noreferrer" style={{color: 'var(--accent-stx)'}}>View Explorer ↗</a>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 450, margin: '40px auto' }}>
        <h2 style={{ textAlign: 'center' }}>Complete Payment</h2>
        <p style={{ textAlign: 'center', opacity: 0.6 }}>Invoice #{invoiceId}</p>

        <div style={{ 
            margin: '24px 0', padding: '24px', background: 'rgba(255,255,255,0.03)', 
            borderRadius: 16, textAlign: 'center', border: `1px solid ${isSTX ? 'var(--accent-stx)' : 'var(--accent-sbtc)'}` 
        }}>
          <label>AMOUNT DUE</label>
          <h1 style={{ fontSize: '2.5rem', color: isSTX ? 'var(--accent-stx)' : 'var(--accent-sbtc)' }}>
            {displayAmount} <span style={{ fontSize: '1.2rem', color: '#fff' }}>{isSTX ? "STX" : "sBTC"}</span>
          </h1>
          <p><strong>Memo:</strong> {memoDisplay}</p>
        </div>

        {!userData ? (
          <button className="primary" onClick={handleConnect} style={{ width: '100%' }}>Connect Wallet</button>
        ) : (
          <button className={isSTX ? "primary" : "sbtc"} onClick={executePayment} style={{ width: '100%' }}>
            Pay with {isSTX ? "STX" : "sBTC"}
          </button>
        )}
      </div>
    </div>
  )
}
