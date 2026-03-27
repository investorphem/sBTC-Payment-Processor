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
  
  // 🔔 UI & Modal States
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [receiptTx, setReceiptTx] = useState<any>(null); 
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

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
      refreshData(user.profile.stxAddress.mainnet);
    }
  }, []);

  const handleCopy = (txId: string) => {
    const link = `${window.location.origin}/pay/${txId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(txId);
    setTimeout(() => setCopiedId(null), 2000);
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

  // 📄 RECEIPT HELPER (Now Extracts Memo!)
  const getReceiptDetails = (tx: any) => {
    if (!tx) return null;
    const isSTX = tx.contract_call.function_name.includes('stx');
    
    // Extract Amount
    const amountArg = tx.contract_call?.function_args?.find((a: any) => a.name === 'amount');
    const rawAmount = amountArg ? Number(amountArg.repr.replace('u', '')) : 0;
    const displayAmount = isSTX ? (rawAmount / 1e6).toFixed(2) : (rawAmount / 1e8).toFixed(8);
    
    // Extract Memo securely from hex
    const memoArg = tx.contract_call?.function_args?.find((a: any) => a.name === 'memo' || a.name === 'invoice-memo');
    let memoText = 'N/A';
    if (memoArg && memoArg.repr !== 'none') {
      const hexMatch = memoArg.repr.match(/0x([0-9a-fA-F]+)/);
      if (hexMatch && hexMatch[1]) {
        try { memoText = Buffer.from(hexMatch[1], 'hex').toString('utf8').replace(/\0/g, ''); } 
        catch (e) { memoText = "Encrypted/Raw"; }
      }
    }

    const date = tx.burn_block_time_iso ? new Date(tx.burn_block_time_iso).toLocaleString() : 'Recent';
    
    return {
      txId: tx.tx_id,
      sender: tx.sender_address,
      token: isSTX ? 'STX' : 'sBTC',
      amount: displayAmount,
      memo: memoText,
      date: date
    };
  };

  const handleShareReceipt = async (details: any) => {
    const shareText = `Payment Receipt:\nAmount: ${details.amount} ${details.token}\nMemo: ${details.memo}\nDate: ${details.date}\nTxID: ${details.txId}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Payment Receipt', text: shareText }); } 
      catch (e) { console.log('Share dismissed'); }
    } else {
      navigator.clipboard.writeText(shareText);
      alert("Receipt details copied to clipboard!");
    }
  };

  const receiptDetails = getReceiptDetails(receiptTx);

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '600px', margin: '0 auto', position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Main Content Wrapper */}
      <div style={{ flex: 1 }}>
        {/* 🧭 NAVIGATION */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <Link href="/">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <img src="/logo.png" alt="My Logo" style={{ width: '35px', height: '35px', borderRadius: '8px' }} />
              <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'white' }}>Merchant Portal</span>
            </div>
          </Link>
          {userData && <button onClick={handleDisconnect} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer' }}>Disconnect</button>}
        </div>

        {/* 🏆 REVENUE OVERVIEW */}
        {userData && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div className="card shadow" onClick={() => setShowRawUnits(!showRawUnits)} style={{ textAlign: 'center', borderTop: '4px solid #5546FF', padding: '15px', cursor: 'pointer' }}>
              <label style={{ fontSize: '0.65rem', opacity: 0.5 }}>STX REVENUE</label>
              <h2 style={{ margin: '5px 0', color: '#5546FF' }}>{showRawUnits ? totals.stx : (totals.stx / 1e6).toFixed(2)} <span style={{fontSize: '0.6rem', opacity: 0.5}}>{showRawUnits ? 'uSTX' : 'STX'}</span></h2>
            </div>
            <div className="card shadow" onClick={() => setShowRawUnits(!showRawUnits)} style={{ textAlign: 'center', borderTop: '4px solid #f7931a', padding: '15px', cursor: 'pointer' }}>
              <label style={{ fontSize: '0.65rem', opacity: 0.5 }}>sBTC REVENUE</label>
              <h2 style={{ margin: '5px 0', color: '#f7931a' }}>{showRawUnits ? totals.sbtc : (totals.sbtc / 1e8).toFixed(6)} <span style={{fontSize: '0.6rem', opacity: 0.5}}>{showRawUnits ? 'Sats' : 'BTC'}</span></h2>
            </div>
          </div>
        )}

        {/* ⚡ MERCHANT ACTIONS */}
        <div className="card shadow" style={{ padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ textAlign: 'center', margin: '0 0 20px 0' }}>⚡ Create Invoice</h2>
          {!userData ? (
            <button className="primary" onClick={handleConnect} style={{ width: '100%', padding: '15px', fontSize: '1.1rem' }}>Connect Wallet</button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (e.g. 1.5)" />
              <div style={{ display: 'flex', gap: '8px' }}>
                <select value={token} onChange={e => setToken(e.target.value)} style={{ flex: 1 }}>
                  <option value="sBTC">sBTC</option>
                  <option value="STX">STX</option>
                </select>
                <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="Memo (e.g. Order #102)" style={{ flex: 2 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0' }}>
                <input type="checkbox" id="terms" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} style={{ cursor: 'pointer', width: '16px', height: '16px' }}/>
                <label htmlFor="terms" style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                    I agree to the <span onClick={() => setShowTerms(true)} style={{ color: '#5546ff', cursor: 'pointer', textDecoration: 'underline' }}>Terms of Service</span>
                </label>
              </div>
              <button className="primary" onClick={createInvoice} disabled={loading || !amount || !agreedToTerms}>
                {loading ? 'Broadcasting to Network...' : 'Generate Payment Link'}
              </button>
            </div>
          )}
        </div>

        {/* 📋 OPEN INVOICES */}
        <div className="card shadow" style={{ padding: '20px', marginBottom: '24px', borderLeft: '4px solid #5546FF' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem' }}>📋 Open Invoices ({filteredOpen.length})</h3>
          <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
            {filteredOpen.map((tx: any) => {
              const paymentLink = typeof window !== 'undefined' ? `${window.location.origin}/pay/${tx.tx_id}` : '';
              const shareText = `Hello! Here is your secure payment link: ${paymentLink}`;
              
              return (
                <div key={tx.tx_id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>ID: ...{tx.tx_id.slice(-8)}</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button className="secondary" onClick={() => handleCopy(tx.tx_id)} style={{ padding: '6px 12px', fontSize: '0.7rem', minWidth: '80px', background: copiedId === tx.tx_id ? '#28a745' : '', border: copiedId === tx.tx_id ? 'none' : '' }}>
                      {copiedId === tx.tx_id ? 'Copied! ✅' : 'Copy 🔗'}
                    </button>
                    <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', background: '#25D366', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold' }}>WhatsApp</a>
                    <a href={`mailto:?subject=Invoice Payment Link&body=${encodeURIComponent(shareText)}`} style={{ textDecoration: 'none', background: '#007bff', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold' }}>Email</a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ✅ PAID INVOICES */}
        <div className="card shadow" style={{ padding: '20px', borderLeft: '4px solid #28a745' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#28a745', fontSize: '1rem' }}>✅ Paid Invoices ({filteredPaid.length})</h3>
          <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
            {filteredPaid.map((tx: any) => (
              <div key={tx.tx_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block' }}>{tx.contract_call.function_name.includes('stx') ? 'STX Payment' : 'sBTC Payment'}</span>
                  <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>...{tx.tx_id.slice(-8)}</span>
                </div>
                <button 
                  onClick={() => setReceiptTx(tx)} 
                  style={{ background: 'rgba(40, 167, 69, 0.1)', color: '#28a745', border: '1px solid #28a745', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Receipt 📄
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 🦶 FOOTER (New!) */}
      <footer style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <span onClick={() => setShowHowItWorks(true)} style={{ cursor: 'pointer', hover: {color: '#fff'} }}>How it Works</span>
          <span onClick={() => setShowSupport(true)} style={{ cursor: 'pointer', hover: {color: '#fff'} }}>Support</span>
          <span onClick={() => setShowTerms(true)} style={{ cursor: 'pointer', hover: {color: '#fff'} }}>Terms</span>
          <span onClick={() => setShowPrivacy(true)} style={{ cursor: 'pointer', hover: {color: '#fff'} }}>Privacy</span>
        </div>
        <div>© {new Date().getFullYear()} sBTC Merchant Gateway. Non-custodial.</div>
      </footer>

      {/* --- 📖 MODALS --- */}

      {/* 1. How It Works Modal */}
      {showHowItWorks && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card shadow" style={{ maxWidth: '500px', width: '100%', padding: '30px', background: '#121212', position: 'relative' }}>
             <button onClick={() => setShowHowItWorks(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
             <h2 style={{ marginTop: 0, color: '#5546ff', display: 'flex', alignItems: 'center', gap: '10px' }}><span>🚀</span> How It Works</h2>
             <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div><strong>1. Create an Invoice:</strong> Enter the amount, choose sBTC or STX, add an optional memo (like an order number), and generate a unique link.</div>
                <div><strong>2. Share the Link:</strong> Use the Copy, WhatsApp, or Email buttons to send the secure link directly to your customer.</div>
                <div><strong>3. Get Paid Directly:</strong> The customer pays via their wallet. Funds go <em>directly</em> to your wallet. We hold zero funds (Non-custodial).</div>
                <div><strong>4. Generate Receipts:</strong> Once paid, the invoice moves to the 'Paid' tab where you can generate and print a Web2-style digital receipt.</div>
             </div>
             <button className="primary" onClick={() => setShowHowItWorks(false)} style={{ marginTop: '20px', width: '100%' }}>Got it!</button>
          </div>
        </div>
      )}

      {/* 2. Support Modal */}
      {showSupport && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card shadow" style={{ maxWidth: '400px', width: '100%', padding: '30px', background: '#121212' }}>
             <h3 style={{ marginTop: 0, color: '#f7931a' }}>Merchant Support</h3>
             <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6' }}>Having trouble generating invoices or viewing receipts? Contact our developer team.</p>
             <a href="mailto:support@yourdomain.com" style={{ display: 'block', background: '#5546ff', color: '#fff', textAlign: 'center', padding: '12px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', margin: '20px 0' }}>Email Support</a>
             <button onClick={() => setShowSupport(false)} style={{ width: '100%', padding: '10px', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}

      {/* 3. Detailed Terms Modal */}
      {showTerms && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card shadow" style={{ maxWidth: '500px', width: '100%', padding: '30px', background: '#121212', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#fc6432', marginTop: 0 }}>Terms of Service</h2>
            <div style={{ fontSize: '0.8rem', color: '#ccc', lineHeight: '1.6' }}>
              <p><strong>1. Non-Custodial Service:</strong> This platform is a graphical interface that interacts with a smart contract. We do not hold, control, or have access to your funds at any time.</p>
              <p><strong>2. Transaction Immutability:</strong> All blockchain transactions are final and irreversible. We cannot refund or reverse payments made by your customers.</p>
              <p><strong>3. Tax Liability:</strong> You (the Merchant) are entirely responsible for determining what, if any, taxes apply to your digital asset transactions.</p>
              <p><strong>4. No Warranties:</strong> The software is provided "as is" without warranty of any kind. You agree to use it at your own risk.</p>
            </div>
            <button className="primary" onClick={() => setShowTerms(false)} style={{ marginTop: '20px', width: '100%' }}>I Understand & Agree</button>
          </div>
        </div>
      )}

      {/* 4. Detailed Privacy Modal */}
      {showPrivacy && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card shadow" style={{ maxWidth: '500px', width: '100%', padding: '30px', background: '#121212', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#28a745', marginTop: 0 }}>Privacy Policy</h2>
            <div style={{ fontSize: '0.8rem', color: '#ccc', lineHeight: '1.6' }}>
              <p><strong>1. Public Ledger:</strong> Because this service operates on a public blockchain, all invoice amounts, memos, and wallet addresses are publicly visible.</p>
              <p><strong>2. Data Collection:</strong> We do not collect names, email addresses, or physical addresses unless you explicitly provide them to support.</p>
              <p><strong>3. Local Storage:</strong> Application settings and cache are stored locally in your browser. We do not use tracking cookies or third-party analytics.</p>
            </div>
            <button className="primary" onClick={() => setShowPrivacy(false)} style={{ marginTop: '20px', width: '100%', background: '#28a745' }}>Close</button>
          </div>
        </div>
      )}

      {/* --- 📄 RECEIPT MODAL (Now includes Memo!) --- */}
      {receiptTx && receiptDetails && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(5px)' }}>
          <div className="card shadow" style={{ maxWidth: '400px', width: '100%', padding: '0', background: '#fff', borderRadius: '12px', overflow: 'hidden', color: '#111' }}>
            
            <div id="printable-receipt" style={{ padding: '30px', background: '#fff' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px dashed #ccc', paddingBottom: '20px', marginBottom: '20px' }}>
                <img src="/logo.png" style={{ width: '50px', borderRadius: '8px', marginBottom: '10px' }} />
                <h2 style={{ margin: '0', fontSize: '1.4rem', color: '#333' }}>PAYMENT RECEIPT</h2>
                <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#777' }}>sBTC Merchant Gateway</p>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.85rem' }}>
                <span style={{ color: '#666' }}>Date:</span>
                <span style={{ fontWeight: 'bold' }}>{receiptDetails.date}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.85rem' }}>
                <span style={{ color: '#666' }}>Status:</span>
                <span style={{ color: '#28a745', fontWeight: 'bold' }}>PAID ✅</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.85rem' }}>
                <span style={{ color: '#666' }}>Sender:</span>
                <span style={{ fontWeight: 'bold' }}>...{receiptDetails.sender.slice(-8)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.85rem' }}>
                <span style={{ color: '#666' }}>Memo/Ref:</span>
                <span style={{ fontWeight: 'bold' }}>{receiptDetails.memo}</span>
              </div>
              
              <div style={{ margin: '20px 0', padding: '15px', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Amount</span>
                <span style={{ fontSize: '2rem', fontWeight: '900', color: '#111' }}>
                  {receiptDetails.amount} <span style={{fontSize: '1rem', color: '#555'}}>{receiptDetails.token}</span>
                </span>
              </div>

              <div style={{ textAlign: 'center', fontSize: '0.65rem', color: '#999', wordBreak: 'break-all' }}>
                TxID: {receiptDetails.txId}
              </div>
            </div>

            <div style={{ padding: '20px', background: '#f1f1f1', display: 'flex', gap: '10px', borderTop: '1px solid #ddd' }}>
              <button onClick={() => window.print()} style={{ flex: 1, padding: '12px', background: '#333', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>🖨️ Print</button>
              <button onClick={() => handleShareReceipt(receiptDetails)} style={{ flex: 1, padding: '12px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>📤 Share</button>
            </div>
            
            <button onClick={() => setReceiptTx(null)} style={{ width: '100%', padding: '15px', background: 'transparent', color: '#555', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Close</button>
          </div>
        </div>
      )}

    </div>
  );
}
