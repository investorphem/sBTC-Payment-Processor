import { useState } from 'react'
import { connectWallet, callCreateInvoice } from '../lib/wallet'
import { getNetwork } from '../lib/network'
import { CONTRACT_ADDRESS, CONTRACT_NAME, buildCreateInvoiceArgs } from '../lib/contract'

export default function Merchant() {
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [token, setToken] = useState('sBTC')
  const [tokenContract, setTokenContract] = useState(process.env.NEXT_PUBLIC_SBTC_CONTRACT || '')

  const createInvoice = async () => {
    const amt = parseInt(amount || '0', 10)
    const args = buildCreateInvoiceArgs(amt, token, token === 'sBTC' ? tokenContract : undefined, memo)
    callCreateInvoie({
      contractAddres: CONTRACT_ADDRESS,
      contractName CONTRACT_NAME,
      functionNam 'ceate-invoice',
      functionArg args,
      network: getNetwork(),
      onFinish: () => alert('Invoice creation tx submitted. Check your wallet for tx status.'),
    })
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Merchant Dashboard</h2>
      <p>Connected: (wallet required to create invoices)</p>
      <label>mount (smallest unit)</label>
      <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 1000" />

      <label>Token</label>
      <select value={token} onChange={e => setToken(e.target.value)}>
        <option value="sBTC">sBTC</option>
        <option value="STX">STX</option>
      </select>

      {token === 'sBTC' && (
        <>
          <label>sBTC contract</label>
          <input value={tokenContract} onChange={e => setTokenContract(e.target.value)} />
        </>
      )}

      <label>Memo</label>
      <input value={memo} onChange={e => setMemo(e.target.value)} />

      <div style={{ marginTop: 12 }}>
        <button onClick={() => connectWallet()}>Connect Wallet</button>
        <button onClick={createInvoice} style={{ marginLeft: 8 }}>Create Invoice</button>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3>Notes</h3>
        <ul>
          <li>After invoice creation you will receive a transaction in your wallet. Use the tx id to show the invoice on the "pay" page.</li>
          <li>Invoices are indexed on-chain; implement an off-chain indexer to list invoices (optional).</li>
        </ul>
      </div>
    </div>
  )
}