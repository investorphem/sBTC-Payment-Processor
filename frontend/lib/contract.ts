import {
  callReadOnlyFunction,
  uintCV,
  bufferCV,
  noneCV,
  someCV,
  contractPrincipalCV,
  cvToValue,
} from '@stacks/transactions';
import { getNetwork } from './network';

export const CONTRACT_NAME =
  process.env.NEXT_PUBLIC_CONTRACT_NAME || 'sbtc-payment-processor';

export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';

/**
 * Fetches invoice details and unwraps the Clarity Response (ok/err)
 * so the frontend receives a clean JavaScript object.
 */
export async function readInvoice(id: number) {
  try {
    const res = await callReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'get-invoice',
      functionArgs: [uintCV(id)],
      // Fallback to a standard development address for read-only calls
      senderAddress: CONTRACT_ADDRESS || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      network: getNetwork(),
    });

    const result = cvToValue(res);

    // ✅ Logic: Clarity returns (ok {data}) which cvToValue turns into { value: {data} }.
    // This unwraps it so invoice.token and invoice.amount are directly accessible.
    if (result && typeof result === 'object' && 'value' in result) {
      return result.value;
    }

    return result;
  } catch (err) {
    console.error("Error reading invoice:", err);
    return null;
  }
}

/**
 * Prepares the arguments for the 'create-invoice' contract call.
 */
export function buildCreateInvoiceArgs(
  amount: number | bigint,
  token: string,
  tokenContract?: string,
  memo?: string
) {
  // 1. Amount and Token Buffer
  // ✅ FIX: toUpperCase() ensures "stx" becomes "STX" (0x535458)
  const args: any[] = [
    uintCV(amount),
    bufferCV(Buffer.from(token.trim().toUpperCase())), 
  ];

  // 2. Handle the Token Contract Principal (Optional)
  if (tokenContract && tokenContract.includes('.')) {
    const [address, name] = tokenContract.trim().split('.');
    if (address && name) {
      args.push(someCV(contractPrincipalCV(address, name)));
    } else {
      args.push(noneCV());
    }
  } else {
    args.push(noneCV());
  }

  // 3. Ensure memo buffer is exactly 34 bytes
  if (memo && memo.trim() !== '') {
    const cleanedMemo = memo.trim();
    const memoBuf = Buffer.alloc(34); // Fixed size for Clarity (buff 34)
    memoBuf.write(cleanedMemo, 'utf8');
    args.push(someCV(bufferCV(memoBuf)));
  } else {
    args.push(noneCV());
  }

  return args;
}
