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
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed' | 'already_paid'>('idle');
  const [receiptTxId, setReceiptTxId] = useState<string | null>(null);

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

  // Helper to check if this Invoice ID has already been settled on-chain
  const checkIfAlreadyPaid = async (targetId: number) => {
    try {
      const network = getNetwork();
      const contractId = `${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}.${process.env.NEXT_PUBLIC_CONTRACT_NAME}`;
      
      // Fetch recent transactions for this contract
      const response = await fetch(`${network.coreApiUrl}/extended/v1/address/${contractId}/transactions?limit=50&unanchored=true`);
      const data = await response.json();

      // Look for a successful payment call matching this invoice ID
      const payment = data.results.find((tx: any) => 
        tx.tx_status === 'success' &&
        tx.contract_call?.function_name.includes('pay-invoice') &&
        tx.contract_call?.function_args?.some((arg: any) => arg.repr === `u${targetId}`)
      );

      if (payment) {
        setPaymentStatus('already_paid');
        setReceiptTxId(payment.tx_id);
      }
    } catch (e) {
      console.error("Payment status check failed", e);
    }
  };

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
    return String(val?.value || val);
  };

  const extractAmount = (val: any): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'bigint') return Number(val);
    if (val.value !== undefined) return extractAmount(val.value);
    return Number(String(val).replace('u', '')) || 0;
  };

  useEffect(() => {
    if (!id || !router.isReady) return;
    const fetchInvoiceFromChain = async () => {
      try {
        setLoading(true);
        const network = getNetwork();
        let finalId: number | null = null;

        // Extract Invoice ID from TXID if needed
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
          // Check if it's already paid after we have the ID
          await checkIfAlreadyPaid(finalId);
        }
      } catch (err) { console.error("Fetch error:", err); } finally { setLoading(false); }
    };
    fetchInvoiceFromChain();
  }, [id, router.isReady]);

  // Monitor for real-time transaction updates
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

  if (loading) return <div className="container" style={{textAlign: 'center', padding: '100px'}}>Loading Invoice...</div>;

  const data = invoice?.value ? invoice.value : invoice;
  if (!data || (!data.merchant && !data.amount)) {
    return <div className="container" style={{textAlign: 'center', padding: '100px'}}>Invoice Not Found</div>;
  }

  const rawToken = decodeClarityValue(data.token);
  const isSTX = rawToken.toUpperCase().includes("STX") || data.token === "0x535458";
  const amountNumber = extractAmount(data.amount);
  const displayAmount = isSTX ? (amountNumber / 1e6).toFixed(2) : (amountNumber / 1e8).toFixed(8);
  const memoDisplay = decodeClarityValue(data.memo);

  const executePayment = async () => {
    if (!data || invoiceId === null || !userData || paymentStatus === 'already_paid') return;
    try {
      const network = getNetwork();
      const amountBigInt = BigInt(String(data.amount?.value || data.amount).replace('u', ''));
      const senderAddress = userData.profile.stxAddress.mainnet || userData.profile.stxAddress.testnet;

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
    <div className="container" style={{ padding: '24px', maxWidth: '450px', margin: '0 auto' }}>
      <div className="card shadow" style={{ textAlign: 'center', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
        
        {/* --- DYNAMIC BRANDING HEADER --- */}
        <div style={{ 
          background: !isSTX ? 'linear-gradient(135deg, #f7931a 0%, #ffab40 100%)' : 'linear-gradient(135deg, #fc6432 0%, #ff8e6e 100%)',
          padding: '40px 20px', margin: '-24px -24px 24px -24px', color: '#fff'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '10px' }}>{!isSTX ? '₿' : 'S'}</div>
          <h2 style={{ margin: 0 }}>{paymentStatus === 'already_paid' ? 'Payment Completed' : `Pay with ${isSTX ? 'STX' : 'sBTC'}`}</h2>
        </div>

        <p style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '20px' }}>Invoice #{invoiceId}</p>

        {/* --- INVOICE DETAILS --- */}
        <div style={{ padding: '24px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' }}>
          <label style={{ fontSize: '0.65rem', opacity: 0.5, letterSpacing: '1px' }}>AMOUNT DUE</label>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '5px 0' }}>
            {displayAmount} <span style={{ fontSize: '1rem', opacity: 0.8 }}>{isSTX ? "STX" : "sBTC"}</span>
          </div>
          <p style={{ margin: '15px 0 0 0', fontSize: '0.9rem', opacity: 0.8 }}>
            <strong>Memo:</strong> {memoDisplay || "No memo provided"}
          </p>
        </div>

        {/* --- PAYMENT ACTIONS --- */}
        {paymentStatus === 'already_paid' ? (
          <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(40, 167, 69, 0.1)', border: '1px solid #28a745' }}>
            <h4 style={{ color: '#28a745', margin: '0 0 8px 0' }}>✓ Already Settled</h4>
            <p style={{ fontSize: '0.85rem', margin: '0 0 10px 0' }}>This invoice has already been paid.</p>
            <a href={`https://explorer.hiro.so/txid/${receiptTxId}?chain=mainnet`} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#5546ff', fontWeight: 'bold' }}>
              View Receipt ↗
            </a>
          </div>
        ) : paymentStatus === 'pending' ? (
          <div style={{ padding: '20px' }}>
             <div className="loader" style={{ margin: '0 auto 10px auto' }}></div>
             <p>Waiting for confirmation...</p>
          </div>
        ) : paymentStatus === 'success' ? (
            <div style={{ color: '#28a745', padding: '20px' }}>
                <h3>Payment Success!</h3>
                <button className="primary" onClick={() => router.push('/')} style={{width:'100%'}}>Return Home</button>
            </div>
        ) : !userData ? (
          <button className="primary" onClick={handleConnect} style={{ width: '100%' }}>Connect Wallet to Pay</button>
        ) : (
          <button className="primary" onClick={executePayment} style={{ width: '100%', padding: '18px', fontSize: '1.1rem', background: !isSTX ? '#f7931a' : '#fc6432', border: 'none' }}>
            Confirm & Pay
          </button>
        )}
      </div>
    </div>
  )
}
