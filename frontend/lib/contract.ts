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

export async function readInvoice(id: number) {
  try {
    const res = await callReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'get-invoice',
      functionArgs: [uintCV(id)],
      // Fallback to a standard burner address if CONTRACT_ADDRESS is missing
      senderAddress: CONTRACT_ADDRESS || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      network: getNetwork(),
    });
    return cvToValue(res);
  } catch (err) {
    console.error("Error reading invoice:", err);
    return null;
  }
}

export function buildCreateInvoiceArgs(
  amount: number | bigint,
  token: string,
  tokenContract?: string,
  memo?: string
) {
  // 1. Amount and Token Buffer (e.g., "STX" or "sBTC")
  const args: any[] = [
    uintCV(amount),
    bufferCV(Buffer.from(token)), 
  ];

  // 2. Handle the Token Contract Principal (Optional)
  // Expects format: "SP...address.contract-name"
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

  // 3. Ensure memo buffer is exactly 34 bytes (matching contract definition)
  if (memo && memo.trim() !== '') {
    const cleanedMemo = memo.trim();
    // Create a 34-byte buffer filled with zeros
    const memoBuf = Buffer.alloc(34);
    // Write the string into the buffer; if it's longer than 34, it truncates
    memoBuf.write(cleanedMemo, 'utf8');
    args.push(someCV(bufferCV(memoBuf)));
  } else {
    args.push(noneCV());
  }

  return args;
}
