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
  const [token, setToken] = useState('STX');
  const [tokenContract, setTokenContract] = useState(process.env.NEXT_PUBLIC_SBTC_CONTRACT || '');

  useEffect(() => {
    const user = getUserData() as any;
    if (user && user.profile) {
      setUserData(user);
      fetchTransactionHistory(user.profile.stxAddress.mainnet);
    }
  }, []);

  const handleConnect = async () => {
    const user = await connectWallet() as any;
    if (user) {
      setUserData(user);
      fetchTransactionHistory(user.profile.stxAddress.mainnet);
    }
  };

  const fetchTransactionHistory = async (address: string) => {
    if (!address) return;
    try {
      const network = getNetwork();
      // Increase limit to 20 to see more history including pending
      const response = await fetch(`${network.coreApiUrl}/extended/v1/address/${address}/transactions?limit=20`);
      const data = await response.json();
      
      const invoices = data.results.filter((tx: any) => 
        tx.tx_type === 'contract_call' && 
        tx.contract_call.contract_id === `${CONTRACT_ADDRESS}.${CONTRACT_NAME}` &&
        tx.contract_call.function_name === 'create-invoice'
      );
      setHistory(invoices);
    } catch (err) { console.error("Fetch history failed:", err); }
  };

  const copyPaymentLink = (tx: any) => {
    const currentTxId = tx.tx_id || tx.txid;
    const baseUrl = window.location.origin;
    const paymentUrl = `${baseUrl}/pay/${currentTxId}`;
    navigator.clipboard.writeText(paymentUrl);
    alert("Payment link copied! Send this to your customer.");
  };

  const createInvoice = async () => {
    if (!amount || loading || !userData) return;
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
          alert(`Invoice Submitted! TXID: ${data.txId}`);
          setLoading(false);
          // Refresh history after a few seconds
          setTimeout(() => fetchTransactionHistory(userData.profile.stxAddress.mainnet), 5000);
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
        <div style={{ marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
          {userData ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>✅ Connected: <strong>{userData.profile.stxAddress.mainnet.slice(0, 8)}...</strong></span>
              <button onClick={() => { disconnectWallet(); setUserData(null); }} style={{ background: 'transparent', border: '1px solid #ff4b4b', color: '#ff4b4b', padding: '6px 12px' }}>Sign Out</button>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <button className="primary" onClick={handleConnect}>Connect Wallet</button>
            </div>
          )}
        </div>

        {/* Create Invoice Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: userData ? 1 : 0.5, pointerEvents: userData ? 'auto' : 'none' }}>
          <h3>Create New Invoice</h3>
          <label style={{ fontSize: '0.8rem' }}>Amount (micro-STX / Sats)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 1000000" />

          <label style={{ fontSize: '0.8rem' }}>Currency</label>
          <select value={token} onChange={e => setToken(e.target.value)}>
            <option value="STX">STX (Stacks)</option>
            <option value="sBTC">sBTC (Bitcoin)</option>
          </select>

          {token === 'sBTC' && (
            <input value={tokenContract} onChange={e => setTokenContract(e.target.value)} placeholder="sBTC Token Contract" />
          )}

          <label style={{ fontSize: '0.8rem' }}>Memo (Internal Reference)</label>
          <input maxLength={34} value={memo} onChange={e => setMemo(e.target.value)} placeholder="Order #123" />

          <button className="primary" onClick={createInvoice} disabled={loading || !userData || !amount} style={{ padding: '16px' }}>
            {loading ? 'Confirming...' : 'Create Invoice'}
          </button>
        </div>
      </div>

      {/* Invoice History Section */}
      <div className="card" style={{ marginTop: 30 }}>
        <h3>Recent Invoice Transactions</h3>
        {history.length === 0 ? <p style={{ color: '#666' }}>No transactions found.</p> : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {history.map((tx: any) => {
              const currentTxId = tx.tx_id || tx.txid;
              const isPending = tx.tx_status === 'pending';
              const isFailed = tx.tx_status.includes('abort') || tx.tx_status === 'failed';
              const isSuccess = tx.tx_status === 'success';

              return (
                <li key={currentTxId} style={{ 
                  padding: '16px', 
                  marginBottom: '12px', 
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isPending ? '#ffc107' : isFailed ? '#ff4b4b' : 'var(--border-color)'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ 
                        color: isPending ? '#ffc107' : isFailed ? '#ff4b4b' : '#28a745', 
                        fontWeight: 'bold',
                        fontSize: '0.8rem'
                      }}>
                        ● {isPending ? 'PENDING CREATION' : isFailed ? 'FAILED/CANCELLED' : 'ACTIVE INVOICE'}
                      </span>
                      <div style={{ fontSize: '0.7rem', color: '#666', marginTop: 4, fontFamily: 'monospace' }}>
                        TX: {currentTxId.slice(0, 20)}...
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {/* Only allow copying if the invoice is live on-chain */}
                      {isSuccess && (
                        <button onClick={() => copyPaymentLink(tx)} style={{ padding: '6px 10px', fontSize: '0.7rem', cursor: 'pointer' }}>
                          Copy Link 🔗
                        </button>
                      )}

                      <a 
                        href={`https://explorer.hiro.so{currentTxId}?chain=mainnet`} 
                        target="_blank" 
                        rel="noreferrer" 
                        style={{ fontSize: '0.75rem', color: 'var(--accent-stx)', alignSelf: 'center', textDecoration: 'none' }}
                      >
                        Details ↗
                      </a>
                    </div>
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
