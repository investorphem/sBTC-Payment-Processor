import { useState, useEffect } from 'react';
import { connectWallet, callCreateInvoice, disconnectWallet, getUserData } from '../lib/wallet';
import { getNetwork } from '../lib/network';
import { CONTRACT_ADDRESS, CONTRACT_NAME, buildCreateInvoiceArgs, readInvoice } from '../lib/contract';
import { cvToJSON } from '@stacks/transactions';

export default function Merchant() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
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

  const fetchTransactionHistory = async (address: string) => {
    if (!address) return;
    try {
      const network = getNetwork();
      const response = await fetch(`${network.coreApiUrl}/extended/v1/address/${address}/transactions?limit=20`);
      const data = await response.json();
      
      const creationTxs = data.results.filter((tx: any) => 
        tx.tx_type === 'contract_call' && 
        tx.contract_call.contract_id === `${CONTRACT_ADDRESS}.${CONTRACT_NAME}` &&
        tx.contract_call.function_name === 'create-invoice'
      );

      // Map the history and attempt to find the invoice ID from the print events
      const historyWithIds = creationTxs.map((tx: any) => {
        let invoiceId = null;
        if (tx.tx_status === 'success' && tx.events) {
          const log = tx.events.find((e: any) => e.event_type === 'smart_contract_log');
          if (log) {
            try {
               // Extract the ID from the { id: u1 } object in the print event
               invoiceId = cvToJSON(log.contract_log.value).value.id.value;
            } catch (e) { console.error("Event parse error", e); }
          }
        }
        return { ...tx, invoiceId };
      });

      setHistory(historyWithIds);
    } catch (err) { console.error(err); }
  };

  const copyPaymentLink = (tx: any) => {
    const currentTxId = tx.tx_id || tx.txid;
    navigator.clipboard.writeText(`${window.location.origin}/pay/${currentTxId}`);
    alert("Payment link copied!");
  };

  const createInvoice = async () => {
    if (!amount || loading || !userData) return;
    setLoading(true);
    try {
      const args = buildCreateInvoiceArgs(BigInt(amount), token, token === 'sBTC' ? tokenContract.trim() : undefined, memo.trim());
      await callCreateInvoice({
        contractAddress: CONTRACT_ADDRESS, contractName: CONTRACT_NAME, functionName: 'create-invoice',
        functionArgs: args, network: getNetwork(),
        onFinish: (data: any) => {
          alert(`Invoice Submitted!`);
          setLoading(false);
          setTimeout(() => fetchTransactionHistory(userData.profile.stxAddress.mainnet), 5000);
        },
        onCancel: () => setLoading(false)
      });
    } catch (error) { setLoading(false); }
  };

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Merchant Dashboard</h2>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: userData ? 1 : 0.5 }}>
          <h3>Create New Invoice</h3>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (Micro-STX)" />
          <select value={token} onChange={e => setToken(e.target.value)}>
            <option value="STX">STX (Stacks)</option>
            <option value="sBTC">sBTC (Bitcoin)</option>
          </select>
          <input maxLength={34} value={memo} onChange={e => setMemo(e.target.value)} placeholder="Memo" />
          <button className="primary" onClick={createInvoice} disabled={loading || !userData || !amount}>
            {loading ? 'Confirming...' : 'Create Invoice'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 30 }}>
        <h3>Recent Invoices</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {history.map((tx: any) => {
            const currentTxId = tx.tx_id || tx.txid;
            const isPending = tx.tx_status === 'pending';
            const isFailed = tx.tx_status.includes('abort') || tx.tx_status === 'failed';

            return (
              <li key={currentTxId} style={{ 
                padding: '16px', marginBottom: '12px', borderRadius: '8px', 
                background: 'rgba(255,255,255,0.02)', border: `1px solid ${isPending ? '#ffc107' : isFailed ? '#ff4b4b' : 'var(--border-color)'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: isPending ? '#ffc107' : isFailed ? '#ff4b4b' : '#28a745', fontWeight: 'bold', fontSize: '0.8rem' }}>
                      ● {isPending ? 'PENDING CREATION' : isFailed ? 'FAILED' : 'ACTIVE INVOICE'}
                    </span>
                    <div style={{ fontSize: '0.7rem', color: '#666', marginTop: 4, fontFamily: 'monospace' }}>
                      TX: {currentTxId.slice(0, 15)}...
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {!isPending && !isFailed && (
                      <button onClick={() => copyPaymentLink(tx)} style={{ padding: '6px 10px', fontSize: '0.7rem', cursor: 'pointer' }}>
                        Copy Link 🔗
                      </button>
                    )}
                    {/* Fixed Explorer Link */}
                    <a 
                      href={`https://explorer.hiro.so{currentTxId}?chain=mainnet`} 
                      target="_blank" rel="noreferrer" 
                      style={{ fontSize: '0.75rem', color: 'var(--accent-stx)', textDecoration: 'none', alignSelf: 'center' }}
                    >
                      Details ↗
                    </a>
                  </div>
                </div>
                
                {/* Status Help Text */}
                {!isPending && !isFailed && (
                  <div style={{ fontSize: '0.65rem', color: '#888', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                    To see if this has been paid, click "Details" and check the <b>Events</b> tab.
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
