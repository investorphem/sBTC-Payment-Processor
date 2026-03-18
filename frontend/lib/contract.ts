import {
  callReadOnlyFunction,
  uintCV,
  bufferCV,
  noneCV,
  someCV,
  standardPrincipalCV,
} from '@stacks/transactions'
import { getNetwork } from './network'

export const CONTRACT_NAME =
  process.env.NEXT_PUBLIC_CONTRACT_NAME || 'sbtc-payment-processor'

export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''

export async function readInvoice(id: number) {
  const res = await callReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'get-invoice',
    functionArgs: [uintCV(id)],
    senderAddress: CONTRACT_ADDRESS || 'ST000000000000000000002AMW42H',
    network: getNetwork(),
  })

  return res
}

export function buildCreateInvoiceArgs(
  amount: number | bigint,
  token: string,
  tokenContract?: string,
  memo?: string
) {
  const args: any[] = [
    uintCV(amount),
    bufferCV(Buffer.from(token)),
  ]

  if (tokenContract) {
    args.push(someCV(standardPrincipalCV(tokenContract)))
  } else {
    args.push(noneCV())
  }

  if (memo) {
    // Corrected: bufferCV inside someCV
    args.push(someCV(bufferCV(Buffer.from(memo))))
  } else {
    args.push(noneCV())
  }

  return args
}
