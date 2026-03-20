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
  const [tokenContract, setTokenContract] = useState(process.env.NEXT_PUBLIC_SBTC_CONTRACT || '');

  useEffect(() => {
    const user = getUserData() as any;
    if (user && user.profile) {
      setUserData(user);
      const address = user.profile.stxAddress.mainnet;
      refreshData(address);
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
    } catch (err) {
      console.error("Connection failed", err);
    }
  };

  const fetchTransactionHistory = async (address: string) => {
    if (!address) return;
    try {
      const network = getNetwork();
      const response = await fetch(`${network.coreApiUrl}/extended/v1/address/${address}/transactions?limit=50`);
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
      const response = await fetch(`${network.coreApiUrl}/extended/v1/address/${address}/transactions?limit=50`);
      const data = await response.json();
      const paid = data.results.filter((tx: any) => 
        tx.tx_type === 'contract_call' && 
        tx.tx_status === 'success' &&
        (tx.contract_call.function_name.includes('pay-invoice'))
      );
      setPaidHistory(paid);
    } catch (err) { console.error(err); }
  };

  // --- 📊 CSV EXPORT LOGIC ---
  const downloadCSV = () => {
    if (paidHistory.length === 0) return;

    const headers = ["Date", "Transaction ID", "Type", "Amount", "Status"];
    const rows = paidHistory.map((tx: any) => {
      const date = new Date(tx.burn_block_time * 1000).toLocaleDateString();
      const amountArg = tx.contract_call?.function_args?.find((a: any) => a.name === 'amount');
      const amountVal = amountArg ? Number(amountArg.repr.replace('u', '')) : 0;
      const isSTX = tx.contract_call.function_name.includes('stx');
      const displayAmt = isSTX ? (amountVal / 1000000) : (amountVal / 100000000);
      
      return [
        date,
        tx.tx_id,
        isSTX ? "STX" : "sBTC",
        displayAmt,
        "PAID"
      ];
    });

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `revenue_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const copyPaymentLink = (txId: string) => {
    if (typeof window !== 'undefined') {
      const baseUrl = window.location.origin;
      const paymentUrl = `${baseUrl}/pay/${txId}`;
      navigator.clipboard.writeText(paymentUrl);
      alert("Payment link copied!");
    }
  };

  const createInvoice = async () => {
    if (!amount || isNaN(Number(amount)) || loading || !userData) return;
    setLoading(true);
    try {
      const amt = BigInt(amount);
      const args = buildCreateInvoiceArgs(amt, token, token === 'sBTC' ? tokenContract.trim() : undefined, memo.trim());
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
          setTimeout(() => refreshData(userData.profile.stxAddress.mainnet), 2000);
        },
        onCancel: () => setLoading(false)
      });
    } catch (error) {
      console.error("Creation failed:", error);
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
      
      {userData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div className="card shadow" style={{ textAlign: 'center', borderBottom: '4px solid #fc6432' }}>
            <label style={{ fontSize: '0.6rem', opacity: 0.5 }}>STX REVENUE</label>
            <h2 style={{ margin: '5px 0', color: '#fc6432' }}>{totals.stx.toFixed(2)}</h2>
          </div>
          <div className="card shadow" style={{ textAlign: 'center', borderBottom: '4px solid #f7931a' }}>
            <label style={{ fontSize: '0.6rem', opacity: 0.5 }}>sBTC REVENUE</label>
            <h2 style={{ margin: '5px 0', color: '#f7931a' }}>{totals.sbtc.toFixed(8)}</h2>
          </div>
        </div>
      )}

      <div className="card shadow">
        <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>Merchant Portal</h2>
        
        {/* Wallet UI omitted for brevity - keep your existing one */}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', opacity: userData ? 1 : 0.4, pointerEvents: userData ? 'auto' : 'none' }}>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (Sats/uSTX)" />
          <div style={{ display: 'flex', gap: '10px' }}>
            <select value={token} onChange={e => setToken(e.target.value)} style={{ flex: 1 }}>
              <option value="sBTC">sBTC</option>
              <option value="STX">STX</option>
            </select>
            <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="Memo" style={{ flex: 2 }} />
          </div>
          <button className="primary" onClick={createInvoice} disabled={loading || !userData || !amount}>
            {loading ? 'Check Wallet...' : 'Generate Link'}
          </button>
        </div>
      </div>

      <div className="card shadow" style={{ marginTop: 24, borderLeft: '4px solid #fc6432' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>📋 Open Invoices</h3>
          <button onClick={() => userData && refreshData(userData.profile.stxAddress.mainnet)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>🔄</button>
        </div>
        {/* ... (Open invoices list) ... */}
      </div>

      <div className="card shadow" style={{ marginTop: 24, borderLeft: '4px solid #28a745' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, color: '#28a745' }}>✅ Closed Invoices</h3>
          {paidHistory.length > 0 && (
            <button 
              onClick={downloadCSV}
              style={{ fontSize: '0.7rem', padding: '4px 8px', background: 'rgba(40, 167, 69, 0.1)', color: '#28a745', border: '1px solid #28a745', cursor: 'pointer', borderRadius: '4px' }}
            >
              Export CSV 📥
            </button>
          )}
        </div>
        {paidHistory.length === 0 ? <p style={{ opacity: 0.5, fontSize: '0.8rem', marginTop: 10 }}>No paid invoices.</p> : (
          paidHistory.map((tx: any) => (
            <div key={tx.tx_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '0.8rem', color: '#28a745' }}>PAID</div>
              <a href={`https://explorer.hiro.so/txid/${tx.tx_id}?chain=mainnet`} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', color: '#5546ff' }}>View Receipt</a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
