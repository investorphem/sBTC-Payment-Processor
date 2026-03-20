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

  // --- 🛠️ BULLETPROOF DECODER ---
  const decodeClarityValue = (val: any): string => {
    if (!val) return "";
    if (val.value !== undefined && typeof val.value !== 'bigint' && typeof val.value !== 'number') {
      return decodeClarityValue(val.value);
    }
    if (typeof val === 'string' && val.startsWith('0x')) {
      try {
        return Buffer.from(val.slice(2), 'hex').toString('utf8').replace(/\0/g, '');
      } catch (e) { return val; }
    }
    if (val.data && val.data instanceof Uint8Array) {
      return Buffer.from(val.data).toString('utf8').replace(/\0/g, '');
    }
    return String(val?.value || val);
  };

  // --- 🔢 SAFE NUMBER EXTRACTOR ---
  const extractAmount = (val: any): number => {
    if (!val) return 0;
    if (typeof val === 'bigint' || typeof val === 'number') return Number(val);
    if (typeof val.value === 'bigint' || typeof val.value === 'number') return Number(val.value);
    if (typeof val === 'string') return Number(val);
    return 0;
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
      } catch (err) { console.error("Fetch error:", err); } finally { setLoading(false); }
    };
    fetchInvoiceFromChain();
  }, [id, router.isReady]);

  // --- 🛑 GUARDS ---
  if (loading) return <div className="container" style={{textAlign: 'center', padding: '100px'}}>Loading Invoice...</div>;
  
  // Unwrap the initial "Some" wrapper from the map-get?
  const data = invoice?.value ? invoice.value : invoice;

  if (!data || !data.merchant) {
    return <div className="container" style={{textAlign: 'center', padding: '100px'}}>Invoice #{invoiceId} Not Found</div>;
  }

  // --- ✅ DATA PROCESSING ---
  const rawToken = decodeClarityValue(data.token);
  const isSTX = rawToken.toUpperCase() === "STX" || data.token === "0x535458";
  
  // Use the safe extractor to fix the NaN
  const amountNumber = extractAmount(data.amount);
  
  const displayAmount = isSTX 
    ? (amountNumber / 1000000).toLocaleString() 
    : (amountNumber / 100000000).toFixed(8);

  const memoDisplay = decodeClarityValue(data.memo);

  const executePayment = async () => {
    if (!data || invoiceId === null || !userData) return;
    try {
      const network = getNetwork();
      const amountBigInt = BigInt(amountNumber);
      const senderAddress = userData.profile.stxAddress.mainnet;

      const postConditions = isSTX ? [
        makeStandardSTXPostCondition(senderAddress, FungibleConditionCode.Equal, amountBigInt)
      ] : [];

      await openContractCall({
        contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
        contractName: process.env.NEXT_PUBLIC_CONTRACT_NAME!,
        functionName: isSTX ? 'pay-invoice-stx' : 'pay-invoice-ft',
        functionArgs: isSTX 
          ? [uintCV(invoiceId), uintCV(amountBigInt)] 
          : [
              uintCV(invoiceId), 
              contractPrincipalCV(
                process.env.NEXT_PUBLIC_SBTC_CONTRACT!.split('.')[0], 
                process.env.NEXT_PUBLIC_SBTC_CONTRACT!.split('.')[1]
              ), 
              uintCV(amountBigInt)
            ],
        network,
        postConditions,
        postConditionMode: PostConditionMode.Deny,
        onFinish: (txData: any) => {
          setPaymentTxId(txData.txId);
          setPaymentStatus('pending');
        },
      });
    } catch (err) { console.error("Payment error:", err); }
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
          <label style={{fontSize: '0.8rem'}}>AMOUNT DUE</label>
          <h1 style={{ fontSize: '2.5rem', margin: '10px 0', color: isSTX ? '#fc6432' : '#f7931a' }}>
            {displayAmount} <span style={{ fontSize: '1.2rem', color: '#fff' }}>{isSTX ? "STX" : "sBTC"}</span>
          </h1>
          <p style={{marginTop: '15px', borderTop: '1px solid #333', paddingTop: '10px'}}>
            <strong>Memo:</strong> {memoDisplay || "None"}
          </p>
        </div>

        {!userData ? (
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
