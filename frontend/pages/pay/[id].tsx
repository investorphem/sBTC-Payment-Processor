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
  makeStandardFungiblePostCondition, 
  createAssetInfo, 
  FungibleConditionCode 
} from '@stacks/transactions'

export default function PayInvoice() {
  const router = useRouter()
  const { id } = router.query

  const [invoice, setInvoice] = useState<any>(null)
  const [invoiceId, setInvoiceId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState<any>(null)
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed' | 'already_paid'>('idle');
  const [receiptTxId, setReceiptTxId] = useState<string | null>(null);

  const SBTC_CONTRACT = process.env.NEXT_PUBLIC_SBTC_CONTRACT || "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";

  // 🚀 BRANDING HELPER
  const appDetails = {
    name: "sBTC Payment Processor",
    icon: typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : '/logo.png',
  };

  useEffect(() => {
    const user = getUserData()
    if (user) setUserData(user)
  }, [])

  const handleConnect = async () => {
    try {
      const user = await connectWallet() as any
      if (user) setUserData(user)
    } catch (err) { console.error("Connection failed", err) }
  }

  // ... (Keep your existing checkIfAlreadyPaid, decodeClarityValue, extractAmount logic)

  const executePayment = async () => {
    if (!data || invoiceId === null || !userData || paymentStatus === 'already_paid') return;
    try {
      const network = getNetwork();
      const amountBigInt = BigInt(String(data.amount?.value || data.amount).replace('u', ''));
      const senderAddress = userData.profile.stxAddress.mainnet || userData.profile.stxAddress.testnet;

      let postConditions: any[] = [];
      if (isSTX) {
        postConditions = [makeStandardSTXPostCondition(senderAddress, FungibleConditionCode.Equal, amountBigInt)];
      } else {
        const [cAddr, cName] = SBTC_CONTRACT.split('.');
        postConditions = [
          makeStandardFungiblePostCondition(
            senderAddress,
            FungibleConditionCode.Equal,
            amountBigInt,
            createAssetInfo(cAddr, cName, 'sbtc-token') // ✅ Fixed: Correct asset name
          )
        ];
      }

      await openContractCall({
        contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
        contractName: process.env.NEXT_PUBLIC_CONTRACT_NAME!,
        functionName: isSTX ? 'pay-invoice-stx' : 'pay-invoice-ft',
        functionArgs: isSTX 
          ? [uintCV(invoiceId), uintCV(amountBigInt)] 
          : [
              uintCV(invoiceId), 
              contractPrincipalCV(cAddr, cName), 
              uintCV(amountBigInt)
            ],
        network,
        postConditions,
        postConditionMode: PostConditionMode.Deny, // 🛡️ Deny mode for maximum security
        appDetails, // 🎨 Fixed: Branding inside wallet
        onFinish: (txData: any) => {
          setReceiptTxId(txData.txId);
          setPaymentStatus('pending');
        },
      });
    } catch (err) { 
        console.error("Payment error:", err); 
    }
  }

  // ... (Data extraction logic)

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '450px', margin: '0 auto' }}>
      {/* BRANDED HEADER */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <img src="/logo.png" alt="Logo" style={{ width: '50px' }} />
      </div>

      <div className="card shadow" style={{ textAlign: 'center', borderRadius: '24px', position: 'relative', overflow: 'hidden', padding: '0', border: '1px solid rgba(85, 70, 255, 0.2)' }}>

        <div style={{ 
          background: !isSTX ? 'linear-gradient(135deg, #f7931a 0%, #ffab40 100%)' : 'linear-gradient(135deg, #5546ff 0%, #7c71ff 100%)',
          padding: '40px 20px', color: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'
        }}>
          <div style={{ 
            width: '64px', height: '64px', borderRadius: '18px', background: 'rgba(255,255,255,0.2)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
            backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
          }}>
            {!isSTX ? '₿' : '⚡'}
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.9 }}>SECURE GATEWAY</div>
            <h2 style={{ margin: '4px 0 0 0', fontSize: '1.6rem', fontWeight: '800' }}>
              {paymentStatus === 'already_paid' ? 'Payment Completed' : `Pay Merchant`}
            </h2>
          </div>
        </div>

        <div style={{ padding: '30px' }}>
            <p style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '20px' }}>Invoice Reference: #{invoiceId}</p>

            <div style={{ padding: '24px', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '24px' }}>
              <label style={{ fontSize: '0.7rem', opacity: 0.5, letterSpacing: '1px', fontWeight: 'bold' }}>TOTAL TO PAY</label>
              <div style={{ fontSize: '2.8rem', fontWeight: '900', margin: '5px 0', color: !isSTX ? '#f7931a' : '#5546ff' }}>
                {displayAmount} <span style={{ fontSize: '1.2rem', opacity: 0.6, color: '#fff' }}>{isSTX ? "STX" : "sBTC"}</span>
              </div>
              <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                <span style={{opacity: 0.5}}>Memo:</span> <span style={{fontWeight: '500'}}>{memoDisplay || "Business Services"}</span>
              </div>
            </div>

            {paymentStatus === 'already_paid' ? (
              <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(40, 167, 69, 0.05)', border: '1px solid #28a745' }}>
                <h4 style={{ color: '#28a745', margin: '0 0 5px 0' }}>Settle Successfully</h4>
                <a href={`https://explorer.hiro.so/txid/${receiptTxId}?chain=mainnet`} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#5546ff', textDecoration: 'none', fontWeight: 'bold' }}>
                  View On-Chain Receipt ↗
                </a>
              </div>
            ) : !userData ? (
              <button className="primary" onClick={handleConnect} style={{ width: '100%', padding: '18px', background: 'linear-gradient(to right, #F7931A, #5546FF)', border: 'none', borderRadius: '12px', fontWeight: 'bold' }}>Connect Wallet to Pay</button>
            ) : (
              <button className="primary" onClick={executePayment} style={{ width: '100%', padding: '18px', fontSize: '1.1rem', fontWeight: 'bold', background: !isSTX ? '#f7931a' : '#5546ff', border: 'none', borderRadius: '12px', boxShadow: `0 10px 20px ${!isSTX ? 'rgba(247, 147, 26, 0.2)' : 'rgba(85, 70, 255, 0.2)'}` }}>
                Confirm Payment
              </button>
            )}

            <div style={{ marginTop: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.65rem', opacity: 0.4 }}>
                <img src="/logo.png" style={{ width: '15px', filter: 'grayscale(1)' }} />
                <span>Verified Non-Custodial Smart Contract</span>
            </div>
        </div>
      </div>
    </div>
  )
}
