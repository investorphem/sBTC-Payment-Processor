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
      refreshData(user.profile.stxAddress.mainnet);
    }
  }, []);

  const refreshData = (address: string) => {
    fetchTransactionHistory(address);
    fetchPaidHistory(address);
  };

  const fetchTransactionHistory = async (address: string) => {
    if (!address) return;
    try {
      const network = getNetwork();
      const response = await fetch(`${network.coreApiUrl}/extended/v1/address/${address}/transactions?limit=50`);
      const data = await response.json();
      const invoices = data.results.filter((tx: any) => 
        tx.tx_type === 'contract_call' && 
        tx.contract_call.contract_id === `${CONTRACT_ADDRESS}.${CONTRACT_NAME}` &&
        tx.contract_call.function_name === 'create-invoice' &&
        tx.tx_status !== 'failed'
      );
      setHistory(invoices);
    } catch (err) { console.error(err); }
  };

  const fetchPaidHistory = async (address: string) => {
    if (!address) return;
    try {
      const network = getNetwork();
      const response = await fetch(`${network.coreApiUrl}/extended/v1/address/${address}/transactions?limit=50`);
      const data = await response.json();
      const paid = data.results.filter((tx: any) => 
        tx.tx_type === 'contract_call' && 
        tx.tx_status === 'success' &&
        (tx.contract_call.function_name.includes('pay-invoice'))
      );
      setPaidHistory(paid);
    } catch (err) { console.error(err); }
  };

  // --- 🛠️ DYNAMIC FILTERING LOGIC ---
  // 1. Get all Paid Invoice IDs from the Paid History
  const paidInvoiceIds = paidHistory.map((tx: any) => {
    const idArg = tx.contract_call?.function_args?.find((a: any) => a.name === 'id' || a.name === 'invoice-id');
    return idArg ? idArg.repr.replace('u', '') : null;
  }).filter(Boolean);

  // 2. "Open" = Created invoices that ARE NOT in the paid list
  const openInvoices = history.filter((tx: any) => {
    // We get the ID from the result of the create-invoice call if available, 
    // or we assume the link is still valid by TXID. 
    // For this logic, we check if the payment records contain this specific TXID or ID.
    const isAlreadyPaid = paidHistory.some(paidTx => 
       paidTx.contract_call.function_args.some((arg: any) => arg.repr.includes(tx.tx_id))
    );
    return !isAlreadyPaid;
  });

  // 3. Revenue Totals
  const totals = paidHistory.reduce((acc: any, tx: any) => {
    const amountArg = tx.contract_call?.function_args?.find((a: any) => a.name === 'amount');
    const amountVal = amountArg ? Number(amountArg.repr.replace('u', '')) : 0;
    tx.contract_call.function_name.includes('stx') ? acc.stx += amountVal/1e6 : acc.sbtc += amountVal/1e8;
    return acc;
  }, { stx: 0, sbtc: 0 });

  const copyPaymentLink = (txId: string) => {
    const paymentUrl = `${window.location.origin}/pay/${txId}`;
    navigator.clipboard.writeText(paymentUrl);
    alert("Link copied!");
  };

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
      
      {/* REVENUE HEADER */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div className="card shadow" style={{ textAlign: 'center', borderBottom: '4px solid #fc6432' }}>
          <label style={{ fontSize: '0.6rem', opacity: 0.5 }}>STX REVENUE</label>
          <h2 style={{ margin: '5px 0', color: '#fc6432' }}>{totals.stx.toFixed(2)}</h2>
        </div>
        <div className="card shadow" style={{ textAlign: 'center', borderBottom: '4px solid #f7931a' }}>
          <label style={{ fontSize: '0.6rem', opacity: 0.5 }}>sBTC REVENUE</label>
          <h2 style={{ margin: '5px 0', color: '#f7931a' }}>{totals.sbtc.toFixed(8)}</h2>
        </div>
      </div>

      {/* CREATE FORM */}
      <div className="card shadow">
        <h3>Create Invoice</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" />
          <div style={{ display: 'flex', gap: '10px' }}>
            <select value={token} onChange={e => setToken(e.target.value)} style={{ flex: 1 }}>
              <option value="sBTC">sBTC</option>
              <option value="STX">STX</option>
            </select>
            <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="Memo" style={{ flex: 2 }} />
          </div>
          <button className="primary" onClick={createInvoice} disabled={loading || !amount}>
            {loading ? 'Processing...' : 'Generate Link'}
          </button>
        </div>
      </div>

      {/* --- 📋 SECTION: OPEN INVOICES (UNPAID) --- */}
      <div className="card shadow" style={{ marginTop: 24, borderLeft: '4px solid #fc6432' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>📋 Open Invoices</h3>
          <button onClick={() => refreshData(userData.profile.stxAddress.mainnet)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>🔄</button>
        </div>
        {openInvoices.length === 0 ? <p style={{ opacity: 0.5, fontSize: '0.8rem', marginTop: 10 }}>No unpaid invoices.</p> : (
          openInvoices.map((tx: any) => (
            <div key={tx.tx_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.8rem' }}>Invoice {tx.tx_id.slice(-6)}</span>
              <button className="secondary" onClick={() => copyPaymentLink(tx.tx_id)} style={{ padding: '4px 10px', fontSize: '0.7rem' }}>Copy Link</button>
            </div>
          ))
        )}
      </div>

      {/* --- 💰 SECTION: CLOSED INVOICES (PAID) --- */}
      <div className="card shadow" style={{ marginTop: 24, borderLeft: '4px solid #28a745' }}>
        <h3 style={{ margin: 0, color: '#28a745' }}>✅ Closed Invoices</h3>
        {paidHistory.length === 0 ? <p style={{ opacity: 0.5, fontSize: '0.8rem', marginTop: 10 }}>No paid invoices.</p> : (
          paidHistory.map((tx: any) => (
            <div key={tx.tx_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#28a745', fontWeight: 'bold' }}>PAID</div>
                <div style={{ fontSize: '0.6rem', opacity: 0.4 }}>{tx.tx_id.slice(0, 15)}...</div>
              </div>
              <a href={`https://explorer.hiro.so/txid/${tx.tx_id}?chain=mainnet`} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', color: '#5546ff' }}>Receipt ↗</a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
