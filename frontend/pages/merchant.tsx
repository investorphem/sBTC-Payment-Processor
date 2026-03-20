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
      
      {/* 🧭 NAVIGATION */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '30px' }}>
        <button onClick={() => setShowSupport(true)} style={{ background: 'rgba(85, 70, 255, 0.1)', border: '1px solid #5546ff', color: '#5546ff', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>?</button>
      </div>

      {/* 🏆 REVENUE OVERVIEW */}
      {userData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div className="card shadow" onClick={() => setShowRawUnits(!showRawUnits)} style={{ textAlign: 'center', borderTop: '4px solid #fc6432', padding: '15px', cursor: 'pointer' }}>
            <label style={{ fontSize: '0.65rem', opacity: 0.5 }}>STX REVENUE</label>
            <h2 style={{ margin: '5px 0', color: '#fc6432' }}>{showRawUnits ? totals.stx : (totals.stx / 1e6).toFixed(2)} <span style={{fontSize: '0.6rem', opacity: 0.5}}>{showRawUnits ? 'uSTX' : 'STX'}</span></h2>
          </div>
          <div className="card shadow" onClick={() => setShowRawUnits(!showRawUnits)} style={{ textAlign: 'center', borderTop: '4px solid #f7931a', padding: '15px', cursor: 'pointer' }}>
            <label style={{ fontSize: '0.65rem', opacity: 0.5 }}>sBTC REVENUE</label>
            <h2 style={{ margin: '5px 0', color: '#f7931a' }}>{showRawUnits ? totals.sbtc : (totals.sbtc / 1e8).toFixed(6)} <span style={{fontSize: '0.6rem', opacity: 0.5}}>{showRawUnits ? 'Sats' : 'BTC'}</span></h2>
          </div>
        </div>
      )}

      {/* ⚡ MERCHANT ACTIONS */}
      <div className="card shadow" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ textAlign: 'center', margin: '0 0 20px 0' }}>⚡ sBTC Merchant</h2>
        {!userData ? (
          <button className="primary" onClick={handleConnect} style={{ width: '100%' }}>Connect Wallet</button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{textAlign: 'center', marginBottom: '10px'}}>
               <p style={{fontSize: '0.75rem', fontWeight: 'bold', margin: '4px 0', opacity: 0.8}}>{userData.profile.stxAddress.mainnet.slice(0, 12)}...</p>
               <button onClick={handleDisconnect} style={{background: 'none', border: 'none', color: '#ff4b4b', fontSize: '0.65rem', cursor: 'pointer', textDecoration: 'underline'}}>Disconnect</button>
            </div>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" />
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={token} onChange={e => setToken(e.target.value)} style={{ flex: 1 }}>
                <option value="sBTC">sBTC</option>
                <option value="STX">STX</option>
              </select>
              <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="Memo" style={{ flex: 2 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0' }}>
               <input type="checkbox" id="terms" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} style={{ cursor: 'pointer', width: '16px', height: '16px' }}/>
               <label htmlFor="terms" style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                  I agree to the <span onClick={() => setShowTerms(true)} style={{ color: '#5546ff', cursor: 'pointer', textDecoration: 'underline' }}>Terms of Service</span>
               </label>
            </div>
            <button className="primary" onClick={createInvoice} disabled={loading || !amount || !agreedToTerms}>{loading ? 'Confirming...' : 'Generate Link'}</button>
          </div>
        )}
      </div>

      {/* 🔍 SEARCH */}
      <div style={{ marginBottom: '20px', position: 'relative' }}>
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search invoices..." style={{ width: '100%', padding: '12px 40px 12px 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white' }}/>
        {searchQuery && <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer' }}>×</button>}
      </div>

      {/* 📋 INVOICE LISTS */}
      <div className="card shadow" style={{ padding: '20px', marginBottom: '24px', borderLeft: '4px solid #fc6432' }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem' }}>📋 Open Invoices ({filteredOpen.length})</h3>
        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
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

      <div className="card shadow" style={{ padding: '20px', borderLeft: '4px solid #28a745' }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#28a745', fontSize: '1rem' }}>✅ Paid Invoices ({filteredPaid.length})</h3>
        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
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

      {/* --- 📖 MODALS --- */}

      {showSupport && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card shadow" style={{ maxWidth: '400px', width: '100%', padding: '24px', background: '#121212', border: '1px solid #5546ff', position: 'relative' }}>
             <button onClick={() => setShowSupport(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
             <h3 style={{ marginTop: 0, color: '#5546ff' }}>Help & Support</h3>
             <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6' }}>
                <p>Create an invoice and share the URL. Payments settle directly to your Stacks wallet.</p>
                
                {/* ✉️ CONTACT SUPPORT BUTTON ADDED HERE */}
                <a href="mailto:support@yourdomain.com" style={{ display: 'block', background: '#5546ff', color: '#fff', textAlign: 'center', padding: '12px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', margin: '20px 0' }}>Contact Support</a>
                
                <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', fontSize: '0.7rem' }}>
                  <button onClick={() => setShowTerms(true)} style={{ background: 'none', border: 'none', color: '#5546ff', cursor: 'pointer', textDecoration: 'underline' }}>Terms</button>
                  <button onClick={() => setShowPrivacy(true)} style={{ background: 'none', border: 'none', color: '#5546ff', cursor: 'pointer', textDecoration: 'underline' }}>Privacy</button>
                </div>
             </div>
          </div>
        </div>
      )}

      {showTerms && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card shadow" style={{ maxWidth: '500px', padding: '30px', background: '#121212', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ color: '#fc6432' }}>Terms of Service</h3>
            <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>Transactions are final. You are responsible for any taxes on received payments.</p>
            <button className="primary" onClick={() => setShowTerms(false)} style={{ marginTop: '20px', width: '100%' }}>Close</button>
          </div>
        </div>
      )}

      {showPrivacy && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', z { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card shadow" style={{ maxWidth: '500px', padding: '30px', background: '#121212' }}>
            <h3 style={{ color: '#28a745' }}>Privacy Policy</h3>
            <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>We do not store private data. All info is on-chain.</p>
            <button className="primary" onClick={() => setShowPrivacy(false)} style={{ marginTop: '20px', width: '100%', background: '#28a745' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
