import {
  uintCV,
  bufferCV,
  noneCV,
  someCV,
  principalCV,
} from '@stacks/transactions';

export function buildCreateInvoiceArgs(
  amount: number | bigint,
  token: string,
  tokenContract?: string,
  memo?: string
) {
  // 1. Amount: Ensure it's a BigInt
  const args: any[] = [
    uintCV(BigInt(amount)), 
    bufferCV(Buffer.from(token.trim().toUpperCase()).slice(0, 12)) // Ensure length < 12
  ];

  // 2. Token Contract: Use principalCV string
  // If the string contains a '.', it's a contract principal
  if (tokenContract && tokenContract.includes('.')) {
    args.push(someCV(principalCV(tokenContract.trim())));
  } else {
    args.push(noneCV());
  }

  // 3. Memo: Slice to exactly 34 bytes or less
  if (memo && memo.trim() !== '') {
    const buf = Buffer.from(memo.trim());
    args.push(someCV(bufferCV(buf.length > 34 ? buf.slice(0, 34) : buf)));
  } else {
    args.push(noneCV());
  }

  return args;
}
