import { useState, useEffect } from 'react';
import { connectWallet, callCreateInvoice, disconnectWallet, getUserData } from '../lib/wallet';
import { getNetwork } from '../lib/network';
import { CONTRACT_ADDRESS, CONTRACT_NAME, buildCreateInvoiceArgs } from '../lib/contract';

export default function Merchant() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [token, setToken] = useState('sBTC');
  // Fallback to empty string if env is undefined
  const [tokenContract, setTokenContract] = useState(process.env.NEXT_PUBLIC_SBTC_CONTRACT || '');

  useEffect(() => {
    const user = getUserData() as any;
    if (user && user.profile) {
      setUserData(user);
      fetchTransactionHistory(user.profile.stxAddress.mainnet);
    }
  }, []);

  const handleConnect = async () => {
    try {
      const user = await connectWallet() as any;
      if (user) {
        setUserData(user);
        fetchTransactionHistory(user.profile.stxAddress.mainnet);
      }
    } catch (err) {
      console.error("Connection failed", err);
    }
  };

  const fetchTransactionHistory = async (address: string) => {
    if (!address) return;
    try {
      const network = getNetwork();
      const response = await fetch(`${network.coreApiUrl}/extended/v1/address/${address}/transactions?limit=10`);
      const data = await response.json();
      
      // Filter for contract calls specifically matching your invoice contract
      const invoices = data.results.filter((tx: any) => 
        tx.tx_type === 'contract_call' && 
        tx.contract_call.contract_id === `${CONTRACT_ADDRESS}.${CONTRACT_NAME}` &&
        tx.contract_call.function_name === 'create-invoice'
      );
      setHistory(invoices);
    } catch (err) { 
      console.error("Failed to fetch history:", err); 
    }
  };

  const copyPaymentLink = (tx: any) => {
    const currentTxId = tx.tx_id || tx.txid;
    if (typeof window !== 'undefined') {
      const baseUrl = window.location.origin;
      const paymentUrl = `${baseUrl}/pay/${currentTxId}`;
      navigator.clipboard.writeText(paymentUrl);
      alert("Payment link copied!");
    }
  };

  const createInvoice = async () => {
    // Basic validation
    if (!amount || isNaN(Number(amount)) || loading || !userData) return;
    
    setLoading(true);
    try {
      const amt = BigInt(amount);

      const args = buildCreateInvoiceArgs(
        amt, 
        token, 
        token === 'sBTC' ? tokenContract.trim() : undefined, 
        memo.trim()
      );

      await callCreateInvoice({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'create-invoice',
        functionArgs: args,
        network: getNetwork(),
        onFinish: (data: any) => {
          alert(`Invoice Created! TXID: ${data.txId}`);
          setLoading(false);
          // Delay refresh to give the node time to index the mempool transaction
          setTimeout(() => fetchTransactionHistory(userData.profile.stxAddress.mainnet), 4000);
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
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Merchant Dashboard</h2>
        
        {/* Wallet Connection Section */}
        <div style={{ marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid #ccc' }}>
          {userData ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>✅ Connected: <strong>{userData.profile.stxAddress.mainnet.slice(0, 8)}...</strong></span>
              <button onClick={() => { disconnectWallet(); setUserData(null); }} style={{ background: 'transparent', border: '1px solid #ff4b4b', color: '#ff4b4b', padding: '6px 12px', cursor: 'pointer' }}>Sign Out</button>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <button className="primary" onClick={handleConnect}>Connect Wallet</button>
            </div>
          )}
        </div>

        {/* Invoice Creation Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: userData ? 1 : 0.5, pointerEvents: userData ? 'auto' : 'none' }}>
          <h3>Create New Invoice</h3>
          
          <label style={{ fontSize: '0.8rem' }}>Amount ({token === 'STX' ? 'micro-STX' : 'Sats'})</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 1000000" />

          <label style={{ fontSize: '0.8rem' }}>Currency</label>
          <select value={token} onChange={e => setToken(e.target.value)}>
            <option value="sBTC">sBTC (Bitcoin)</option>
            <option value="STX">STX (Stacks)</option>
          </select>

          {token === 'sBTC' && (
            <input 
              value={tokenContract} 
              onChange={e => setTokenContract(e.target.value)} 
              placeholder="sBTC Token Contract Principal" 
            />
          )}

          <label style={{ fontSize: '0.8rem' }}>Memo (Optional)</label>
          <input maxLength={34} value={memo} onChange={e => setMemo(e.target.value)} placeholder="Reference Info" />

          <button className="primary" onClick={createInvoice} disabled={loading || !userData || !amount}>
            {loading ? 'Confirm in Wallet...' : 'Create Invoice'}
          </button>
        </div>
      </div>

      {/* History Section */}
      <div className="card" style={{ marginTop: 30 }}>
        <h3>Recent Invoices</h3>
        {history.length === 0 ? <p>No transactions found.</p> : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {history.map((tx: any) => {
              const currentTxId = tx.tx_id || tx.txid;
              return (
                <li key={currentTxId} style={{ padding: '16px 0', borderBottom: '1px solid #eee' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: tx.tx_status === 'success' ? '#28a745' : '#ffc107', fontWeight: 'bold' }}>
                      ● {tx.tx_status.toUpperCase()}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => copyPaymentLink(tx)} style={{ padding: '4px 8px', fontSize: '0.7rem' }}>Copy Link 🔗</button>

                      {/* FIXED: Added missing / and fixed the curly brace syntax */}
                      <a 
                        href={`https://explorer.hiro.so/txid/${currentTxId}?chain=mainnet`} 
                        target="_blank" 
                        rel="noreferrer" 
                        style={{ fontSize: '0.85em', color: '#5546ff', textDecoration: 'none' }}
                      >
                        Explorer ↗
                      </a>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 8, fontFamily: 'monospace' }}>
                    ID: {currentTxId.slice(0, 30)}...
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
