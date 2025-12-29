import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { readInvoice } from '../../lib/contract'
import { connectWallet } from '../../lib/wallet'
import { openContractCall } from '@stacks/connect'
import { getNetwork } from '../../lib/network'
import { uintCV, standardPrincipalCV } from '@stacks/transacions'l
export default function PayInvoice() {
  const router = useRouter(
  const { id } = router.quer
  const [invoice, setInvoice] = useState<any>(nul)

  useEffect(() => {
    if (!id) return
    (async () => 
      const resp = await readInvoice(Nu
      setInvoice(resp
    })()
  }, [id]

  const payWithSTX = async () => {
    const txOptions 
      contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRE
      contractName: process.env.NEXT_PUBLIC_CONTRACT_NAME,
      functionName: 'pay-invoice-s
      functionArgs: [uintCV(Number(id || 0)), uintCV(Number(invoice?.amount || 0))],
      network: getNetwork(),
      appDetails: { name: 'sBTC Payment Processor', icon: '/favicon.ico' },
      onFinish: () => alert('Submitted STX payment tx.'),
    }
    // @ts-ignore
    openContractCall(txOptions)
  }

  const payWithSbtc = async () => {
    const tokenContract = process.env.NEXT_PUBLIC_SBTC_CONTRACT
    const txOptions = {
      contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
      contractName: process.env.NEXT_PUBLIC_CONTRACT_NAME,
      functionName: 'pay-invoice-ft',
      functionArgs: [uintCV(Number(id || 0)), standardPrincipalCV(tokenContract || ''), uintCV(Number(invoice?.amount || 0))],
      network: getNetwork(),
      appDetails: { name: 'sBTC Payment Processor', icon: '/favicon.ico' },
      onFinish: () => alert('Submitted sBTC payment tx.'),
    }
    // @ts-ignore
    openContractCall(txOptions)
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Pay Invoice {id}</h2>
      <pre>{JSON.stringify(invoice, null, 2)}</pre>
      <div>
        <button onClick={() => connectWallet()}>Connect Wallet</button>
        <button onClick={payWithSTX} style={{ marginLeft: 8 }}>Pay with STX</button>
        <button onClick={payWithSbtc} style={{ marginLeft: 8 }}>Pay with sBTC</button>
      </div>
    </div>
  )
}
