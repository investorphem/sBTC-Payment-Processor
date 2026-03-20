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

  // --- 🛠️ UPDATED DECODER (Handles nested .value) ---
  const decodeClarityValue = (val: any): string => {
    if (!val) return "";
    
    // If it's the Clarity "Some" wrapper, go deeper
    if (val.value !== undefined) return decodeClarityValue(val.value);

    // If it's a hex string
    if (typeof val === 'string' && val.startsWith('0x')) {
      try {
        return Buffer.from(val.slice(2), 'hex').toString('utf8').replace(/\0/g, '');
      } catch (e) { return val; }
    }
    
    // If it's a Buffer/Uint8Array object
    if (val.data && val.data instanceof Uint8Array) {
      return Buffer.from(val.data).toString('utf8').replace(/\0/g, '');
    }

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
          // ✅ IMPORTANT: Store the raw result; we unwrap it below
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

  // --- 🛑 CRITICAL GUARDS ---
  if (loading) return <div className="container" style={{textAlign: 'center', padding: '100px'}}>Loading Invoice...</div>;
  
  // Unwrap the Clarity 'Some' if it exists
  const invoiceData = invoice?.value ? invoice.value : invoice;

  if (!invoiceData || !invoiceData.amount) {
    return <div className="container" style={{textAlign: 'center', padding: '100px'}}>Invoice Not Found</div>;
  }

  // --- ✅ SAFE DATA ACCESS ---
  const rawToken = decodeClarityValue(invoiceData.token);
  const tokenName = rawToken.toUpperCase();
  
  // Logic to identify STX
  const isSTX = tokenName === "STX" || invoiceData.token === "0x535458";

  // Fix NaN by ensuring amount is a Number
  const amountAsNum = Number(invoiceData.amount);
  const displayAmount = isSTX 
    ? (amountAsNum / 1000000).toLocaleString() 
    : (amountAsNum / 100000000).toFixed(8);

  const memoDisplay = decodeClarityValue(invoiceData.memo);

  const executePayment = async () => {
    if (!invoiceData || invoiceId === null || !userData) return;
    
    try {
      const network = getNetwork();
      const amount = BigInt(invoiceData.amount);
      const senderAddress = userData.profile.stxAddress.mainnet;

      const postConditions = isSTX ? [
        makeStandardSTXPostCondition(senderAddress, FungibleConditionCode.Equal, amount)
      ] : [];

      // Check if sBTC contract is defined for FT payments
      const sbtcContract = process.env.NEXT_PUBLIC_SBTC_CONTRACT || "";
      const [contractAddr, contractName] = sbtcContract.split('.');

      await openContractCall({
        contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
        contractName: process.env.NEXT_PUBLIC_CONTRACT_NAME!,
        functionName: isSTX ? 'pay-invoice-stx' : 'pay-invoice-ft',
        functionArgs: isSTX 
          ? [uintCV(invoiceId), uintCV(amount)] 
          : [
              uintCV(invoiceId), 
              contractPrincipalCV(contractAddr, contractName), 
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
    } catch (err) {
      console.error("Payment initialization failed", err);
    }
  }

  // --- UI RENDERING ---
  if (paymentStatus === 'success') {
    return (
      <div className="container" style={{padding: '40px'}}>
        <div className="card" style={{ textAlign: 'center', borderColor: '#28a745' }}>
          <h2 style={{color: '#28a745'}}>✓ Payment Confirmed!</h2>
          <p>Invoice #{invoiceId} paid successfully.</p>
          <button className="primary" onClick={() => router.push('/')} style={{width:'100%', marginTop: '20px'}}>Return Home</button>
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
            borderRadius: 16, textAlign: 'center', border: `1px solid ${isSTX ? '#fc6432' : '#f7931a'}` 
        }}>
          <label style={{fontSize: '0.8rem', letterSpacing: '1px'}}>AMOUNT DUE</label>
          <h1 style={{ fontSize: '2.5rem', margin: '10px 0', color: isSTX ? '#fc6432' : '#f7931a' }}>
            {displayAmount} <span style={{ fontSize: '1.2rem', color: '#fff' }}>{isSTX ? "STX" : "sBTC"}</span>
          </h1>
          <p style={{marginTop: '15px', borderTop: '1px solid #333', paddingTop: '10px'}}>
            <strong>Memo:</strong> {memoDisplay || "None"}
          </p>
        </div>

        {paymentStatus === 'pending' ? (
           <div style={{textAlign: 'center', padding: '10px'}}>
              <div className="loader" style={{margin: '0 auto 10px'}}></div>
              <p>Broadcasting Transaction...</p>
              <a href={`https://explorer.hiro.so/txid/${paymentTxId}?chain=mainnet`} target="_blank" rel="noreferrer" style={{color: '#fc6432', fontSize: '0.8rem'}}>View on Explorer ↗</a>
           </div>
        ) : !userData ? (
          <button className="primary" onClick={handleConnect} style={{ width: '100%' }}>Connect Wallet to Pay</button>
        ) : (
          <button className={isSTX ? "primary" : "sbtc"} onClick={executePayment} style={{ width: '100%' }}>
            Confirm & Pay {isSTX ? "STX" : "sBTC"}
          </button>
        )}
      </div>
    </div>
  )
}
