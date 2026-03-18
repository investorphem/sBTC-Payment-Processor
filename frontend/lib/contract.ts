import {
  callReadOnlyFunction,
  uintCV,
  bufferCV,
  noneCV,
  someCV,
  standardPrincipalCV,
  contractPrincipalCV, // ✅ Added this import
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
  // ✅ Ensure token buffer is exactly 12 bytes
  const tokenBuf = Buffer.alloc(12);
  tokenBuf.write(token);

  const args: any[] = [
    uintCV(amount),
    bufferCV(tokenBuf),
  ]

  // ✅ FIX: Handle the Principal string correctly
  if (tokenContract && tokenContract.trim() !== '') {
    const cleanAddress = tokenContract.trim();
    
    if (cleanAddress.includes('.')) {
      // It's a contract (e.g., SM3VDVW...sbtc-token)
      const [address, name] = cleanAddress.split('.');
      args.push(someCV(contractPrincipalCV(address, name)));
    } else {
      // It's a standard wallet address
      args.push(someCV(standardPrincipalCV(cleanAddress)));
    }
  } else {
    args.push(noneCV())
  }

  // ✅ Ensure memo buffer is exactly 34 bytes
  if (memo) {
    const memoBuf = Buffer.alloc(34);
    memoBuf.write(memo);
    args.push(someCV(bufferCV(memoBuf)))
  } else {
    args.push(noneCV())
  }

  return args;
}
