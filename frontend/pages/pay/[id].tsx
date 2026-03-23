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

  // --- 🛠️ HELPER FUNCTIONS ---
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

  // --- 🔍 DATA EXTRACTION (Fixes Scope Error) ---
  const data = invoice?.value ? invoice.value : invoice;
  const rawToken = data ? decodeClarityValue(data.token) : "";
  const isSTX = data ? (rawToken.toUpperCase().includes("STX") || data.token === "0x535458") : true;
  const amountNumber = data ? extractAmount(data.amount) : 0;
  const displayAmount = isSTX ? (amountNumber / 1e6).toFixed(2) : (amountNumber / 1e8).toFixed(8);
  const memoDisplay = data ? decodeClarityValue(data.memo) : "";

  useEffect(() => {
    const user = getUserData()
    if (user) setUserData(user)
  }, [])

  useEffect(() => {
    if (!id || !router.isReady) return;
    const fetchInvoiceFromChain = async () => {
      try {
        setLoading(true);
        const finalId = Number(id);
        if (!isNaN(finalId)) {
          setInvoiceId(finalId);
          const dataFromChain = await readInvoice(finalId);
          if (dataFromChain) setInvoice(dataFromChain);
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchInvoiceFromChain();
  }, [id, router.isReady]);

  const handleConnect = async () => {
    try {
      const user = await connectWallet() as any
      if (user) setUserData(user)
    } catch (err) { console.error("Connection failed", err) }
  }

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
            createAssetInfo(cAddr, cName, 'sbtc-token')
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
              contractPrincipalCV(SBTC_CONTRACT.split('.')[0], SBTC_CONTRACT.split('.')[1]), 
              uintCV(amountBigInt)
            ],
        network,
        postConditions,
        postConditionMode: PostConditionMode.Deny,
        appDetails,
        onFinish: (txData: any) => {
          setReceiptTxId(txData.txId);
          setPaymentStatus('pending');
        },
      });
    } catch (err) { console.error("Payment error:", err); }
  }

  if (loading) return <div className="container" style={{textAlign: 'center', padding: '100px'}}>Loading Invoice...</div>;

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '450px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <img src="/logo.png" alt="Logo" style={{ width: '50px' }} />
      </div>

      <div className="card shadow" style={{ textAlign: 'center', borderRadius: '24px', position: 'relative', overflow: 'hidden', padding: '0', border: '1px solid rgba(85, 70, 255, 0.2)' }}>
        <div style={{ 
          background: !isSTX ? 'linear-gradient(135deg, #f7931a 0%, #ffab40 100%)' : 'linear-gradient(135deg, #5546ff 0%, #7c71ff 100%)',
          padding: '40px 20px', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'
        }}>
          <div style={{ 
            width: '64px', height: '64px', borderRadius: '18px', background: 'rgba(255,255,255,0.2)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
            backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.3)'
          }}>
            {!isSTX ? '₿' : '⚡'}
          </div>
          <h2 style={{ margin: '4px 0 0 0', fontSize: '1.6rem', fontWeight: '800' }}>
            {paymentStatus === 'already_paid' ? 'Payment Completed' : `Pay Merchant`}
          </h2>
        </div>

        <div style={{ padding: '30px' }}>
            <p style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '20px' }}>Invoice Reference: #{invoiceId}</p>
            <div style={{ padding: '24px', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '24px' }}>
              <label style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 'bold' }}>TOTAL TO PAY</label>
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
              </div>
            ) : !userData ? (
              <button className="primary" onClick={handleConnect} style={{ width: '100%', padding: '18px', background: 'linear-gradient(to right, #F7931A, #5546FF)', border: 'none', borderRadius: '12px', color: 'white' }}>Connect Wallet to Pay</button>
            ) : (
              <button className="primary" onClick={executePayment} style={{ width: '100%', padding: '18px', fontSize: '1.1rem', fontWeight: 'bold', background: !isSTX ? '#f7931a' : '#5546ff', border: 'none', borderRadius: '12px', color: 'white' }}>
                Confirm Payment
              </button>
            )}
        </div>
      </div>
    </div>
  )
}
