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
      const response = await fetch(`${network.coreApiUrl}/extended/v1/address/${address}/transactions?limit=20`);
      const data = await response.json();
      
      const creationTxs = data.results.filter((tx: any) => 
        tx.tx_type === 'contract_call' && 
        tx.contract_call.contract_id === `${CONTRACT_ADDRESS}.${CONTRACT_NAME}` &&
        tx.contract_call.function_name === 'create-invoice'
      );

      // ✅ Fetch live on-chain status for each invoice
      const detailedHistory = await Promise.all(creationTxs.map(async (tx: any) => {
        let onChainStatus = { paid: false };
        
        // If the creation TX succeeded, we can pull the invoice ID from events
        if (tx.tx_status === 'success') {
          const invoiceIdEvent = tx.events?.find((e: any) => e.event_type === 'smart_contract_log');
          if (invoiceIdEvent) {
            // This assumes your contract prints the ID as the first value in the log
            const id = cvToJSON(invoiceIdEvent.contract_log.value).value.id.value;
            const onChainData = await readInvoice(Number(id));
            if (onChainData) {
              onChainStatus.paid = cvToJSON(onChainData).value.paid.value;
            }
          }
        }
        return { ...tx, onChainPaid: onChainStatus.paid };
      }));

      setHistory(detailedHistory);
    } catch (err) { console.error("History error:", err); }
  };

  const copyPaymentLink = (tx: any) => {
    const currentTxId = tx.tx_id || tx.txid;
    const paymentUrl = `${window.location.origin}/pay/${currentTxId}`;
    navigator.clipboard.writeText(paymentUrl);
    alert("Payment link copied!");
  };

  const createInvoice = async () => {
    if (!amount || loading || !userData) return;
    setLoading(true);
    try {
      const args = buildCreateInvoiceArgs(
        BigInt(amount), 
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
          alert(`Invoice Submitted!`);
          setLoading(false);
          setTimeout(() => fetchTransactionHistory(userData.profile.stxAddress.mainnet), 5000);
        },
        onCancel: () => setLoading(false)
      });
    } catch (error) {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
      <div className="card">
        <h2>Merchant Dashboard</h2>
        <div style={{ marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
          {userData ? (
            <button onClick={() => { disconnectWallet(); setUserData(null); }}>Sign Out</button>
          ) : (
            <button className="primary" onClick={handleConnect}>Connect Wallet</button>
          )}
        </div>

        {/* Form Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: userData ? 1 : 0.5 }}>
          <h3>Create New Invoice</h3>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (Micro-STX)" />
          <select value={token} onChange={e => setToken(e.target.value)}>
            <option value="STX">STX (Stacks)</option>
            <option value="sBTC">sBTC (Bitcoin)</option>
          </select>
          <button className="primary" onClick={createInvoice} disabled={loading || !userData}>
            {loading ? 'Processing...' : 'Create Invoice'}
          </button>
        </div>
      </div>

      {/* History Section */}
      <div className="card" style={{ marginTop: 30 }}>
        <h3>Invoice History</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {history.map((tx) => {
            const txid = tx.tx_id || tx.txid;
            const isPending = tx.tx_status === 'pending';
            const isPaid = tx.onChainPaid;

            return (
              <li key={txid} style={{ 
                padding: '16px', border: '1px solid var(--border-color)', marginBottom: 10, borderRadius: 8,
                background: isPaid ? 'rgba(40, 167, 69, 0.1)' : 'transparent' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontWeight: 'bold', color: isPaid ? '#28a745' : isPending ? '#ffc107' : '#888' }}>
                      {isPaid ? '✅ PAID' : isPending ? '⏳ PENDING' : '📄 ACTIVE'}
                    </span>
                    <div style={{ fontSize: '0.7rem', marginTop: 4 }}>ID: {txid.slice(0, 12)}...</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {tx.tx_status === 'success' && !isPaid && (
                      <button onClick={() => copyPaymentLink(tx)} style={{ fontSize: '0.7rem' }}>Link 🔗</button>
                    )}
                    {/* ✅ Corrected Details Link */}
                    <a href={`https://explorer.hiro.so{txid}?chain=mainnet`} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem' }}>
                      Details ↗
                    </a>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
