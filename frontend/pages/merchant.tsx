import { useState, useEffect } from 'react';
import { connectWallet, callCreateInvoice, disconnectWallet, getUserData } from '../lib/wallet';
import { getNetwork } from '../lib/network';
import { CONTRACT_ADDRESS, CONTRACT_NAME, buildCreateInvoiceArgs } from '../lib/contract';

export default function Merchant() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [paidHistory, setPaidHistory] = useState([]);
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [token, setToken] = useState('sBTC');
  
  // Fallback to official sBTC Mainnet contract if env is missing
  const SBTC_MAINNET = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
  const [tokenContract, setTokenContract] = useState(process.env.NEXT_PUBLIC_SBTC_CONTRACT || SBTC_MAINNET);

  useEffect(() => {
    const user = getUserData() as any;
    if (user && user.profile) {
      setUserData(user);
      refreshData(user.profile.stxAddress.mainnet);
    }
  }, []);

  const refreshData = (address: string) => {
    fetchTransactionHistory(address);
    fetchPaidHistory(address);
  };

  const handleConnect = async () => {
    try {
      const user = await connectWallet() as any;
      if (user) {
        setUserData(user);
        refreshData(user.profile.stxAddress.mainnet);
      }
    } catch (err) { console.error("Connection failed", err); }
  };

  const fetchTransactionHistory = async (address: string) => {
    if (!address) return;
    try {
      const network = getNetwork();
      const response = await fetch(`${network.coreApiUrl}/extended/v1/address/${address}/transactions?limit=50&unanchored=true`);
      const data = await response.json();
      const invoices = data.results.filter((tx: any) => 
        tx.tx_type === 'contract_call' && 
        tx.contract_call.contract_id === `${CONTRACT_ADDRESS}.${CONTRACT_NAME}` &&
        tx.contract_call.function_name === 'create-invoice' &&
        tx.tx_status !== 'failed'
      );
      setHistory(invoices);
    } catch (err) { console.error("History fetch error:", err); }
  };

  const fetchPaidHistory = async (address: string) => {
    if (!address) return;
    try {
      const network = getNetwork();
      const response = await fetch(`${network.coreApiUrl}/extended/v1/address/${address}/transactions?limit=50&unanchored=true`);
      const data = await response.json();
      const paid = data.results.filter((tx: any) => 
        tx.tx_type === 'contract_call' && 
        tx.tx_status === 'success' &&
        tx.contract_call.function_name.includes('pay-invoice')
      );
      setPaidHistory(paid);
    } catch (err) { console.error("Paid history fetch error:", err); }
  };

  const openInvoices = history.filter((tx: any) => {
    const isAlreadyPaid = paidHistory.some(paidTx => 
       paidTx.contract_call.function_args?.some((arg: any) => arg.repr.includes(tx.tx_id))
    );
    return !isAlreadyPaid;
  });

  const totals = paidHistory.reduce((acc: any, tx: any) => {
    const amountArg = tx.contract_call?.function_args?.find((a: any) => a.name === 'amount');
    const amountVal = amountArg ? Number(amountArg.repr.replace('u', '')) : 0;
    if (tx.contract_call.function_name.includes('stx')) {
        acc.stx += amountVal / 1000000;
    } else {
        acc.sbtc += amountVal / 100000000;
    }
    return acc;
  }, { stx: 0, sbtc: 0 });

  const createInvoice = async () => {
    if (!amount || isNaN(Number(amount)) || loading || !userData) return;
    
    // Safety check: Ensure sBTC has a contract address
    const finalTokenContract = token === 'sBTC' ? (tokenContract || SBTC_MAINNET).trim() : undefined;
    
    setLoading(true);
    try {
      const amt = BigInt(amount);
      const args = buildCreateInvoiceArgs(amt, token, finalTokenContract, memo.trim());
      
      await callCreateInvoice({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'create-invoice',
        functionArgs: args,
        network: getNetwork(),
        onFinish: () => {
          setLoading(false);
          setAmount('');
          setMemo('');
          setTimeout(() => refreshData(userData.profile.stxAddress.mainnet), 3000);
        },
        onCancel: () => setLoading(false)
      });
    } catch (error) {
      console.error("Creation failed:", error);
      setLoading(false);
      alert("Failed to trigger wallet. Please ensure your sBTC contract address is valid.");
    }
  };

  const copyPaymentLink = (txId: string) => {
    const paymentUrl = `${window.location.origin}/pay/${txId}`;
    navigator.clipboard.writeText(paymentUrl);
    alert("Payment link copied!");
  };

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
      
      {/* REVENUE SECTION */}
      {userData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div className="card shadow" style={{ textAlign: 'center', borderBottom: '4px solid #fc6432', padding: '15px' }}>
            <label style={{ fontSize: '0.6rem', opacity: 0.5, textTransform: 'uppercase' }}>STX Revenue</label>
            <h2 style={{ margin: '5px 0', color: '#fc6432' }}>{totals.stx.toFixed(2)}</h2>
          </div>
          <div className="card shadow" style={{ textAlign: 'center', borderBottom: '4px solid #f7931a', padding: '15px' }}>
            <label style={{ fontSize: '0.6rem', opacity: 0.5, textTransform: 'uppercase' }}>sBTC Revenue</label>
            <h2 style={{ margin: '5px 0', color: '#f7931a' }}>{totals.sbtc.toFixed(8)}</h2>
          </div>
        </div>
      )}

      {/* CREATE INVOICE SECTION */}
      <div className="card shadow" style={{ padding: '24px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>⚡ sBTC Merchant</h2>

        <div style={{ marginBottom: 20 }}>
          {!userData ? (
            <button className="primary" onClick={handleConnect} style={{ width: '100%' }}>Connect Wallet</button>
          ) : (
            <div style={{ textAlign: 'center', fontSize: '0.8rem', opacity: 0.6 }}>
              Connected: {userData.profile.stxAddress.mainnet.slice(0, 6)}...{userData.profile.stxAddress.mainnet.slice(-4)}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', opacity: userData ? 1 : 0.4, pointerEvents: userData ? 'auto' : 'none' }}>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (Sats or uSTX)" />
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <select value={token} onChange={e => setToken(e.target.value)} style={{ flex: 1 }}>
              <option value="sBTC">sBTC</option>
              <option value="STX">STX</option>
            </select>
            <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="Memo/Order ID" style={{ flex: 2 }} />
          </div>

          <button className="primary" onClick={createInvoice} disabled={loading || !userData || !amount}>
            {loading ? 'Confirming...' : 'Create Payment Link'}
          </button>
        </div>
      </div>

      {/* OPEN INVOICES */}
      <div className="card shadow" style={{ marginTop: 24, borderLeft: '4px solid #fc6432', padding: '20px' }}>
        <h3 style={{ margin: '0 0 15px 0' }}>📋 Open Invoices</h3>
        {openInvoices.length === 0 ? <p style={{ opacity: 0.5, fontSize: '0.8rem' }}>No active invoices.</p> : (
          openInvoices.map((tx: any) => (
            <div key={tx.tx_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>ID: {tx.tx_id.slice(-6)}</span>
              <button className="secondary" onClick={() => copyPaymentLink(tx.tx_id)} style={{ fontSize: '0.7rem', padding: '5px 10px' }}>Copy Link 🔗</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
