import { useState, useEffect } from 'react';
import { connectWallet, callCreateInvoice, disconnectWallet, getUserData } from '../lib/wallet';
import { getNetwork } from '../lib/network';
import { CONTRACT_ADDRESS, CONTRACT_NAME, buildCreateInvoiceArgs } from '../lib/contract';

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
    if (user && user.profile?.stxAddress?.mainnet) {
      setUserData(user);
      fetchTransactionHistory(user.profile.stxAddress.mainnet);
    }
  }, []);

  const handleConnect = async () => {
    try {
      const user = (await connectWallet()) as any;
      if (user && user.profile?.stxAddress?.mainnet) {
        setUserData(user);
        fetchTransactionHistory(user.profile.stxAddress.mainnet);
      }
    } catch (err) {
      console.error('Wallet connection failed:', err);
    }
  };

  const fetchTransactionHistory = async (address: string) => {
    if (!address) return;
    try {
      const network = getNetwork();
      // Use correct template literal + broader query (filter in code for recent txs)
      const url = `\( {network.coreApiUrl}/extended/v1/address/ \){address}/transactions?limit=30`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }
      const data = await response.json();

      const creationTxs = data.results.filter((tx: any) =>
        tx.tx_type === 'contract_call' &&
        tx.contract_call?.contract_id === `\( {CONTRACT_ADDRESS}. \){CONTRACT_NAME}` &&
        tx.contract_call?.function_name === 'create-invoice'
      );

      setHistory(creationTxs);
      console.log(`Found ${creationTxs.length} invoice creation txs`);
    } catch (err) {
      console.error('Error fetching transaction history:', err);
    }
  };

  const copyPaymentLink = (tx: any) => {
    const txId = tx.tx_id || tx.txid;
    if (!txId) return;
    const link = `\( {window.location.origin}/pay/ \){txId}`;
    navigator.clipboard.writeText(link).then(() => {
      alert('Payment link copied to clipboard!');
    });
  };

  const createInvoice = async () => {
    if (!amount || loading || !userData?.profile?.stxAddress?.mainnet) return;
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
          alert(`Invoice submitted successfully!\nTx ID: ${data.txId}`);
          setLoading(false);
          setAmount('');
          setMemo('');
          // Refresh multiple times to catch delayed indexing
          fetchTransactionHistory(userData.profile.stxAddress.mainnet);
          setTimeout(() => fetchTransactionHistory(userData.profile.stxAddress.mainnet), 15000);
          setTimeout(() => fetchTransactionHistory(userData.profile.stxAddress.mainnet), 30000);
        },
        onCancel: () => {
          setLoading(false);
          alert('Transaction cancelled');
        },
      });
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Failed to create invoice. Check console for details.');
      setLoading(false);
    }
  };

  const shortenTxId = (txId: string) => {
    if (!txId) return '—';
    return `\( {txId.slice(0, 8)}... \){txId.slice(-6)}`;
  };

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Merchant Dashboard</h2>

        <div style={{ marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid #333' }}>
          {userData ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                ✅ Connected:{' '}
                <strong>{userData.profile.stxAddress.mainnet.slice(0, 8)}...</strong>
              </span>
              <button
                onClick={() => {
                  disconnectWallet();
                  setUserData(null);
                  setHistory([]);
                }}
                style={{ background: 'transparent', border: '1px solid #ff4b4b', color: '#ff4b4b', padding: '6px 12px' }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <button className="primary" onClick={handleConnect}>
                Connect Wallet
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: userData ? 1 : 0.5 }}>
          <h3>Create New Invoice</h3>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (in micro units)"
            disabled={loading || !userData}
          />
          <select value={token} onChange={(e) => setToken(e.target.value)} disabled={loading || !userData}>
            <option value="STX">STX (Stacks)</option>
            <option value="sBTC">sBTC (Bitcoin)</option>
          </select>
          {token === 'sBTC' && (
            <input
              value={tokenContract}
              onChange={(e) => setTokenContract(e.target.value)}
              placeholder="sBTC contract principal (e.g. SP...)"
              maxLength={100}
              disabled={loading || !userData}
            />
          )}
          <input
            maxLength={80}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Memo / Invoice note (optional)"
            disabled={loading || !userData}
          />
          <button
            className="primary"
            onClick={createInvoice}
            disabled={loading || !userData || !amount || (token === 'sBTC' && !tokenContract.trim())}
          >
            {loading ? 'Confirming...' : 'Create Invoice'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 30 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3>Recent Invoices</h3>
          <button
            onClick={() => userData && fetchTransactionHistory(userData.profile.stxAddress.mainnet)}
            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
            disabled={loading || !userData}
          >
            Refresh
          </button>
        </div>

        {history.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '20px 0' }}>
            No invoices found yet. Create one or click Refresh.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {history.map((tx: any) => {
              const txId = tx.tx_id || tx.txid;
              const isPending = tx.tx_status === 'pending';
              const isFailed = tx.tx_status?.includes('abort') || tx.tx_status === 'failed';

              return (
                <li
                  key={txId}
                  style={{
                    padding: '16px',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div>
                    <span
                      style={{
                        color: isPending ? '#ffc107' : isFailed ? '#ff4b4b' : '#28a745',
                        fontWeight: 'bold',
                      }}
                    >
                      ● {isPending ? 'PENDING' : isFailed ? 'FAILED' : 'ACTIVE'}
                    </span>
                    <div style={{ fontSize: '0.78rem', color: '#888', marginTop: 4 }}>
                      {shortenTxId(txId)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {!isPending && !isFailed && (
                      <button
                        onClick={() => copyPaymentLink(tx)}
                        style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                      >
                        Copy Link
                      </button>
                    )}

                    <a
                      href={`https://explorer.hiro.so/txid/${txId}?chain=mainnet`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: '#5546ff',
                        textDecoration: 'none',
                        fontSize: '0.8rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      View on Explorer ↗
                    </a>
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