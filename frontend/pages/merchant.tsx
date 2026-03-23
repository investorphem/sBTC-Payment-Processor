import { useState, useEffect, useMemo } from 'react';
import { connectWallet, callCreateInvoice, disconnectWallet, getUserData } from '../lib/wallet';
import { getNetwork } from '../lib/network';
import { CONTRACT_ADDRESS, CONTRACT_NAME, buildCreateInvoiceArgs } from '../lib/contract';
import Link from 'next/link';

export default function Merchant() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [paidHistory, setPaidHistory] = useState([]);

  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [token, setToken] = useState('sBTC');
  const [agreedToTerms, setAgreedToTerms] = useState(false); 

  const [searchQuery, setSearchQuery] = useState('');
  const [showRawUnits, setShowRawUnits] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

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

  const handleDisconnect = () => {
    disconnectWallet();
    setUserData(null);
    setHistory([]);
    setPaidHistory([]);
  };

  const createInvoice = async () => {
    if (!amount || isNaN(Number(amount)) || loading || !userData || !agreedToTerms) return;
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
    tx.contract_call.function_name.includes('stx') ? acc.stx += amountVal : acc.sbtc += amountVal;
    return acc;
  }, { stx: 0, sbtc: 0 });

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '600px', margin: '0 auto', position: 'relative' }}>

      {/* 🧭 NAVIGATION & BRANDING */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <Link href="/">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <img src="/logo.png" alt="sBTC Logo" style={{ width: '40px', height: '40px' }} />
            <span style={{ 
              fontWeight: 'bold', 
              fontSize: '1.2rem', 
              background: 'linear-gradient(to right, #F7931A, #5546FF)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent' 
            }}>sBTC Processor</span>
          </div>
        </Link>
        <button onClick={() => setShowSupport(true)} style={{ background: 'rgba(85, 70, 255, 0.1)', border: '1px solid #5546ff', color: '#5546ff', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 'bold' }}>?</button>
      </div>

      {/* 🏆 REVENUE OVERVIEW */}
      {userData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div className="card shadow" onClick={() => setShowRawUnits(!showRawUnits)} style={{ textAlign: 'center', borderTop: '4px solid #5546FF', padding: '15px', cursor: 'pointer', background: 'rgba(85, 70, 255, 0.05)' }}>
            <label style={{ fontSize: '0.65rem', opacity: 0.6, letterSpacing: '1px' }}>STX EARNINGS</label>
            <h2 style={{ margin: '5px 0', color: '#5546FF' }}>{showRawUnits ? totals.stx : (totals.stx / 1e6).toFixed(2)} <span style={{fontSize: '0.6rem', opacity: 0.5}}>{showRawUnits ? 'uSTX' : 'STX'}</span></h2>
          </div>
          <div className="card shadow" onClick={() => setShowRawUnits(!showRawUnits)} style={{ textAlign: 'center', borderTop: '4px solid #F7931A', padding: '15px', cursor: 'pointer', background: 'rgba(247, 147, 26, 0.05)' }}>
            <label style={{ fontSize: '0.65rem', opacity: 0.6, letterSpacing: '1px' }}>sBTC EARNINGS</label>
            <h2 style={{ margin: '5px 0', color: '#F7931A' }}>{showRawUnits ? totals.sbtc : (totals.sbtc / 1e8).toFixed(6)} <span style={{fontSize: '0.6rem', opacity: 0.5}}>{showRawUnits ? 'Sats' : 'BTC'}</span></h2>
          </div>
        </div>
      )}

      {/* ⚡ MERCHANT ACTIONS */}
      <div className="card shadow" style={{ padding: '24px', marginBottom: '24px', border: '1px solid rgba(85, 70, 255, 0.2)' }}>
        <h2 style={{ textAlign: 'center', margin: '0 0 20px 0', fontSize: '1.3rem' }}>Create New Invoice</h2>
        {!userData ? (
          <button className="primary" onClick={handleConnect} style={{ width: '100%', background: 'linear-gradient(45deg, #F7931A, #5546FF)', border: 'none' }}>Connect Wallet</button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{textAlign: 'center', marginBottom: '10px', background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '8px'}}>
               <p style={{fontSize: '0.75rem', fontWeight: 'bold', margin: '0', opacity: 0.7}}>Logged in as {userData.profile.stxAddress.mainnet.slice(0, 6)}...{userData.profile.stxAddress.mainnet.slice(-4)}</p>
               <button onClick={handleDisconnect} style={{background: 'none', border: 'none', color: '#ff4b4b', fontSize: '0.65rem', cursor: 'pointer', textDecoration: 'underline'}}>Sign Out</button>
            </div>
            
            <div style={{ position: 'relative' }}>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ paddingLeft: '45px' }} />
              <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>💰</span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={token} onChange={e => setToken(e.target.value)} style={{ flex: 1, cursor: 'pointer' }}>
                <option value="sBTC">sBTC</option>
                <option value="STX">STX</option>
              </select>
              <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="Invoice Memo (optional)" style={{ flex: 2 }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0', padding: '10px', background: 'rgba(85, 70, 255, 0.05)', borderRadius: '8px' }}>
               <input type="checkbox" id="terms" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} style={{ cursor: 'pointer', width: '18px', height: '18px' }}/>
               <label htmlFor="terms" style={{ fontSize: '0.75rem', opacity: 0.8, cursor: 'pointer' }}>
                  I confirm this is a non-custodial transfer. <span onClick={() => setShowTerms(true)} style={{ color: '#5546ff', textDecoration: 'underline' }}>Terms</span>
               </label>
            </div>

            <button 
                className="primary" 
                onClick={createInvoice} 
                disabled={loading || !amount || !agreedToTerms}
                style={{ 
                    width: '100%', 
                    background: agreedToTerms ? 'linear-gradient(45deg, #F7931A, #5546FF)' : '#333', 
                    border: 'none',
                    fontWeight: 'bold',
                    boxShadow: agreedToTerms ? '0 4px 12px rgba(85, 70, 255, 0.2)' : 'none'
                }}
            >
                {loading ? 'Broadcasting...' : 'Generate Secure Link'}
            </button>
          </div>
        )}
      </div>

      {/* 🔍 SEARCH & LISTS */}
      <div style={{ marginBottom: '20px', position: 'relative' }}>
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search txid or memo..." style={{ width: '100%', padding: '14px 40px 14px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white' }}/>
      </div>

      {/* OPEN INVOICES */}
      <div className="card shadow" style={{ padding: '20px', marginBottom: '24px', borderLeft: '4px solid #5546FF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>📋 Open Invoices</h3>
            <span style={{ fontSize: '0.7rem', background: '#5546FF', padding: '2px 8px', borderRadius: '10px' }}>{filteredOpen.length}</span>
        </div>
        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
          {filteredOpen.length === 0 ? <p style={{fontSize: '0.8rem', opacity: 0.4, textAlign: 'center'}}>No pending invoices</p> : filteredOpen.map((tx: any) => (
            <div key={tx.tx_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>ID: ...{tx.tx_id.slice(-6)}</div>
                <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>Broadcasted</div>
              </div>
              <button 
                className="secondary" 
                onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/pay/${tx.tx_id}`);
                    alert("Payment link copied!");
                }} 
                style={{ padding: '6px 12px', fontSize: '0.7rem', background: 'rgba(85, 70, 255, 0.1)', border: '1px solid rgba(85, 70, 255, 0.3)', color: '#5546FF' }}
              >
                Copy Link 🔗
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* PAID INVOICES */}
      <div className="card shadow" style={{ padding: '20px', borderLeft: '4px solid #F7931A' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#F7931A' }}>✅ Paid & Settled</h3>
            <span style={{ fontSize: '0.7rem', background: '#F7931A', padding: '2px 8px', borderRadius: '10px' }}>{filteredPaid.length}</span>
        </div>
        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
          {filteredPaid.length === 0 ? <p style={{fontSize: '0.8rem', opacity: 0.4, textAlign: 'center'}}>No payments detected yet</p> : filteredPaid.map((tx: any) => (
            <div key={tx.tx_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: tx.contract_call.function_name.includes('stx') ? '#5546FF' : '#F7931A' }}>
                {tx.contract_call.function_name.includes('stx') ? 'STX' : 'sBTC'}
              </span>
              <a href={`https://explorer.hiro.so/txid/${tx.tx_id}?chain=mainnet`} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', color: '#5546ff', textDecoration: 'none' }}>
                Explorer ↗
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* --- 📖 MODALS (Branded) --- */}

      {showSupport && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(5px)' }}>
          <div className="card shadow" style={{ maxWidth: '400px', width: '100%', padding: '30px', background: '#121212', border: '1px solid #5546ff', position: 'relative', borderRadius: '20px' }}>
             <button onClick={() => setShowSupport(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
             <div style={{textAlign: 'center', marginBottom: '20px'}}>
                <img src="/logo.png" style={{width: '60px'}} />
                <h3 style={{ margin: '10px 0 0 0', color: '#5546ff' }}>Merchant Support</h3>
             </div>
             <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6', textAlign: 'center' }}>
                <p>Need help with your sBTC gateway? Our documentation and community are here.</p>
                <a href="mailto:support@sbtcpayments.io" style={{ display: 'block', background: 'linear-gradient(to right, #F7931A, #5546FF)', color: '#fff', textAlign: 'center', padding: '14px', borderRadius: '12px', textDecoration: 'none', fontWeight: 'bold', margin: '20px 0' }}>Email Developer</a>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '0.75rem' }}>
                  <span onClick={() => setShowTerms(true)} style={{ color: '#5546ff', cursor: 'pointer' }}>Terms</span>
                  <span onClick={() => setShowPrivacy(true)} style={{ color: '#5546ff', cursor: 'pointer' }}>Privacy</span>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Simplified generic modals for brevity, keep your logic for Terms/Privacy */}

    </div>
  );
}
