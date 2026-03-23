import {
  uintCV,
  bufferCV,
  noneCV,
  someCV,
  principalCV,
} from '@stacks/transactions';

// 1. THESE MUST BE EXPORTED FOR THE MERCHANT PAGE TO WORK
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 'SP3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4';
export const CONTRACT_NAME = process.env.NEXT_PUBLIC_CONTRACT_NAME || 'sbtc-payments';

export function buildCreateInvoiceArgs(
  amount: number | bigint,
  token: string,
  tokenContract?: string,
  memo?: string
) {
  // Ensure amount is handled as a BigInt for the uintCV
  const args: any[] = [
    uintCV(BigInt(amount)), 
    bufferCV(Buffer.from(token.trim().toUpperCase()).slice(0, 12)) 
  ];

  // Token Contract: (optional principal)
  if (tokenContract && tokenContract.includes('.')) {
    try {
      args.push(someCV(principalCV(tokenContract.trim())));
    } catch (e) {
      console.error("Invalid Principal Format", e);
      args.push(noneCV());
    }
  } else {
    args.push(noneCV());
  }

  // Memo: (optional (buff 34))
  if (memo && memo.trim() !== '') {
    const buf = Buffer.from(memo.trim());
    args.push(someCV(bufferCV(buf.length > 34 ? buf.slice(0, 34) : buf)));
  } else {
    args.push(noneCV());
  }

  return args;
}
