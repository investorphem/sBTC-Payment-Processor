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
      // We fetch both confirmed AND mempool transactions so the UI updates instantly
      const response = await fetch(`${network.coreApiUrl}/extended/v1/address/${address}/transactions?limit=20`);
      const data = await response.json();

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

  const copyPaymentLink = (txId: string) => {
    if (typeof window !== 'undefined') {
      const baseUrl = window.location.origin;
      // We use the TXID as the reference for the pay page
      const paymentUrl = `${baseUrl}/pay/${txId}`;
      navigator.clipboard.writeText(paymentUrl);
      alert("Payment link copied! Share this with your customer.");
    }
  };

  const createInvoice = async () => {
    if (!amount || isNaN(Number(amount)) || loading || !userData) return;

    setLoading(true);
    try {
      // Ensure we are sending a clean BigInt string
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
          setLoading(false);
          setAmount('');
          setMemo('');
          // Refresh history immediately to show the "Pending" tx
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
      <div className="card shadow">
        <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>Merchant Portal</h2>

        {/* Wallet Section */}
        <div style={{ marginBottom: 24, padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
          {userData ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem' }}>🟢 <strong>{userData.profile.stxAddress.mainnet.slice(0, 6)}...{userData.profile.stxAddress.mainnet.slice(-4)}</strong></span>
              <button className="secondary" onClick={() => { disconnectWallet(); setUserData(null); }} style={{ padding: '6px 12px', fontSize: '0.7rem' }}>Disconnect</button>
            </div>
          ) : (
            <button className="primary" onClick={handleConnect} style={{ width: '100%' }}>Connect Wallet to Start</button>
          )}
        </div>

        {/* Form Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', opacity: userData ? 1 : 0.4, pointerEvents: userData ? 'auto' : 'none' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '6px', opacity: 0.8 }}>AMOUNT ({token === 'STX' ? 'micro-STX' : 'Sats'})</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 5000000" style={{ width: '100%' }} />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '6px', opacity: 0.8 }}>CURRENCY</label>
              <select value={token} onChange={e => setToken(e.target.value)} style={{ width: '100%' }}>
                <option value="sBTC">sBTC</option>
                <option value="STX">STX</option>
              </select>
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '6px', opacity: 0.8 }}>MEMO</label>
              <input maxLength={34} value={memo} onChange={e => setMemo(e.target.value)} placeholder="Order #123" style={{ width: '100%' }} />
            </div>
          </div>

          <button className="primary" onClick={createInvoice} disabled={loading || !userData || !amount} style={{ marginTop: '8px' }}>
            {loading ? 'Processing...' : 'Create Payment Link'}
          </button>
        </div>
      </div>

      {/* History List */}
      <div className="card shadow" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Recent Invoices</h3>
        {history.length === 0 ? (
          <p style={{ textAlign: 'center', opacity: 0.5, padding: '20px' }}>No invoices found for this address.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {history.map((tx: any) => {
              const currentTxId = tx.tx_id;
              const isPending = tx.tx_status === 'pending';
              const isSuccess = tx.tx_status === 'success';

              return (
                <div key={currentTxId} style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ 
                        fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold',
                        background: isSuccess ? 'rgba(40, 167, 69, 0.1)' : 'rgba(255, 193, 7, 0.1)',
                        color: isSuccess ? '#28a745' : '#ffc107',
                        display: 'inline-block', marginBottom: '8px'
                      }}>
                        {tx.tx_status.toUpperCase()}
                      </span>
                      <div style={{ fontSize: '0.75rem', opacity: 0.5, fontFamily: 'monospace' }}>
                        ID: {currentTxId.slice(0, 12)}...
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="secondary" onClick={() => copyPaymentLink(currentTxId)} style={{ padding: '4px 10px', fontSize: '0.7rem' }}>Copy 🔗</button>
                      <a href={`https://explorer.hiro.so/txid/${currentTxId}?chain=mainnet`} target="_blank" rel="noreferrer" className="button-link" style={{ fontSize: '0.7rem' }}>View ↗</a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
