import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { readInvoice } from '../../lib/contract'
import { connectWallet, getUserData } from '../../lib/wallet'
import { openContractCall } from '@stacks/connect'
import { getNetwork } from '../../lib/network'
import { uintCV, contractPrincipalCV, PostConditionMode, pc } from '@stacks/transactions'

export default function PayInvoice() {
  const router = useRouter()
  const { id } = router.query

  // --- UI States ---
  const [invoice, setInvoice] = useState<any>(null)
  const [invoiceId, setInvoiceId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState<any>(null)
  
  // --- Payment Tracking States ---
  const [paymentTxId, setPaymentTxId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');

  useEffect(() => {
    const user = getUserData()
    if (user) setUserData(user)
  }, [])

  // 1. Transaction Polking Logic
  useEffect(() => {
    if (!paymentTxId || paymentStatus !== 'pending') return;

    const checkStatus = async () => {
      try {
        const network = getNetwork();
        const response = await fetch(`${network.coreApiUrl}/extended/v1/tx/${paymentTxId}`);
        const data = await response.json();

        if (data.tx_status === 'success') {
          setPaymentStatus('success');
        } else if (data.tx_status.includes('abort')) {
          setPaymentStatus('failed');
        }
      } catch (e) {
        console.error("Error checking tx status", e);
      }
    };

    // Poll every 5 seconds
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [paymentTxId, paymentStatus]);

  // (Include previous fetchInvoiceFromChain and decodeBuffer logic here...)
  // ... [omitted for brevity, keep your existing logic] ...

  const executePayment = async () => {
    if (!invoice || invoiceId === null || !userData) return;
    const network = getNetwork();
    const isSTX = invoice?.token === "0x535458" || invoice?.token === "STX";
    const amount = BigInt(invoice.amount);

    const postConditions = isSTX ? [pc.stx(userData.profile.stxAddress.mainnet).transfer(amount)] : [];

    await openContractCall({
      contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
      contractName: process.env.NEXT_PUBLIC_CONTRACT_NAME!,
      functionName: isSTX ? 'pay-invoice-stx' : 'pay-invoice-ft',
      functionArgs: isSTX ? [uintCV(invoiceId), uintCV(amount)] : [/* ... FT Args ... */],
      network,
      postConditions,
      postConditionMode: PostConditionMode.Deny,
      onFinish: (data: any) => {
        setPaymentTxId(data.txId);
        setPaymentStatus('pending');
      },
    });
  }

  // --- Conditional Rendering for Success ---
  if (paymentStatus === 'success') {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div className="card" style={{ maxWidth: 450, margin: '0 auto', borderColor: '#28a745' }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🎉</div>
          <h2 style={{ color: '#28a745' }}>Payment Confirmed!</h2>
          <p>Your payment for <strong>Invoice #{invoiceId}</strong> has been successfully processed on the Stacks blockchain.</p>
          <hr style={{ border: '0', borderTop: '1px solid #eee', margin: '20px 0' }} />
          <button className="primary" onClick={() => router.push('/')}>Back to Home</button>
        </div>
      </div>
    );
  }

  // --- Rendering for Pending ---
  if (paymentStatus === 'pending') {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div className="card" style={{ maxWidth: 450, margin: '0 auto' }}>
          <div className="loader" style={{ marginBottom: '20px' }}>⌛</div>
          <h2>Transaction Pending...</h2>
          <p>Your payment is being broadcasted to the network. Please wait, this may take a few minutes.</p>
          <a 
            href={`https://explorer.hiro.so/txid/${paymentTxId}?chain=mainnet`} 
            target="_blank" 
            rel="noreferrer"
            style={{ color: 'var(--accent-stx)', fontSize: '0.9rem' }}
          >
            View on Explorer ↗
          </a>
        </div>
      </div>
    );
  }

  // (Standard Pay View remains here...)
  return (
     <div className="container">
       {/* ... Your existing payment UI ... */}
     </div>
  );
}
