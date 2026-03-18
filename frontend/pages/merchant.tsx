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
    // Cast to 'any' to allow property access on 'profile'
    const user = getUserData() as any;
    if (user && user.profile) {
      setUserData(user);
      fetchTransactionHistory(user.profile.stxAddress.mainnet);
    }
  }, []);

  // --- Actions ---
  const handleConnect = async () => {
    try {
      // Cast the result of connectWallet to 'any' to fix the "unknown" error
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
          alert(`Success! Invoice transaction submitted.`);
          setLoading(false);
          // Refresh history after a short delay
          setTimeout(() => fetchTransactionHistory(userData.profile.stxAddress.mainnet), 3000);
        },
      });
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2>Merchant Dashboard</h2>

      {/* Wallet Connection Section */}
      <div style={{ marginBottom: 24, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
        {userData ? (
          <div>
            <p>✅ Connected: <strong>{userData.profile.stxAddress.mainnet.slice(0, 8)}...</strong></p>
            <button onClick={handleDisconnect}>Disconnect</button>
          </div>
        ) : (
          <div>
            <p style={{ color: '#666' }}>Connect your wallet to manage and create invoices.</p>
            <button onClick={handleConnect} style={{ padding: '8px 16px', cursor: 'pointer' }}>Connect Wallet</button>
          </div>
        )}
      </div>

      {/* Invoice Creation Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: userData ? 1 : 0.5, pointerEvents: userData ? 'auto' : 'none' }}>
        <h3>Create New Invoice</h3>

        <label>Amount (smallest units, e.g. 1,000,000 = 1 STX)</label>
        <input 
          type="number" 
          value={amount} 
          onChange={e => setAmount(e.target.value)} 
          placeholder="e.g. 1000000" 
        />

        <label>Token Type</label>
        <select value={token} onChange={e => setToken(e.target.value)}>
          <option value="sBTC">sBTC</option>
          <option value="STX">STX</option>
        </select>

        {token === 'sBTC' && (
          <>
            <label>sBTC Token Contract</label>
            <input value={tokenContract} onChange={e => setTokenContract(e.target.value)} />
          </>
        )}

        <label>Memo / Description</label>
        <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="Order #123" />

        <button 
          onClick={createInvoice} 
          disabled={!userData || !amount || loading}
          style={{ 
            padding: '12px', 
            backgroundColor: loading ? '#ccc' : '#0070f3', 
            color: 'white', 
            border: 'none', 
            borderRadius: 4, 
            cursor: userData && !loading ? 'pointer' : 'not-allowed',
            fontWeight: 'bold'
          }}
        >
          {loading ? 'Processing...' : 'Create Invoice'}
        </button>
      </div>

      {/* Transaction History Section */}
      <div style={{ marginTop: 40 }}>
        <h3>Recent Invoice Transactions</h3>
        {!userData ? (
          <p style={{ color: '#999', fontStyle: 'italic' }}>Connect wallet to view history.</p>
        ) : history.length === 0 ? (
          <p style={{ color: '#666' }}>No recent invoice transactions found on-chain.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {history.map((tx: any) => (
              <li key={tx.tx_id} style={{ padding: '12px 0', borderBottom: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    <span style={{ 
                      display: 'inline-block', 
                      width: 10, height: 10, 
                      borderRadius: '50%', 
                      backgroundColor: tx.tx_status === 'success' ? '#28a745' : '#ffc107',
                      marginRight: 8
                    }}></span>
                    <strong>{tx.tx_status.toUpperCase()}</strong>
                  </span>
                  <a 
                    href={`https://explorer.hiro.so{tx.tx_id}?chain=mainnet`} 
                    target="_blank" 
                    rel="noreferrer" 
                    style={{ fontSize: '0.85em', color: '#0070f3', textDecoration: 'none' }}
                  >
                    View Explorer ↗
                  </a>
                </div>
                <div style={{ fontSize: '0.85em', color: '#666', marginTop: 4, fontFamily: 'monospace' }}>
                  TX: {tx.tx_id.slice(0, 20)}...
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
