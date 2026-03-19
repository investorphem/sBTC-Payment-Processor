import {
  callReadOnlyFunction,
  uintCV,
  bufferCV,
  noneCV,
  someCV,
  standardPrincipalCV,
  contractPrincipalCV,
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
  // ✅ FIX: Use a dynamic buffer size for the token.
  // Your contract checks (is-eq token 0x535458). 
  // 0x535458 is exactly 3 bytes. Buffer.from(token) provides exactly what is needed.
  const args: any[] = [
    uintCV(amount),
    bufferCV(Buffer.from(token)), 
  ]

  // ✅ Handle the Token Contract Principal
  if (tokenContract && tokenContract.trim().includes('.')) {
    const cleanAddress = tokenContract.trim();
    const [address, name] = cleanAddress.split('.');
    args.push(someCV(contractPrincipalCV(address, name)));
  } else {
    args.push(noneCV())
  }

  // ✅ Ensure memo buffer is 34 bytes (matching contract definition)
  if (memo && memo.trim() !== '') {
    const memoBuf = Buffer.alloc(34);
    memoBuf.write(memo.trim());
    args.push(someCV(bufferCV(memoBuf)))
  } else {
    args.push(noneCV())
  }

  return args;
}
