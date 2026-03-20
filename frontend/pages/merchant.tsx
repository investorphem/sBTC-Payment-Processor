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
  const [tokenContract, setTokenContract] = useState(process.env.NEXT_PUBLIC_SBTC_CONTRACT || '');

  useEffect(() => {
    const user = getUserData() as any;
    if (user && user.profile) {
      setUserData(user);
      const address = user.profile.stxAddress.mainnet;
      fetchTransactionHistory(address);
      fetchPaidHistory(address);
    }
  }, []);

  const handleConnect = async () => {
    try {
      const user = await connectWallet() as any;
      if (user) {
        setUserData(user);
        const address = user.profile.stxAddress.mainnet;
        fetchTransactionHistory(address);
        fetchPaidHistory(address);
      }
    } catch (err) {
      console.error("Connection failed", err);
    }
  };

  // Fetches invoices YOU created (The "Open" list)
  const fetchTransactionHistory = async (address: string) => {
    if (!address) return;
    try {
      const network = getNetwork();
      const response = await fetch(`${network.coreApiUrl}/extended/v1/address/${address}/transactions?limit=20`);
      const data = await response.json();

      const invoices = data.results.filter((tx: any) => 
        tx.tx_type === 'contract_call' && 
        tx.contract_call.contract_id === `${CONTRACT_ADDRESS}.${CONTRACT_NAME}` &&
        tx.contract_call.function_name === 'create-invoice' &&
        tx.tx_status !== 'failed'
      );
      setHistory(invoices);
    } catch (err) { console.error("Failed to fetch history:", err); }
  };

  // Fetches payments RECEIVED by the contract (The "Paid" list)
  const fetchPaidHistory = async (address: string) => {
    if (!address) return;
    try {
      const network = getNetwork();
      const response = await fetch(`${network.coreApiUrl}/extended/v1/address/${address}/transactions?limit=30`);
      const data = await response.json();

      const paid = data.results.filter((tx: any) => 
        tx.tx_type === 'contract_call' && 
        tx.tx_status === 'success' &&
        (tx.contract_call.function_name === 'pay-invoice-stx' || tx.contract_call.function_name === 'pay-invoice-ft')
      );
      setPaidHistory(paid);
    } catch (err) { console.error("Failed to fetch paid history:", err); }
  };

  // --- 💰 REVENUE CALCULATION ---
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

  const copyPaymentLink = (txId: string) => {
    if (typeof window !== 'undefined') {
      const baseUrl = window.location.origin;
      const paymentUrl = `${baseUrl}/pay/${txId}`;
      navigator.clipboard.writeText(paymentUrl);
      alert("Payment link copied!");
    }
  };

  const createInvoice = async () => {
    if (!amount || isNaN(Number(amount)) || loading || !userData) return;
    setLoading(true);
    try {
      const amt = BigInt(amount);
      const args = buildCreateInvoiceArgs(amt, token, token === 'sBTC' ? tokenContract.trim() : undefined, memo.trim());

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
          setTimeout(() => fetchTransactionHistory(userData.profile.stxAddress.mainnet), 2000);
        },
        onCancel: () => setLoading(false)
      });
    } catch (error) {
      console.error("Creation failed:", error);
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
      
      {/* --- 🏦 REVENUE SUMMARY --- */}
      {userData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div className="card shadow" style={{ textAlign: 'center', padding: '16px', borderBottom: '4px solid #fc6432' }}>
            <label style={{ fontSize: '0.65rem', opacity: 0.6, letterSpacing: '1px' }}>REVENUE STX</label>
            <h2 style={{ margin: '8px 0 0 0', color: '#fc6432' }}>{totals.stx.toLocaleString()}</h2>
          </div>
          <div className="card shadow" style={{ textAlign: 'center', padding: '16px', borderBottom: '4px solid #f7931a' }}>
            <label style={{ fontSize: '0.65rem', opacity: 0.6, letterSpacing: '1px' }}>REVENUE sBTC</label>
            <h2 style={{ margin: '8px 0 0 0', color: '#f7931a' }}>{totals.sbtc.toFixed(8)}</h2>
          </div>
        </div>
      )}

      {/* --- CREATE INVOICE CARD --- */}
      <div className="card shadow">
        <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>Merchant Portal</h2>
        
        <div style={{ marginBottom: 24, padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
          {userData ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem' }}>🟢 <strong>{userData.profile.stxAddress.mainnet.slice(0, 12)}...</strong></span>
              <button className="secondary" onClick={() => { disconnectWallet(); setUserData(null); }} style={{ padding: '6px 12px', fontSize: '0.7rem' }}>Sign Out</button>
            </div>
          ) : (
            <button className="primary" onClick={handleConnect} style={{ width: '100%' }}>Connect Wallet</button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', opacity: userData ? 1 : 0.4, pointerEvents: userData ? 'auto' : 'none' }}>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (Sats/uSTX)" />
          <div style={{ display: 'flex', gap: '10px' }}>
            <select value={token} onChange={e => setToken(e.target.value)} style={{ flex: 1 }}>
              <option value="sBTC">sBTC</option>
              <option value="STX">STX</option>
            </select>
            <input maxLength={34} value={memo} onChange={e => setMemo(e.target.value)} placeholder="Memo" style={{ flex: 2 }} />
          </div>
          <button className="primary" onClick={createInvoice} disabled={loading || !userData || !amount}>
            {loading ? 'Check Wallet...' : 'Generate Payment Link'}
          </button>
        </div>
      </div>

      {/* --- 📋 OPEN INVOICES (CREATED) --- */}
      <div className="card shadow" style={{ marginTop: 24, borderLeft: '4px solid #fc6432' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>📋 Open Invoices</h3>
        {history.length === 0 ? <p style={{ opacity: 0.5, fontSize: '0.8rem' }}>No open invoices.</p> : (
          history.map((tx: any) => (
            <div key={tx.tx_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>ID: {tx.tx_id.slice(-6)}</span>
              <button className="secondary" onClick={() => copyPaymentLink(tx.tx_id)} style={{ padding: '4px 10px', fontSize: '0.7rem' }}>Copy Link 🔗</button>
            </div>
          ))
        )}
      </div>

      {/* --- 💰 PAID INVOICES (REVENUE) --- */}
      <div className="card shadow" style={{ marginTop: 24, borderLeft: '4px solid #28a745' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: '#28a745' }}>💰 Paid History</h3>
        {paidHistory.length === 0 ? <p style={{ opacity: 0.5, fontSize: '0.8rem' }}>No payments received.</p> : (
          paidHistory.map((tx: any) => (
            <div key={tx.tx_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#28a745', fontWeight: 'bold' }}>SUCCESSFUL PAYMENT</div>
                <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>{tx.tx_id.slice(0, 20)}...</div>
              </div>
              <a href={`https://explorer.hiro.so/txid/${tx.tx_id}?chain=mainnet`} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', color: '#5546ff' }}>Explorer ↗</a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
