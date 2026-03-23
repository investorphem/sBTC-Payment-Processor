import { 
  uintCV, 
  bufferCV, 
  noneCV, 
  someCV, 
  principalCV, 
  callReadOnlyFunction, 
  cvToJSON 
} from '@stacks/transactions';
import { getNetwork } from './network';

// 1. Export constants for both Merchant and Pay pages
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE';
export const CONTRACT_NAME = 'sbtc-payments';

// 2. The function your Pay page is missing
export async function readInvoice(id: number) {
  try {
    const network = getNetwork();
    const result = await callReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'get-invoice',
      functionArgs: [uintCV(id)],
      network,
      senderAddress: CONTRACT_ADDRESS,
    });
    return cvToJSON(result).value;
  } catch (e) {
    console.error("Error reading invoice:", e);
    return null;
  }
}

// 3. The logic for creating invoices
export function buildCreateInvoiceArgs(
  amount: number | bigint,
  token: string,
  tokenContract?: string,
  memo?: string
) {
  const args = [
    uintCV(BigInt(amount)), 
    bufferCV(Buffer.from(token.trim().toUpperCase()).slice(0, 12)),
    tokenContract ? someCV(principalCV(tokenContract.trim())) : noneCV(),
    memo && memo.trim() !== '' ? someCV(bufferCV(Buffer.from(memo.trim()).slice(0, 34))) : noneCV()
  ];
  return args;
}
