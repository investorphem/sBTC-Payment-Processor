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

  // 🔄 Auto refresh every 10s
  useEffect(() => {
    const user = getUserData() as any;
    if (user?.profile) {
      setUserData(user);
      fetchTransactionHistory(user.profile.stxAddress.mainnet);

      const interval = setInterval(() => {
        fetchTransactionHistory(user.profile.stxAddress.mainnet);
      }, 10000);

      return () => clearInterval(interval);
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

      const creationTxs = data.results
        .filter((tx: any) =>
          tx.tx_type === 'contract_call' &&
          tx.contract_call.contract_id === `${CONTRACT_ADDRESS}.${CONTRACT_NAME}` &&
          tx.contract_call.function_name === 'create-invoice'
        )
        .map((tx: any) => ({
          ...tx,
          // 🧠 Add computed invoice status
          invoiceStatus:
            tx.tx_status === 'pending'
              ? 'PENDING'
              : tx.tx_status.includes('abort') || tx.tx_status === 'failed'
              ? 'FAILED'
              : tx.tx_status === 'success'
              ? 'ACTIVE' // created but not yet paid
              : 'UNKNOWN'
        }));

      setHistory(creationTxs);
    } catch (err) {
      console.error(err);
    }
  };

  const copyPaymentLink = (tx: any) => {
    const txId = tx.tx_id || tx.txid;
    navigator.clipboard.writeText(`${window.location.origin}/pay/${txId}`);
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
          setLoading(false);
          fetchTransactionHistory(userData.profile.stxAddress.mainnet);
        },
        onCancel: () => setLoading(false)
      });
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  // 🎨 Status badge styling
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { background: '#ffc107', color: '#000' };
      case 'FAILED':
        return { background: '#ff4b4b', color: '#fff' };
      case 'ACTIVE':
        return { background: '#28a745', color: '#fff' };
      case 'PAID':
        return { background: '#00d4ff', color: '#000' };
      default:
        return { background: '#999', color: '#fff' };
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto', color: '#fff' }}>

      {/* Wallet Card */}
      <div style={{ background: '#111', padding: 20, borderRadius: 16, marginBottom: 20 }}>
        <h2>Merchant Dashboard</h2>

        {userData ? (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>✅ {userData.profile.stxAddress.mainnet.slice(0, 10)}...</span>
            <button onClick={() => { disconnectWallet(); setUserData(null); }}>
              Disconnect
            </button>
          </div>
        ) : (
          <button onClick={handleConnect}>Connect Wallet</button>
        )}
      </div>

      {/* Create Invoice */}
      <div style={{ background: '#111', padding: 20, borderRadius: 16 }}>
        <h3>Create Invoice</h3>

        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          style={{ width: '100%', marginBottom: 10 }}
        />

        <select value={token} onChange={e => setToken(e.target.value)}>
          <option value="STX">STX</option>
          <option value="sBTC">sBTC</option>
        </select>

        <input
          placeholder="Memo"
          value={memo}
          onChange={e => setMemo(e.target.value)}
          style={{ width: '100%', marginTop: 10 }}
        />

        <button onClick={createInvoice} disabled={loading}>
          {loading ? 'Creating...' : 'Create Invoice'}
        </button>
      </div>

      {/* History */}
      <div style={{ marginTop: 20 }}>
        <h3>Invoices</h3>

        {history.map((tx: any) => {
          const txId = tx.tx_id || tx.txid;

          return (
            <div
              key={txId}
              style={{
                background: '#1a1a1a',
                padding: 15,
                borderRadius: 12,
                marginBottom: 10,
                display: 'flex',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div
                  style={{
                    ...getStatusStyle(tx.invoiceStatus),
                    padding: '4px 10px',
                    borderRadius: 8,
                    display: 'inline-block',
                    fontSize: 12,
                    marginBottom: 6
                  }}
                >
                  {tx.invoiceStatus}
                </div>

                <div style={{ fontSize: 12, color: '#aaa' }}>
                  {txId.slice(0, 20)}...
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => copyPaymentLink(tx)}>Copy</button>

                <a
                  href={`https://explorer.hiro.so/txid/${txId}?chain=mainnet`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}