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
      const response = await fetch(`${network.coreApiUrl}/extended/v1/address/${address}/transactions?limit=10`);
      const data = await response.json();
      const invoices = data.results.filter((tx: any) => 
        tx.tx_type === 'contract_call' && 
        tx.contract_call.contract_id === `${CONTRACT_ADDRESS}.${CONTRACT_NAME}` &&
        tx.contract_call.function_name === 'create-invoice'
      );
      setHistory(invoices);
    } catch (err) { console.error(err); }
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

    const cleanTokenContract = tokenContract.trim();
    const cleanMemo = memo.trim();

    if (token === 'sBTC' && (!cleanTokenContract || !cleanTokenContract.includes('.'))) {
      alert("Error: Please enter a valid sBTC contract (e.g. Principal.contract-name)");
      return;
    }

    setLoading(true);

    try {
      const amt = BigInt(amount); 
      const args = buildCreateInvoiceArgs(amt, token, token === 'sBTC' ? cleanTokenContract : undefined, cleanMemo);

      await callCreateInvoice({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'create-invoice',
        functionArgs: args,
        network: getNetwork(),
        onFinish: (data: any) => {
          alert(`Transaction submitted! TXID: ${data.txId}`);
          setLoading(false);
          setTimeout(() => fetchTransactionHistory(userData.profile.stxAddress.mainnet), 4000);
        },
        onCancel: () => {
          setLoading(false);
        }
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

        <div style={{ marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
          {userData ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>✅ Connected: <strong>{userData.profile.stxAddress.mainnet.slice(0, 8)}...</strong></span>
              <button 
                onClick={() => { disconnectWallet(); setUserData(null); }}
                style={{ background: 'transparent', border: '1px solid #ff4b4b', color: '#ff4b4b', padding: '6px 12px' }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)' }}>Connect your wallet to create on-chain invoices.</p>
              <button className="primary" onClick={handleConnect}>Connect Wallet</button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: userData ? 1 : 0.5, pointerEvents: userData ? 'auto' : 'none' }}>
          <h3>Create New Invoice</h3>

          <label>Amount (Smallest Units)</label>
          <input 
            type="number" 
            value={amount} 
            onChange={e => setAmount(e.target.value)} 
            placeholder="e.g. 1000000 (1 STX)" 
          />

          <label>Token Selection</label>
          <select value={token} onChange={e => setToken(e.target.value)}>
            <option value="sBTC">sBTC (Bitcoin)</option>
            <option value="STX">STX (Stacks)</option>
          </select>

          {token === 'sBTC' && (
            <>
              <label>sBTC Token Contract Address</label>
              <input 
                value={tokenContract} 
                onChange={e => setTokenContract(e.target.value)} 
                placeholder="Principal.contract-name" 
              />
            </>
          )}

          <label>Memo / Reference (Max 34 chars)</label>
          <input 
            maxLength={34} 
            value={memo} 
            onChange={e => setMemo(e.target.value)} 
            placeholder="Order #001" 
          />

          <button 
            className="primary" 
            onClick={createInvoice} 
            disabled={loading || !userData || !amount}
            style={{ padding: '16px', fontSize: '1rem' }}
          >
            {loading ? 'Check your wallet...' : 'Create Invoice'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 30 }}>
        <h3>Recent Invoices</h3>
        {!userData ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>Please connect wallet to view history.</p>
        ) : history.length === 0 ? (
          <p style={{ color: '#666' }}>No transactions found for this account.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {history.map((tx: any) => {
              const currentTxId = tx.tx_id || tx.txid;

              return (
                <li key={currentTxId} style={{ padding: '16px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ 
                      color: tx.tx_status === 'success' ? '#28a745' : '#ffc107',
                      fontWeight: 'bold',
                      fontSize: '0.9rem'
                    }}>
                      ● {tx.tx_status.toUpperCase()}
                    </span>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => copyPaymentLink(tx)}
                        style={{ padding: '4px 8px', fontSize: '0.7rem', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Copy Link 🔗
                      </button>

                      {/* ✅ Corrected Explorer Link Syntax */}
                      <a 
                        href={`https://explorer.hiro.so{currentTxId}?chain=mainnet`} 
                        target="_blank" 
                        rel="noreferrer" 
                        style={{ fontSize: '0.85em', color: 'var(--accent-stx)', textDecoration: 'none', alignSelf: 'center' }}
                      >
                        Explorer ↗
                      </a>
                    </div>
                  </div>
                  
                  {/* ✅ Corrected ID display variable */}
                  <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 8, fontFamily: 'monospace' }}>
                    ID: {currentTxId ? `${currentTxId.slice(0, 30)}...` : 'Processing...'}
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

