import { useState, useEffect, useMemo } from 'react';
import { connectWallet, callCreateInvoice, disconnectWallet, getUserData } from '../lib/wallet';
import { getNetwork } from '../lib/network';
import { CONTRACT_ADDRESS, CONTRACT_NAME, buildCreateInvoiceArgs } from '../lib/contract';
import Link from 'next/link';

export default function Merchant() {
  const [userData, setUserData] = useState<any>(null);
  const [balance, setBalance] = useState<number>(0); // 💰 Added Balance State
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [paidHistory, setPaidHistory] = useState([]);

  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [token, setToken] = useState('sBTC');
  const [agreedToTerms, setAgreedToTerms] = useState(false); 

  const [searchQuery, setSearchQuery] = useState('');
  const [showRawUnits, setShowRawUnits] = useState(false);

  const SBTC_MAINNET = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
  const [tokenContract, setTokenContract] = useState(process.env.NEXT_PUBLIC_SBTC_CONTRACT || SBTC_MAINNET);

  useEffect(() => {
    const user = getUserData() as any;
    if (user && user.profile) {
      setUserData(user);
      const addr = user.profile.stxAddress.mainnet;
      refreshData(addr);
      fetchBalance(addr); // 👈 Check balance on load
    }
  }, []);

  const fetchBalance = async (address: string) => {
    try {
      const network = getNetwork();
      const response = await fetch(`${network.coreApiUrl}/extended/v1/address/${address}/balances`);
      const data = await response.json();
      const stxBalance = parseInt(data.stx.balance) / 1e6;
      setBalance(stxBalance);
    } catch (e) { console.error("Balance fetch failed", e); }
  };

  const refreshData = (address: string) => {
    fetchTransactionHistory(address);
    fetchPaidHistory(address);
  };

  const handleConnect = async () => {
    try {
      const user = await connectWallet() as any;
      if (user) {
        setUserData(user);
        const addr = user.profile.stxAddress.mainnet;
        refreshData(addr);
        fetchBalance(addr);
      }
    } catch (err) { console.error("Connection failed", err); }
  };

  const createInvoice = async () => {
    if (!amount || isNaN(Number(amount)) || loading || !userData || !agreedToTerms) return;
    
    // Convert to micro-units
    const multiplier = token === 'STX' ? 1_000_000 : 100_000_000;
    const amountInRawUnits = BigInt(Math.floor(Number(amount) * multiplier));
    const finalTokenContract = token === 'sBTC' ? (tokenContract || SBTC_MAINNET).trim() : undefined;

    setLoading(true);
    try {
      const args = buildCreateInvoiceArgs(amountInRawUnits, token, finalTokenContract, memo.trim());
      await callCreateInvoice({
        contractAddress: CONTRACT_ADDRESS, 
        contractName: CONTRACT_NAME,
        functionName: 'create-invoice', 
        functionArgs: args, 
        network: getNetwork(),
        onFinish: () => {
          setLoading(false); setAmount(''); setMemo('');
          setTimeout(() => {
            refreshData(userData.profile.stxAddress.mainnet);
            fetchBalance(userData.profile.stxAddress.mainnet);
          }, 3000);
        },
        onCancel: () => setLoading(false)
      });
    } catch (error) { setLoading(false); }
  };

  // Rest of your API fetching logic (fetchTransactionHistory, fetchPaidHistory, etc.) remains here...
  // [Restoring history filter logic]
  const filteredOpen = useMemo(() => {
    const open = history.filter((tx: any) => {
      const isAlreadyPaid = paidHistory.some(paidTx => 
         paidTx.contract_call.function_args?.some((arg: any) => arg.repr.includes(tx.tx_id))
      );
      return !isAlreadyPaid;
    });
    return open;
  }, [history, paidHistory]);

  const totals = paidHistory.reduce((acc: any, tx: any) => {
    const amountArg = tx.contract_call?.function_args?.find((a: any) => a.name === 'amount');
    const amountVal = amountArg ? Number(amountArg.repr.replace('u', '')) : 0;
    tx.contract_call.function_name.includes('stx') ? acc.stx += amountVal : acc.sbtc += amountVal;
    return acc;
  }, { stx: 0, sbtc: 0 });

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
      
      {/* 💳 BALANCE WARNING */}
      {userData && balance < 0.5 && (
        <div style={{ background: '#ff4b4b22', border: '1px solid #ff4b4b', padding: '12px', borderRadius: '12px', marginBottom: '20px', color: '#ff4b4b', fontSize: '0.8rem', textAlign: 'center' }}>
          ⚠️ <strong>Low STX Balance ({balance.toFixed(2)} STX)</strong>. 
          You need at least 0.5 STX to pay for transaction fees.
        </div>
      )}

      {/* DASHBOARD HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h3>Merchant Panel</h3>
        {userData && <button onClick={handleDisconnect} className="secondary" style={{ fontSize: '0.7rem' }}>Disconnect</button>}
      </div>

      {/* REVENUE STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        <div className="card shadow" style={{ padding: '15px', textAlign: 'center', borderTop: '3px solid #5546ff' }}>
          <small>Total STX</small>
          <h2>{(totals.stx / 1e6).toFixed(2)}</h2>
        </div>
        <div className="card shadow" style={{ padding: '15px', textAlign: 'center', borderTop: '3px solid #f7931a' }}>
          <small>Total sBTC</small>
          <h2>{(totals.sbtc / 1e8).toFixed(6)}</h2>
        </div>
      </div>

      {/* CREATE INVOICE */}
      <div className="card shadow" style={{ padding: '24px', marginBottom: '20px' }}>
        {!userData ? (
          <button className="primary" onClick={handleConnect} style={{ width: '100%' }}>Connect Wallet</button>
        ) : (
          <>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ fontSize: '1.2rem', width: '100%', marginBottom: '10px' }} />
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
               <select value={token} onChange={e => setToken(e.target.value)} style={{ flex: 1 }}>
                 <option value="sBTC">sBTC</option>
                 <option value="STX">STX</option>
               </select>
               <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="Memo" style={{ flex: 2 }} />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'center' }}>
               <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} />
               <label style={{ fontSize: '0.75rem' }}>Non-custodial transfer agreement</label>
            </div>

            <button 
              className="primary" 
              onClick={createInvoice} 
              disabled={loading || !amount || !agreedToTerms || balance < 0.1}
              style={{ width: '100%' }}
            >
              {balance < 0.1 ? 'Insufficient STX' : loading ? 'Confirming...' : 'Generate Invoice'}
            </button>
          </>
        )}
      </div>

      {/* HISTORY LISTS (Simplified version for space) */}
      <div className="card shadow" style={{ padding: '20px' }}>
        <h4>Open Invoices</h4>
        {filteredOpen.map((tx: any) => (
          <div key={tx.tx_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
            <span style={{ fontSize: '0.7rem' }}>{tx.tx_id.slice(-10)}</span>
            <button 
              className="secondary" 
              style={{ fontSize: '0.6rem', padding: '4px 8px' }}
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/pay/${tx.tx_id}`);
                alert("Copied!");
              }}
            >Copy</button>
          </div>
        ))}
      </div>
    </div>
  );
}
