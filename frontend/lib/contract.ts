import {
  callReadOnlyFunction,
  uintCV,
  bufferCV,
  noneCV,
  someCV,
  principalCV,
  cvToValue,
} from '@stacks/transactions';
import { getNetwork } from './network';

export const CONTRACT_NAME = process.env.NEXT_PUBLIC_CONTRACT_NAME || 'sbtc-payment-processor';
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';

export async function readInvoice(id: number) {
  try {
    const res = await callReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'get-invoice',
      functionArgs: [uintCV(id)],
      senderAddress: CONTRACT_ADDRESS || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      network: getNetwork(),
    });
    const result = cvToValue(res);
    return result?.value || result;
  } catch (err) {
    console.error("Error reading invoice:", err);
    return null;
  }
}

/**
 * ✅ FIX: Uses principalCV for (optional principal) and hex-compatible buffers
 */
export function buildCreateInvoiceArgs(
  amount: number | string | bigint,
  token: string,
  tokenContract?: string,
  memo?: string
) {
  // 1. Amount and Token (Force to (buff 12))
  const args: any[] = [
    uintCV(BigInt(amount)),
    bufferCV(Buffer.from(token.trim().toUpperCase())) 
  ];

  // 2. Token Contract (Corrected to principalCV for broad principal compatibility)
  if (tokenContract && tokenContract.includes('.')) {
    args.push(someCV(principalCV(tokenContract.trim())));
  } else {
    args.push(noneCV());
  }

  // 3. Memo (Strict 34-byte buffer truncation)
  if (memo && memo.trim() !== '') {
    const memoBuffer = Buffer.from(memo.trim()).slice(0, 34);
    args.push(someCV(bufferCV(memoBuffer)));
  } else {
    args.push(noneCV());
  }

  return args;
}
