import { useState, useEffect, useMemo } from 'react';
import { connectWallet, callCreateInvoice, disconnectWallet, getUserData } from '../lib/wallet';
import { getNetwork } from '../lib/network';
import { CONTRACT_ADDRESS, CONTRACT_NAME, buildCreateInvoiceArgs } from '../lib/contract';

export default function Merchant() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [paidHistory, setPaidHistory] = useState([]);
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [token, setToken] = useState('sBTC');
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  const SBTC_MAINNET = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
  const [tokenContract, setTokenContract] = useState(process.env.NEXT_PUBLIC_SBTC_CONTRACT || SBTC_MAINNET);

  useEffect(() => {
    const user = getUserData() as any;
    if (user && user.profile) {
      setUserData(user);
      refreshData(user.profile.stxAddress.mainnet);
    }
  }, []);

  const refreshData = (address: string) => {
    fetchTransactionHistory(address);
    fetchPaidHistory(address);
  };

  const handleConnect = async () => {
    try {
      const user = await connectWallet() as any;
      if (user) {
        setUserData(user);
        refreshData(user.profile.stxAddress.mainnet);
      }
    } catch (err) { console.error("Connection failed", err); }
  };

  const fetchTransactionHistory = async (address: string) => {
    if (!address) return;
    try {
      const network = getNetwork();
      const response = await fetch(`${network.coreApiUrl}/extended/v1/address/${address}/transactions?limit=50&unanchored=true`);
      const data = await response.json();
      const invoices = data.results.filter((tx: any) => 
        tx.tx_type === 'contract_call' && 
        tx.contract_call.contract_id === `${CONTRACT_ADDRESS}.${CONTRACT_NAME}` &&
        tx.contract_call.function_name === 'create-invoice' &&
        tx.tx_status !== 'failed'
      );
      setHistory(invoices);
    } catch (err) { console.error(err); }
  };

  const fetchPaidHistory = async (address: string) => {
    if (!address) return;
    try {
      const network = getNetwork();
      const response = await fetch(`${network.coreApiUrl}/extended/v1/address/${address}/transactions?limit=50&unanchored=true`);
      const data = await response.json();
      const paid = data.results.filter((tx: any) => 
        tx.tx_type === 'contract_call' && 
        tx.tx_status === 'success' &&
        tx.contract_call.function_name.includes('pay-invoice')
      );
      setPaidHistory(paid);
    } catch (err) { console.error(err); }
  };

  // --- 🔍 FILTER LOGIC ---
  const filteredOpen = useMemo(() => {
    const open = history.filter((tx: any) => {
      const isAlreadyPaid = paidHistory.some(paidTx => 
         paidTx.contract_call.function_args?.some((arg: any) => arg.repr.includes(tx.tx_id))
      );
      return !isAlreadyPaid;
    });
    if (!searchQuery) return open;
    const q = searchQuery.toLowerCase();
    return open.filter((tx: any) => 
      tx.tx_id.toLowerCase().includes(q) ||
      tx.contract_call.function_args?.some((arg: any) => arg.repr.toLowerCase().includes(q))
    );
  }, [history, paidHistory, searchQuery]);

  const filteredPaid = useMemo(() => {
    if (!searchQuery) return paidHistory;
    const q = searchQuery.toLowerCase();
    return paidHistory.filter((tx: any) => 
      tx.tx_id.toLowerCase().includes(q) ||
      tx.contract_call.function_args?.some((arg: any) => arg.repr.toLowerCase().includes(q))
    );
  }, [paidHistory, searchQuery]);

  const totals = paidHistory.reduce((acc: any, tx: any) => {
    const amountArg = tx.contract_call?.function_args?.find((a: any) => a.name === 'amount');
    const amountVal = amountArg ? Number(amountArg.repr.replace('u', '')) : 0;
    tx.contract_call.function_name.includes('stx') ? acc.stx += amountVal / 1e6 : acc.sbtc += amountVal / 1e8;
    return acc;
  }, { stx: 0, sbtc: 0 });

  const createInvoice = async () => {
    if (!amount || isNaN(Number(amount)) || loading || !userData) return;
    const finalTokenContract = token === 'sBTC' ? (tokenContract || SBTC_MAINNET).trim() : undefined;
    setLoading(true);
    try {
      const args = buildCreateInvoiceArgs(BigInt(amount), token, finalTokenContract, memo.trim());
      await callCreateInvoice({
        contractAddress: CONTRACT_ADDRESS, contractName: CONTRACT_NAME,
        functionName: 'create-invoice', functionArgs: args, network: getNetwork(),
        onFinish: () => {
          setLoading(false); setAmount(''); setMemo('');
          setTimeout(() => refreshData(userData.profile.stxAddress.mainnet), 3000);
        },
        onCancel: () => setLoading(false)
      });
    } catch (error) { setLoading(false); }
  };

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
      
      {/* 🏆 REVENUE OVERVIEW */}
      {userData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div className="card shadow" style={{ textAlign: 'center', borderTop: '4px solid #fc6432', padding: '15px' }}>
            <label style={{ fontSize: '0.65rem', opacity: 0.6 }}>STX REVENUE</label>
            <h2 style={{ margin: '5px 0', color: '#fc6432' }}>{totals.stx.toFixed(2)}</h2>
          </div>
          <div className="card shadow" style={{ textAlign: 'center', borderTop: '4px solid #f7931a', padding: '15px' }}>
            <label style={{ fontSize: '0.65rem', opacity: 0.6 }}>sBTC REVENUE</label>
            <h2 style={{ margin: '5px 0', color: '#f7931a' }}>{totals.sbtc.toFixed(6)}</h2>
          </div>
        </div>
      )}

      {/* ⚡ CREATE INVOICE */}
      <div className="card shadow" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ textAlign: 'center', margin: '0 0 20px 0' }}>⚡ sBTC Merchant</h2>
        {!userData ? (
          <button className="primary" onClick={handleConnect} style={{ width: '100%' }}>Connect Wallet</button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (Sats or uSTX)" />
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={token} onChange={e => setToken(e.target.value)} style={{ flex: 1 }}>
                <option value="sBTC">sBTC</option>
                <option value="STX">STX</option>
              </select>
              <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="Memo" style={{ flex: 2 }} />
            </div>
            <button className="primary" onClick={createInvoice} disabled={loading || !amount}>
              {loading ? 'Confirming...' : 'Generate Link'}
            </button>
          </div>
        )}
      </div>

      {/* 🔍 SEARCH BAR WITH CLEAR BUTTON */}
      <div style={{ marginBottom: '20px', position: 'relative' }}>
        <input 
          type="text" 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
          placeholder="Search by ID or Memo..." 
          style={{ 
            width: '100%', padding: '12px 40px 12px 12px', borderRadius: '12px', 
            border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
            color: 'white'
          }}
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
              borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px'
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* 📋 OPEN INVOICES (SCROLLABLE) */}
      <div className="card shadow" style={{ padding: '20px', marginBottom: '24px', borderLeft: '4px solid #fc6432' }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem' }}>📋 Open Invoices ({filteredOpen.length})</h3>
        <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '5px' }}>
          {filteredOpen.length === 0 ? <p style={{ opacity: 0.5, fontSize: '0.8rem' }}>No results.</p> : (
            filteredOpen.map((tx: any) => (
              <div key={tx.tx_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>...{tx.tx_id.slice(-8)}</span>
                <button className="secondary" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/pay/${tx.tx_id}`)} style={{ padding: '4px 10px', fontSize: '0.7rem' }}>Copy 🔗</button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ✅ PAID INVOICES (SCROLLABLE) */}
      <div className="card shadow" style={{ padding: '20px', borderLeft: '4px solid #28a745' }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#28a745', fontSize: '1rem' }}>✅ Paid Invoices ({filteredPaid.length})</h3>
        <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '5px' }}>
          {filteredPaid.length === 0 ? <p style={{ opacity: 0.5, fontSize: '0.8rem' }}>No results.</p> : (
            filteredPaid.map((tx: any) => (
              <div key={tx.tx_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{tx.contract_call.function_name.includes('stx') ? 'STX' : 'sBTC'}</div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.4 }}>...{tx.tx_id.slice(-12)}</div>
                </div>
                <a href={`https://explorer.hiro.so/txid/${tx.tx_id}?chain=mainnet`} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', color: '#5546ff', textDecoration: 'none' }}>View ↗</a>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
