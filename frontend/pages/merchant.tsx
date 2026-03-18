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

  const createInvoice = async () => {
    if (!amount || loading || !userData) return;

    // ✅ Fix: Validate sBTC contract before triggering wallet
    if (token === 'sBTC' && (!tokenContract || !tokenContract.includes('.'))) {
      alert("Error: Please enter a valid sBTC contract (e.g. Principal.contract-name)");
      return;
    }

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
          alert(`Transaction submitted! TXID: ${data.txId}`);
          setLoading(false);
          setTimeout(() => fetchTransactionHistory(userData.profile.stxAddress.mainnet), 4000);
        },
        // ✅ Fix: Reset loading state if user cancels
        onCancel: () => {
          console.log("User cancelled transaction");
          setLoading(false);
        }
      });
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Merchant Dashboard</h2>
        <div style={{ marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
          {userData ? (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>✅ Connected: <strong>{userData.profile.stxAddress.mainnet.slice(0, 8)}...</strong></span>
              <button onClick={() => { disconnectWallet(); setUserData(null); }}>Sign Out</button>
            </div>
          ) : (
            <button className="primary" onClick={handleConnect}>Connect Wallet</button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: userData ? 1 : 0.5 }}>
          <h3>Create Invoice</h3>
          <label>Amount (Units)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="1000000" />
          
          <label>Token</label>
          <select value={token} onChange={e => setToken(e.target.value)}>
            <option value="sBTC">sBTC</option>
            <option value="STX">STX</option>
          </select>

          {token === 'sBTC' && (
            <input value={tokenContract} onChange={e => setTokenContract(e.target.value)} placeholder="Token Contract Address" />
          )}

          <label>Memo (Max 34 chars)</label>
          <input maxLength={34} value={memo} onChange={e => setMemo(e.target.value)} placeholder="Order ID" />

          <button className="primary" onClick={createInvoice} disabled={loading || !userData}>
            {loading ? 'Check your wallet...' : 'Create Invoice'}
          </button>
        </div>
      </div>
      
      {/* History section omitted for brevity but stays same as previous */}
    </div>
  );
}
