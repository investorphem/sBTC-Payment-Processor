import { useState, useEffect, useMemo } from 'react';
import { connectWallet, callContract, disconnectWallet, getUserData } from '../lib/wallet';
import { getNetwork } from '../lib/network';
import { NetworkKey, getNetworkConfig } from '../lib/networkConfig';
import {
  getContractInfo,
  buildCreateInvoiceArgs,
  buildSetRoutingRulesArgs,
  readRoutingRules,
  readReserveStx,
  readReserveSbtc,
} from '../lib/contract';
import { contractPrincipalCV } from '@stacks/transactions';
import Link from 'next/link';
import { useFlowVault } from '../hooks/useFlowVault';

export default function Merchant() {
  // 🌐 ACTIVE NETWORK — everything (contract addresses, tokens, FlowVault,
  // which of the wallet's two derived addresses we use) routes off this.
  // Set it to match whatever network your wallet extension is currently on.
  const [activeNetwork, setActiveNetwork] = useState<NetworkKey>('mainnet');
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('sbtc-active-network') : null;
    if (saved === 'mainnet' || saved === 'testnet') setActiveNetwork(saved);
  }, []);
  const switchNetwork = (net: NetworkKey) => {
    setActiveNetwork(net);
    if (typeof window !== 'undefined') window.localStorage.setItem('sbtc-active-network', net);
  };
  const networkConfig = getNetworkConfig(activeNetwork);
  const { address: PAYMENT_CONTRACT_ADDRESS, name: PAYMENT_CONTRACT_NAME } = getContractInfo(activeNetwork);

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [paidHistory, setPaidHistory] = useState([]);

  // 🔔 Advanced Notification State
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // UI & Modal States
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

  // 🏦 TREASURY ROUTING (split % of every payment into a time-locked reserve)
  const [reservePercent, setReservePercent] = useState('0');
  const [lockBlocks, setLockBlocks] = useState('0');
  const [routingSaving, setRoutingSaving] = useState(false);
  const [currentRules, setCurrentRules] = useState<{ reserveBps: number, lockBlocks: number } | null>(null);
  const [reserveStx, setReserveStx] = useState<{ locked: number, unlockHeight: number } | null>(null);
  const [reserveSbtc, setReserveSbtc] = useState<{ locked: number, unlockHeight: number } | null>(null);
  // FlowVault's docs don't specify exact field names for getVaultState()/getRoutingRules()
  // return objects. Rather than guess wrong, try several plausible key spellings and fall
  // back to `undefined` — see the raw data toggle in the UI to confirm the real shape.
  const pickField = (obj: any, keys: string[]): any => {
    if (!obj || typeof obj !== 'object') return undefined;
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) return obj[k];
      // also check one level down, in case the SDK wraps values as { value: ... }
      if (obj[k]?.value !== undefined) return obj[k].value;
    }
    return undefined;
  };
  const [showFvRaw, setShowFvRaw] = useState(false);

  const fvLocked = pickField(flowVault.vaultState, ['lockedAmount', 'locked', 'amountLocked', 'lockAmount']);
  const fvAvailable = pickField(flowVault.vaultState, ['availableAmount', 'available', 'unlockedAmount', 'balance']);
  const fvUnlockBlock = pickField(flowVault.routingRules, ['lockUntilBlock', 'lockUntil', 'unlockBlock', 'lockedUntilBlock'])
    ?? pickField(flowVault.vaultState, ['lockUntilBlock', 'lockUntil', 'unlockBlock', 'lockedUntilBlock']);
  const fvSplitAddr = pickField(flowVault.routingRules, ['splitAddress', 'split_address']);
  const fvSplitAmt = pickField(flowVault.routingRules, ['splitAmount', 'split_amount']);
  const fvBlocksRemaining = (typeof fvUnlockBlock === 'number' && typeof flowVault.blockHeight === 'number')
    ? fvUnlockBlock - flowVault.blockHeight
    : null;

  const [currentBlockHeight, setCurrentBlockHeight] = useState<number | null>(null);
  const [withdrawing, setWithdrawing] = useState<'stx' | 'sbtc' | null>(null);

  // 🔗 FLOWVAULT (official SDK integration — testnet only, see networkConfig.ts)
  const merchantAddress = userData?.profile?.stxAddress?.[activeNetwork] || null;
  const flowVault = useFlowVault(merchantAddress, activeNetwork);
  const [fvLockAmount, setFvLockAmount] = useState('');
  const [fvLockUntilBlock, setFvLockUntilBlock] = useState('');
  const [fvSplitAddress, setFvSplitAddress] = useState('');
  const [fvSplitAmount, setFvSplitAmount] = useState('');
  const [fvDepositAmount, setFvDepositAmount] = useState('');
  const [fvWithdrawAmount, setFvWithdrawAmount] = useState('');
  const [fvBusy, setFvBusy] = useState<'rules' | 'deposit' | 'withdraw' | 'clear' | null>(null);

  useEffect(() => {
    if (merchantAddress) flowVault.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantAddress]);

  const handleFvSaveRules = async () => {
    if (!fvLockAmount || !fvLockUntilBlock || fvBusy) return;
    setFvBusy('rules');
    try {
      await flowVault.saveRoutingRules({
        lockAmount: fvLockAmount.trim(),
        lockUntilBlock: Number(fvLockUntilBlock),
        splitAddress: fvSplitAddress.trim() || null,
        splitAmount: fvSplitAmount.trim() || '0',
      });
      showToast('FlowVault routing rule saved! 🔗');
    } catch (err) {
      showToast(flowVault.error || 'Error saving FlowVault routing rule.', 'error');
    } finally {
      setFvBusy(null);
    }
  };

  const handleFvDeposit = async () => {
    if (!fvDepositAmount || fvBusy) return;
    setFvBusy('deposit');
    try {
      await flowVault.deposit(fvDepositAmount.trim());
      setFvDepositAmount('');
      showToast('Deposited into FlowVault! 🏦');
    } catch (err) {
      showToast(flowVault.error || 'Error depositing into FlowVault.', 'error');
    } finally {
      setFvBusy(null);
    }
  };

  const handleFvWithdraw = async () => {
    if (!fvWithdrawAmount || fvBusy) return;
    setFvBusy('withdraw');
    try {
      await flowVault.withdraw(fvWithdrawAmount.trim());
      setFvWithdrawAmount('');
      showToast('Withdrawal from FlowVault broadcast! ✅');
    } catch (err) {
      showToast(flowVault.error || 'Error withdrawing from FlowVault.', 'error');
    } finally {
      setFvBusy(null);
    }
  };

  const handleFvClearRules = async () => {
    if (fvBusy) return;
    setFvBusy('clear');
    try {
      await flowVault.clearRules();
      showToast('FlowVault routing rule cleared.');
    } catch (err) {
      showToast(flowVault.error || 'Error clearing FlowVault routing rule.', 'error');
    } finally {
      setFvBusy(null);
    }
  };

  useEffect(() => {
    const user = getUserData() as any;
    if (user && user.profile) {
      setUserData(user);
      const addr = user.profile.stxAddress?.[activeNetwork];
      if (addr) {
        refreshData(addr);
        refreshTreasury(addr);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNetwork]);

  const asNum = (v: any, key: string): number => {
    if (!v) return 0;
    const raw = v[key];
    if (raw === undefined) return 0;
    const val = raw.value !== undefined ? raw.value : raw;
    return Number(String(val).replace('u', '')) || 0;
  };

  const refreshTreasury = async (address: string) => {
    if (!address) return;
    try {
      const [rules, resStx, resSbtc, blockRes] = await Promise.all([
        readRoutingRules(address, activeNetwork),
        readReserveStx(address, activeNetwork),
        readReserveSbtc(address, activeNetwork),
        fetch(`${getNetwork(activeNetwork).coreApiUrl}/v2/info`).then(r => r.json()).catch(() => null),
      ]);
      if (rules) {
        setCurrentRules({
          reserveBps: asNum(rules, 'reserve-bps'),
          lockBlocks: asNum(rules, 'lock-blocks'),
        });
      }
      if (resStx) setReserveStx({ locked: asNum(resStx, 'locked'), unlockHeight: asNum(resStx, 'unlock-height') });
      if (resSbtc) setReserveSbtc({ locked: asNum(resSbtc, 'locked'), unlockHeight: asNum(resSbtc, 'unlock-height') });
      if (blockRes?.stacks_tip_height) setCurrentBlockHeight(blockRes.stacks_tip_height);
    } catch (err) { console.error('Error loading treasury state:', err); }
  };

  const saveRoutingRules = async () => {
    if (!userData || routingSaving) return;
    if (!PAYMENT_CONTRACT_ADDRESS) {
      showToast(`No payment contract deployed on ${networkConfig.label} yet.`, 'error');
      return;
    }
    const pct = Number(reservePercent);
    const blocks = Number(lockBlocks);
    if (isNaN(pct) || pct < 0 || pct > 100 || isNaN(blocks) || blocks < 0) {
      showToast('Enter a reserve % (0-100) and a valid block count.', 'error');
      return;
    }
    setRoutingSaving(true);
    try {
      await callContract({
        contractAddress: PAYMENT_CONTRACT_ADDRESS,
        contractName: PAYMENT_CONTRACT_NAME,
        functionName: 'set-routing-rules',
        functionArgs: buildSetRoutingRulesArgs(pct, blocks),
        network: getNetwork(activeNetwork),
        onFinish: () => {
          setRoutingSaving(false);
          showToast('Treasury routing rule saved! 🏦');
          setTimeout(() => refreshTreasury(merchantAddress), 3000);
        },
        onCancel: () => {
          setRoutingSaving(false);
          showToast('Transaction cancelled.', 'error');
        },
      });
    } catch (err) {
      setRoutingSaving(false);
      showToast('Error saving routing rule.', 'error');
    }
  };

  const withdrawReserve = async (kind: 'stx' | 'sbtc') => {
    if (!userData || withdrawing) return;
    if (!PAYMENT_CONTRACT_ADDRESS) {
      showToast(`No payment contract deployed on ${networkConfig.label} yet.`, 'error');
      return;
    }
    setWithdrawing(kind);
    try {
      const sbtcContract = `${networkConfig.sbtcTokenContractAddress}.${networkConfig.sbtcTokenContractName}`;
      const args = kind === 'stx'
        ? []
        : [contractPrincipalCV(networkConfig.sbtcTokenContractAddress, networkConfig.sbtcTokenContractName)];
      await callContract({
        contractAddress: PAYMENT_CONTRACT_ADDRESS,
        contractName: PAYMENT_CONTRACT_NAME,
        functionName: kind === 'stx' ? 'withdraw-reserve-stx' : 'withdraw-reserve-ft',
        functionArgs: args,
        network: getNetwork(activeNetwork),
        onFinish: () => {
          setWithdrawing(null);
          showToast('Reserve withdrawal broadcast! ✅');
          setTimeout(() => refreshTreasury(merchantAddress), 3000);
        },
        onCancel: () => {
          setWithdrawing(null);
          showToast('Transaction cancelled.', 'error');
        },
      });
    } catch (err) {
      setWithdrawing(null);
      showToast('Error withdrawing reserve.', 'error');
    }
  };

  // 🚀 The Advanced Toast Helper
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500); // Hides after 3.5 seconds
  };

  const handleCopy = (txId: string) => {
    const link = `${window.location.origin}/pay/${txId}${activeNetwork === 'testnet' ? '?network=testnet' : ''}`;
    navigator.clipboard.writeText(link);
    setCopiedId(txId);
    showToast('Payment link copied to clipboard! 🔗');
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
        const addr = user.profile?.stxAddress?.[activeNetwork];
        if (addr) {
          refreshData(addr);
          refreshTreasury(addr);
        }
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
    if (!PAYMENT_CONTRACT_ADDRESS) {
      showToast(`No payment contract deployed on ${networkConfig.label} yet.`, 'error');
      return;
    }
    const finalTokenContract = token === 'sBTC'
      ? `${networkConfig.sbtcTokenContractAddress}.${networkConfig.sbtcTokenContractName}`
      : undefined;
    setLoading(true);
    try {
      const args = buildCreateInvoiceArgs(BigInt(amount), token, finalTokenContract, memo.trim());
      await callContract({
        contractAddress: PAYMENT_CONTRACT_ADDRESS, contractName: PAYMENT_CONTRACT_NAME,
        functionName: 'create-invoice', functionArgs: args, network: getNetwork(activeNetwork),
        onFinish: () => {
          setLoading(false); setAmount(''); setMemo('');
          showToast('Invoice generated successfully! 🎉');
          setTimeout(() => refreshData(merchantAddress), 3000);
        },
        onCancel: () => {
          setLoading(false);
          showToast('Transaction cancelled.', 'error');
        }
      });
    } catch (error) { 
      setLoading(false); 
      showToast('Error creating invoice.', 'error');
    }
  };

  const fetchTransactionHistory = async (address: string) => {
    if (!address || !PAYMENT_CONTRACT_ADDRESS) return;
    try {
      const network = getNetwork(activeNetwork);
      const response = await fetch(`${network.coreApiUrl}/extended/v1/address/${address}/transactions?limit=50&unanchored=true`);
      const data = await response.json();
      const invoices = data.results.filter((tx: any) => 
        tx.tx_type === 'contract_call' && 
        tx.contract_call.contract_id === `${PAYMENT_CONTRACT_ADDRESS}.${PAYMENT_CONTRACT_NAME}` &&
        tx.contract_call.function_name === 'create-invoice' &&
        tx.tx_status !== 'failed'
      );
      setHistory(invoices);
    } catch (err) { console.error(err); }
  };

  const fetchPaidHistory = async (address: string) => {
    if (!address) return;
    try {
      const network = getNetwork(activeNetwork);
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

  // 📄 RECEIPT HELPER
  const getReceiptDetails = (tx: any) => {
    if (!tx) return null;
    const isSTX = tx.contract_call.function_name.includes('stx');

    const amountArg = tx.contract_call?.function_args?.find((a: any) => a.name === 'amount');
    const rawAmount = amountArg ? Number(amountArg.repr.replace('u', '')) : 0;
    const displayAmount = isSTX ? (rawAmount / 1e6).toFixed(2) : (rawAmount / 1e8).toFixed(8);

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

  // 📸 SHARE RECEIPT AS IMAGE
  const handleShareReceiptImage = async () => {
    const receiptElement = document.getElementById('printable-receipt');
    if (!receiptElement) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(receiptElement, { scale: 2, backgroundColor: '#ffffff' });
      const dataUrl = canvas.toDataURL('image/png');
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'receipt.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Payment Receipt',
          text: 'Here is your sBTC Payment Receipt.',
        });
        showToast('Receipt shared successfully!');
      } else {
        const link = document.createElement('a');
        link.download = `Receipt_${receiptDetails?.txId.slice(-6)}.png`;
        link.href = dataUrl;
        link.click();
        showToast('Receipt downloaded successfully!');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      showToast('Could not generate image. Please use Print.', 'error');
    }
  };

  const receiptDetails = getReceiptDetails(receiptTx);

  return (
    <div className="container" style={{ padding: '24px', maxWidth: '600px', margin: '0 auto', position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* 🔔 ADVANCED TOAST NOTIFICATION */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.type === 'success' ? '#28a745' : '#ff4b4b',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '50px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 'bold',
          fontSize: '0.9rem',
          transition: 'all 0.3s ease-in-out'
        }}>
          {toast.type === 'success' ? '✅' : '⚠️'} {toast.message}
        </div>
      )}

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
          <button onClick={() => setShowSupport(true)} style={{ background: 'rgba(85, 70, 255, 0.1)', border: '1px solid #5546ff', color: '#5546ff', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>?</button>
        </div>

        {/* 🌐 NETWORK TOGGLE — set this to match your wallet extension's active network */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', padding: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
            {(['mainnet', 'testnet'] as NetworkKey[]).map((net) => (
              <button
                key={net}
                onClick={() => switchNetwork(net)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '999px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  background: activeNetwork === net ? (net === 'mainnet' ? '#5546ff' : '#f7931a') : 'transparent',
                  color: activeNetwork === net ? '#fff' : 'rgba(255,255,255,0.5)',
                }}
              >
                {net === 'mainnet' ? '🟣 Mainnet' : '🟠 Testnet'}
              </button>
            ))}
          </div>
        </div>
        {userData && !PAYMENT_CONTRACT_ADDRESS && (
          <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#ff4b4b', marginBottom: '16px' }}>
            No payment contract configured for {networkConfig.label} — set NEXT_PUBLIC_CONTRACT_ADDRESS_{activeNetwork.toUpperCase()} in your env.
          </div>
        )}

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

              <div style={{textAlign: 'center', marginBottom: '10px', background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '8px'}}>
                 <p style={{fontSize: '0.75rem', fontWeight: 'bold', margin: '0 0 4px 0', opacity: 0.7}}>
                   Logged in as {merchantAddress ? `${merchantAddress.slice(0, 6)}...${merchantAddress.slice(-4)}` : '—'} <span style={{ opacity: 0.5 }}>({networkConfig.label})</span>
                 </p>
                 <button onClick={handleDisconnect} style={{background: 'none', border: 'none', color: '#ff4b4b', fontSize: '0.65rem', cursor: 'pointer', textDecoration: 'underline'}}>Sign Out</button>
              </div>

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

        {/* 🔗 FLOWVAULT (official SDK integration: flowvault-sdk) — testnet only */}
        {userData && (
          <div className="card shadow" style={{ padding: '24px', marginBottom: '24px', borderLeft: '4px solid #5546FF' }}>
            <h2 style={{ textAlign: 'center', margin: '0 0 6px 0', fontSize: '1.1rem' }}>🔗 FlowVault Treasury</h2>
            <p style={{ textAlign: 'center', fontSize: '0.75rem', opacity: 0.6, margin: '0 0 16px 0' }}>
              Programmable lock &amp; split routing via the FlowVault contract ({process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT_NAME || 'flowvault-v2'}).
            </p>

            {activeNetwork !== 'testnet' ? (
              <div style={{ textAlign: 'center', fontSize: '0.8rem', opacity: 0.7, padding: '20px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                FlowVault only has a testnet deployment right now.<br />
                Flip the toggle above to <strong>🟠 Testnet</strong> to use this section.
              </div>
            ) : (
            <>
            {flowVault.error && (
              <div style={{ fontSize: '0.7rem', color: '#ff4b4b', textAlign: 'center', marginBottom: '12px' }}>{flowVault.error}</div>
            )}

            {/* Routing rule */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input type="number" value={fvLockAmount} onChange={e => setFvLockAmount(e.target.value)} placeholder="Lock amount (base units)" style={{ flex: 1 }} />
              <input type="number" value={fvLockUntilBlock} onChange={e => setFvLockUntilBlock(e.target.value)} placeholder="Lock until block" style={{ flex: 1 }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <input value={fvSplitAddress} onChange={e => setFvSplitAddress(e.target.value)} placeholder="Split address (optional)" style={{ flex: 2 }} />
              <input type="number" value={fvSplitAmount} onChange={e => setFvSplitAmount(e.target.value)} placeholder="Split amount" style={{ flex: 1 }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button className="primary" onClick={handleFvSaveRules} disabled={fvBusy !== null} style={{ flex: 1 }}>
                {fvBusy === 'rules' ? 'Broadcasting...' : 'Save Routing Rule'}
              </button>
              <button onClick={handleFvClearRules} disabled={fvBusy !== null} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}>
                {fvBusy === 'clear' ? '...' : 'Clear Rule'}
              </button>
            </div>

            {/* Deposit / Withdraw */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input type="number" value={fvDepositAmount} onChange={e => setFvDepositAmount(e.target.value)} placeholder="Amount" style={{ flex: 1 }} />
                <button onClick={handleFvDeposit} disabled={fvBusy !== null} className="secondary" style={{ fontSize: '0.7rem' }}>
                  {fvBusy === 'deposit' ? '...' : 'Deposit'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input type="number" value={fvWithdrawAmount} onChange={e => setFvWithdrawAmount(e.target.value)} placeholder="Amount" style={{ flex: 1 }} />
                <button
                  onClick={handleFvWithdraw}
                  disabled={fvBusy !== null || (fvBlocksRemaining !== null && fvBlocksRemaining > 0)}
                  className="secondary"
                  style={{ fontSize: '0.7rem' }}
                >
                  {fvBusy === 'withdraw'
                    ? '...'
                    : (fvBlocksRemaining !== null && fvBlocksRemaining > 0)
                      ? `Locked (${fvBlocksRemaining})`
                      : 'Withdraw'}
                </button>
              </div>
            </div>

            {/* Live state */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.7rem', opacity: 0.8, marginBottom: '12px' }}>
              <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                <div style={{ opacity: 0.5 }}>LOCKED AMOUNT</div>
                <div style={{ fontWeight: 'bold' }}>
                  {flowVault.loading ? '...' : (fvLocked !== undefined ? String(fvLocked) : (flowVault.hasLocked ? 'Locked (amount unknown)' : '0'))}
                </div>
              </div>
              <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                <div style={{ opacity: 0.5 }}>AVAILABLE</div>
                <div style={{ fontWeight: 'bold' }}>{flowVault.loading ? '...' : (fvAvailable !== undefined ? String(fvAvailable) : '—')}</div>
              </div>
              <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                <div style={{ opacity: 0.5 }}>UNLOCKS AT BLOCK</div>
                <div style={{ fontWeight: 'bold' }}>
                  {fvUnlockBlock !== undefined ? fvUnlockBlock : '—'}
                  {fvBlocksRemaining !== null && (
                    <div style={{ fontSize: '0.6rem', opacity: 0.6, fontWeight: 'normal', marginTop: '2px' }}>
                      {fvBlocksRemaining > 0 ? `${fvBlocksRemaining} blocks remaining` : 'unlocked'}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                <div style={{ opacity: 0.5 }}>BLOCK HEIGHT</div>
                <div style={{ fontWeight: 'bold' }}>{flowVault.blockHeight ?? '—'}</div>
              </div>
              {(fvSplitAddr || fvSplitAmt) && (
                <div style={{ gridColumn: '1 / -1', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                  <div style={{ opacity: 0.5 }}>SPLIT RULE</div>
                  <div style={{ fontWeight: 'bold' }}>{fvSplitAmt || 0} → {fvSplitAddr ? `${String(fvSplitAddr).slice(0, 6)}...${String(fvSplitAddr).slice(-4)}` : '—'}</div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowFvRaw(!showFvRaw)}
              style={{ width: '100%', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', cursor: 'pointer', textDecoration: 'underline', marginBottom: showFvRaw ? '8px' : 0 }}
            >
              {showFvRaw ? 'Hide raw vault data' : 'Show raw vault data (debug)'}
            </button>
            {showFvRaw && (
              <pre style={{ fontSize: '0.6rem', background: 'rgba(0,0,0,0.4)', padding: '10px', borderRadius: '8px', overflowX: 'auto', color: '#0f0' }}>
{JSON.stringify({ vaultState: flowVault.vaultState, routingRules: flowVault.routingRules }, null, 2)}
              </pre>
            )}
            </>
            )}
          </div>
        )}

        {/* 🏦 LOCAL RESERVE (native fallback, no external dependency — see README) */}
        {userData && (
          <div className="card shadow" style={{ padding: '24px', marginBottom: '24px', borderLeft: '4px solid #f7931a' }}>
            <h2 style={{ textAlign: 'center', margin: '0 0 6px 0', fontSize: '1.1rem' }}>🏦 Local Reserve (Fallback)</h2>
            <p style={{ textAlign: 'center', fontSize: '0.75rem', opacity: 0.6, margin: '0 0 20px 0' }}>
              Same lock/split idea, built directly into this contract — no external dependency.
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <input
                type="number" min="0" max="100" value={reservePercent}
                onChange={e => setReservePercent(e.target.value)}
                placeholder="Reserve %" style={{ flex: 1 }}
              />
              <input
                type="number" min="0" value={lockBlocks}
                onChange={e => setLockBlocks(e.target.value)}
                placeholder="Lock (blocks)" style={{ flex: 1 }}
              />
            </div>
            <button className="primary" onClick={saveRoutingRules} disabled={routingSaving} style={{ width: '100%', marginBottom: '16px' }}>
              {routingSaving ? 'Broadcasting...' : 'Save Routing Rule'}
            </button>

            {currentRules && (
              <div style={{ fontSize: '0.75rem', opacity: 0.7, textAlign: 'center', marginBottom: '16px' }}>
                Current rule: locking <strong>{(currentRules.reserveBps / 100).toFixed(1)}%</strong> of every payment for <strong>{currentRules.lockBlocks}</strong> blocks.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                <label style={{ fontSize: '0.6rem', opacity: 0.5 }}>LOCKED STX</label>
                <div style={{ fontWeight: 'bold', margin: '4px 0' }}>{((reserveStx?.locked || 0) / 1e6).toFixed(4)}</div>
                <button
                  onClick={() => withdrawReserve('stx')}
                  disabled={!reserveStx?.locked || withdrawing !== null || (currentBlockHeight !== null && currentBlockHeight < (reserveStx?.unlockHeight || 0))}
                  style={{ fontSize: '0.65rem', padding: '6px 10px', borderRadius: '6px', border: '1px solid #f7931a', background: 'rgba(247,147,26,0.1)', color: '#f7931a', cursor: 'pointer' }}
                >
                  {currentBlockHeight !== null && reserveStx && currentBlockHeight < reserveStx.unlockHeight
                    ? `Unlocks in ${reserveStx.unlockHeight - currentBlockHeight} blocks`
                    : 'Withdraw'}
                </button>
              </div>
              <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                <label style={{ fontSize: '0.6rem', opacity: 0.5 }}>LOCKED sBTC</label>
                <div style={{ fontWeight: 'bold', margin: '4px 0' }}>{((reserveSbtc?.locked || 0) / 1e8).toFixed(8)}</div>
                <button
                  onClick={() => withdrawReserve('sbtc')}
                  disabled={!reserveSbtc?.locked || withdrawing !== null || (currentBlockHeight !== null && currentBlockHeight < (reserveSbtc?.unlockHeight || 0))}
                  style={{ fontSize: '0.65rem', padding: '6px 10px', borderRadius: '6px', border: '1px solid #f7931a', background: 'rgba(247,147,26,0.1)', color: '#f7931a', cursor: 'pointer' }}
                >
                  {currentBlockHeight !== null && reserveSbtc && currentBlockHeight < reserveSbtc.unlockHeight
                    ? `Unlocks in ${reserveSbtc.unlockHeight - currentBlockHeight} blocks`
                    : 'Withdraw'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 🔍 SEARCH & LISTS */}
        <div style={{ marginBottom: '20px', position: 'relative' }}>
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search invoices..." style={{ width: '100%', padding: '12px 40px 12px 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white' }}/>
        </div>

        {/* 📋 OPEN INVOICES */}
        <div className="card shadow" style={{ padding: '20px', marginBottom: '24px', borderLeft: '4px solid #5546FF' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem' }}>📋 Open Invoices ({filteredOpen.length})</h3>
          <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
            {filteredOpen.map((tx: any) => {
              const paymentLink = typeof window !== 'undefined' ? `${window.location.origin}/pay/${tx.tx_id}${activeNetwork === 'testnet' ? '?network=testnet' : ''}` : '';
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
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button 
                    onClick={() => setReceiptTx(tx)} 
                    style={{ background: 'rgba(40, 167, 69, 0.1)', color: '#28a745', border: '1px solid #28a745', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Receipt 📄
                  </button>
                  <a href={`https://explorer.hiro.so/txid/${tx.tx_id}?chain=mainnet`} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', color: '#5546ff', textDecoration: 'none' }}>Explorer ↗</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 🦶 FOOTER */}
      <footer style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <span onClick={() => setShowHowItWorks(true)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>How it Works</span>
          <span onClick={() => setShowSupport(true)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Support</span>
          <span onClick={() => setShowTerms(true)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Terms</span>
          <span onClick={() => setShowPrivacy(true)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Privacy</span>
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

      {/* --- 📄 RECEIPT MODAL --- */}
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

              <button onClick={handleShareReceiptImage} style={{ flex: 1, padding: '12px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>📤 Share Image</button>
            </div>

            <button onClick={() => setReceiptTx(null)} style={{ width: '100%', padding: '15px', background: 'transparent', color: '#555', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Close</button>
          </div>
        </div>
      )}

    </div>
  );
}