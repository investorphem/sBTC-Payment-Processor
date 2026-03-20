import { useState, useEffect } from 'react';
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

  const openInvoices = history.filter((tx: any) => {
    const isAlreadyPaid = paidHistory.some(paidTx => 
       paidTx.contract_call.function_args?.some((arg: any) => arg.repr.includes(tx.tx_id))
    );
    return !isAlreadyPaid;
  });

  const totals = paidHistory.reduce((acc: any, tx: any) => {
    const amountArg = tx.contract_call?.function_args?.find((a: any) => a.name === 'amount');
    const amountVal = amountArg ? Number(amountArg.repr.replace('u', '')) : 0;
    if (tx.contract_call.function_name.includes('stx')) {
        acc.stx += amountVal / 1000000;
    } else {
        acc.sbtc += amountVal / 100000000;
    }
    return acc;
  }, { stx: 0, sbtc: 0 });

  const downloadCSV = () => {
    if (paidHistory.length === 0) return;
    const headers = ["Date", "TX ID", "Asset", "Amount", "Status"];
    const rows = paidHistory.map((tx: any) => {
      const date = tx.burn_block_time ? new Date(tx.burn_block_time * 1000).toLocaleDateString() : "Pending";
      const isSTX = tx.contract_call.function_name.includes('stx');
      const amountArg = tx.contract_call?.function_args?.find((a: any) => a.name === 'amount');
      const amountVal = amountArg ? Number(amountArg.repr.replace('u', '')) : 0;
      const displayAmt = isSTX ? (amountVal / 1e6) : (amountVal / 1e8);
      return [date, tx.tx_id, isSTX ? "STX" : "sBTC", displayAmt, "PAID"];
    });
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sbtc_pay_revenue.csv`;
    link.click();
  };

  const createInvoice = async () => {
    if (!amount || isNaN(Number(amount)) || loading || !userData) return;
    const finalTokenContract = token === 'sBTC' ? (tokenContract || SBTC_MAINNET).trim() : undefined;
    setLoading(true);
    try {
      const args = buildCreateInvoiceArgs(BigInt(amount), token, finalTokenContract, memo.trim());
      await callCreateInvoice({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'create-invoice',
        functionArgs: args,
        network: getNetwork(),
        onFinish: () => {
          setLoading(false);
          setAmount('');
          setMemo('');
          setTimeout(() => refreshData(userData.profile.stxAddress.mainnet), 3000);
        },
        onCancel: () => setLoading(false)
      });
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const copyPaymentLink = (txId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/pay/${txId}`);
    alert("Payment link copied!");
  };

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
      
      {/* 🏆 REVENUE OVERVIEW */}
      {userData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div className="card shadow" style={{ textAlign: 'center', borderTop: '4px solid #fc6432', padding: '20px' }}>
            <label style={{ fontSize: '0.65rem', opacity: 0.6, letterSpacing: '1px' }}>STX REVENUE</label>
            <h2 style={{ margin: '8px 0 0 0', color: '#fc6432' }}>{totals.stx.toFixed(2)}</h2>
          </div>
          <div className="card shadow" style={{ textAlign: 'center', borderTop: '4px solid #f7931a', padding: '20px' }}>
            <label style={{ fontSize: '0.65rem', opacity: 0.6, letterSpacing: '1px' }}>sBTC REVENUE</label>
            <h2 style={{ margin: '8px 0 0 0', color: '#f7931a' }}>{totals.sbtc.toFixed(6)}</h2>
          </div>
        </div>
      )}

      {/* ⚡ MERCHANT ACTIONS */}
      <div className="card shadow" style={{ padding: '28px', marginBottom: '24px' }}>
        <h2 style={{ textAlign: 'center', margin: '0 0 24px 0' }}>⚡ sBTC Merchant</h2>

        {!userData ? (
          <button className="primary" onClick={handleConnect} style={{ width: '100%' }}>Connect Wallet</button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (Sats or uSTX)" />
            <div style={{ display: 'flex', gap: '10px' }}>
              <select value={token} onChange={e => setToken(e.target.value)} style={{ flex: 1 }}>
                <option value="sBTC">sBTC</option>
                <option value="STX">STX</option>
              </select>
              <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="Order Memo" style={{ flex: 2 }} />
            </div>
            <button className="primary" onClick={createInvoice} disabled={loading || !amount}>
              {loading ? 'Check Wallet...' : 'Generate Payment Link'}
            </button>
            <button className="secondary" onClick={() => { disconnectWallet(); setUserData(null); }} style={{ fontSize: '0.7rem' }}>Disconnect {userData.profile.stxAddress.mainnet.slice(0, 5)}...</button>
          </div>
        )}
      </div>

      {/* 📋 OPEN INVOICES */}
      <div className="card shadow" style={{ padding: '20px', marginBottom: '24px', borderLeft: '4px solid #fc6432' }}>
        <h3 style={{ margin: '0 0 15px 0' }}>📋 Open Invoices</h3>
        {openInvoices.length === 0 ? <p style={{ opacity: 0.5, fontSize: '0.8rem' }}>No pending invoices found.</p> : (
          openInvoices.map((tx: any) => (
            <div key={tx.tx_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Invoice {tx.tx_id.slice(-6)}</span>
              <button className="secondary" onClick={() => copyPaymentLink(tx.tx_id)} style={{ padding: '5px 12px', fontSize: '0.75rem' }}>Copy Link 🔗</button>
            </div>
          ))
        )}
      </div>

      {/* ✅ PAID INVOICES */}
      <div className="card shadow" style={{ padding: '20px', borderLeft: '4px solid #28a745' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, color: '#28a745' }}>✅ Paid Invoices</h3>
          {paidHistory.length > 0 && (
            <button onClick={downloadCSV} style={{ fontSize: '0.7rem', padding: '4px 8px', background: 'rgba(40, 167, 69, 0.1)', color: '#28a745', border: '1px solid #28a745', cursor: 'pointer', borderRadius: '4px' }}>
              Export CSV
            </button>
          )}
        </div>
        {paidHistory.length === 0 ? <p style={{ opacity: 0.5, fontSize: '0.8rem' }}>No payments received yet.</p> : (
          paidHistory.map((tx: any) => (
            <div key={tx.tx_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{tx.contract_call.function_name.includes('stx') ? 'STX' : 'sBTC'} Payment</div>
                <div style={{ fontSize: '0.65rem', opacity: 0.4 }}>{new Date(tx.burn_block_time * 1000).toLocaleDateString()}</div>
              </div>
              <a href={`https://explorer.hiro.so/txid/${tx.tx_id}?chain=mainnet`} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#5546ff', textDecoration: 'none' }}>View ↗</a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
