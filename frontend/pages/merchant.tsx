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

      setHistory(creationTxs);
    } catch (err) {
      console.error(err);
    }
  };

  const copyPaymentLink = (tx: any) => {
    const currentTxId = tx.tx_id || tx.txid;
    navigator.clipboard.writeText(`${window.location.origin}/pay/${currentTxId}`);
    console.log("Payment link copied!");
  };

  const createInvoice = async () => {
    if (!amount || loading || !userData) return;

    setLoading(true);
    try {
      const parsedAmount = BigInt(amount);

      const args = buildCreateInvoiceArgs(
        parsedAmount,
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
        onFinish: () => {
          console.log('Invoice Submitted!');
          setLoading(false);
          setTimeout(() => {
            fetchTransactionHistory(userData.profile.stxAddress.mainnet);
          }, 5000);
        },
        onCancel: () => setLoading(false)
      });

    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
      
      <div className="card">
        <h2>Merchant Dashboard</h2>

        <div style={{ marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid #333' }}>
          {userData ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                ✅ Connected: <strong>{userData.profile.stxAddress.mainnet.slice(0, 8)}...</strong>
              </span>
              <button
                onClick={() => {
                  disconnectWallet();
                  setUserData(null);
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid #ff4b4b',
                  color: '#ff4b4b',
                  padding: '6px 12px',
                  cursor: 'pointer'
                }}
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
            onChange={e => setAmount(e.target.value)}
            placeholder="Amount (Micro-STX)"
          />

          <select value={token} onChange={e => setToken(e.target.value)}>
            <option value="STX">STX (Stacks)</option>
            <option value="sBTC">sBTC (Bitcoin)</option>
          </select>

          <input
            maxLength={34}
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="Memo"
          />

          <button
            className="primary"
            onClick={createInvoice}
            disabled={loading || !userData || !amount}
          >
            {loading ? 'Confirming...' : 'Create Invoice'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 30 }}>
        <h3>History</h3>

        <ul style={{ listStyle: 'none', padding: 0 }}>
          {history.map((tx: any) => {
            const tx_id = tx.tx_id || tx.txid;
            const isPending = tx.tx_status === 'pending';
            const isFailed = tx.tx_status.includes('abort') || tx.tx_status === 'failed';

            return (
              <li
                key={tx_id}
                style={{
                  padding: '16px',
                  borderBottom: '1px solid #333',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <span
                    style={{
                      color: isPending ? '#ffc107' : isFailed ? '#ff4b4b' : '#28a745',
                      fontWeight: 'bold'
                    }}
                  >
                    ● {isPending ? 'PENDING' : isFailed ? 'FAILED' : 'ACTIVE'}
                  </span>

                  <div style={{ fontSize: '0.7rem', color: '#888' }}>
                    TX: {tx_id.slice(0, 15)}...
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  {!isPending && !isFailed && (
                    <button onClick={() => copyPaymentLink(tx)} style={{ fontSize: '0.7rem' }}>
                      Copy Link
                    </button>
                  )}

                  <a
                    href={`https://explorer.hiro.so/txid/${tx_id}?chain=mainnet`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: '#5546ff',
                      textDecoration: 'none',
                      fontSize: '0.75rem',
                      alignSelf: 'center'
                    }}
                  >
                    Details ↗
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}