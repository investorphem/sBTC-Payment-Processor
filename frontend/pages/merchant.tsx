import { useState, useEffect } from 'react';
import { connectWallet, callCreateInvoice, disconnectWallet, getUserData } from '../lib/wallet';
import { getNetwork } from '../lib/network';
import { CONTRACT_ADDRESS, CONTRACT_NAME, buildCreateInvoiceArgs } from '../lib/contract';

export default function Merchant() {
  // --- State ---
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  // Form State
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [token, setToken] = useState('sBTC');
  const [tokenContract, setTokenContract] = useState(process.env.NEXT_PUBLIC_SBTC_CONTRACT || '');

  // --- Effects ---
  useEffect(() => {
    const user = getUserData() as any;
    if (user && user.profile) {
      setUserData(user);
      fetchTransactionHistory(user.profile.stxAddress.mainnet);
    }
  }, []);

  // --- Actions ---
  const handleConnect = async () => {
    try {
      const user = await connectWallet() as any;
      if (user && user.profile) {
        setUserData(user);
        fetchTransactionHistory(user.profile.stxAddress.mainnet);
      }
    } catch (err) {
      console.error("Connection failed", err);
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setUserData(null);
    setHistory([]);
  };

  const fetchTransactionHistory = async (address: string) => {
    if (!address) return;
    try {
      const network = getNetwork();
      const response = await fetch(`${network.coreApiUrl}/extended/v1/address/${address}/transactions?limit=10`);
      const data = await response.json();

      const invoices = data.results.filter((tx: any) => 
        tx.tx_type === 'contract_call' && 
        tx.contract_call.contract_id === `${CONTRACT_ADDRESS}.${CONTRACT_NAME}` &&
        tx.contract_call.function_name === 'create-invoice'
      );
      setHistory(invoices);
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  const createInvoice = async () => {
    if (!amount || loading || !userData) return;
    setLoading(true);

    try {
      const amt = BigInt(amount); 
      const args = buildCreateInvoiceArgs(amt, token, token === 'sBTC' ? tokenContract : undefined, memo);

      await callCreateInvoice({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'create-invoice',
        functionArgs: args,
        network: getNetwork(),
        onFinish: (data: any) => {
          alert(`Success! Invoice transaction submitted. TXID: ${data.txId}`);
          setLoading(false);
          setTimeout(() => fetchTransactionHistory(userData.profile.stxAddress.mainnet), 4000);
        },
      });
    } catch (error) {
      console.error("Transaction Error:", error);
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Merchant Dashboard</h2>

        {/* Wallet Connection Section */}
        <div style={{ marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
          {userData ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>✅ Connected: <strong>{userData.profile.stxAddress.mainnet.slice(0, 8)}...</strong></span>
              <button onClick={handleDisconnect} style={{ background: '#ff4b4b', padding: '6px 12px' }}>Sign Out</button>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p>Connect your wallet to manage and create invoices.</p>
              <button className="primary" onClick={handleConnect}>Connect Wallet</button>
            </div>
          )}
        </div>

        {/* Invoice Creation Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: userData ? 1 : 0.5, pointerEvents: userData ? 'auto' : 'none' }}>
          <h3>Create New Invoice</h3>

          <label>Amount (Smallest Units)</label>
          <input 
            type="number" 
            value={amount} 
            onChange={e => setAmount(e.target.value)} 
            placeholder="e.g. 1000000 (1 STX)" 
          />

          <label>Token Type</label>
          <select value={token} onChange={e => setToken(e.target.value)}>
            <option value="sBTC">sBTC (Bitcoin)</option>
            <option value="STX">STX (Stacks)</option>
          </select>

          {token === 'sBTC' && (
            <>
              <label>sBTC Token Contract</label>
              <input value={tokenContract} onChange={e => setTokenContract(e.target.value)} />
            </>
          )}

          <label>Memo / Order ID (Max 34 chars)</label>
          <input maxLength={34} value={memo} onChange={e => setMemo(e.target.value)} placeholder="e.g. Order #123" />

          <button 
            className="primary"
            onClick={createInvoice} 
            disabled={!userData || !amount || loading}
          >
            {loading ? 'Waiting for Wallet...' : 'Create Invoice'}
          </button>
        </div>
      </div>

      {/* Transaction History Section */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3>Recent Invoice History</h3>
        {!userData ? (
          <p style={{ color: '#999' }}>Sign in to view your history.</p>
        ) : history.length === 0 ? (
          <p style={{ color: '#999' }}>No invoices found for this address.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {history.map((tx: any) => (
              <li key={tx.tx_id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    <strong style={{ color: tx.tx_status === 'success' ? '#28a745' : '#ffc107' }}>
                      {tx.tx_status.toUpperCase()}
                    </strong>
                  </span>
                  <a 
                    href={`https://explorer.hiro.so{tx.tx_id}?chain=mainnet`} 
                    target="_blank" 
                    rel="noreferrer" 
                    style={{ fontSize: '0.85em', color: 'var(--accent-stx)' }}
                  >
                    View Explorer ↗
                  </a>
                </div>
                <div style={{ fontSize: '0.8em', color: '#666', marginTop: 4 }}>
                  TX: {tx.tx_id.slice(0, 30)}...
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
