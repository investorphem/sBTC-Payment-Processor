import {
  uintCV,
  bufferCV,
  noneCV,
  someCV,
  principalCV, // 👈 Robust for both Standard and Contract principals
} from '@stacks/transactions';

export function buildCreateInvoiceArgs(
  amount: number | bigint,
  token: string,
  tokenContract?: string,
  memo?: string
) {
  // 1. Amount: Must be BigInt
  // 2. Token: Must be (buff 12). We trim and slice to be safe.
  const tokenBuf = Buffer.from(token.trim().toUpperCase()).slice(0, 12);
  
  const args: any[] = [
    uintCV(BigInt(amount)), 
    bufferCV(tokenBuf)
  ];

  // 3. Token Contract: Contract expects (optional principal)
  // We use principalCV(string) which is the most compatible way to send a principal
  if (tokenContract && tokenContract.includes('.')) {
    try {
      args.push(someCV(principalCV(tokenContract.trim())));
    } catch (e) {
      console.error("Invalid Principal Address:", tokenContract);
      args.push(noneCV());
    }
  } else {
    args.push(noneCV());
  }

  // 4. Memo: Must be (buff 34). 
  if (memo && memo.trim() !== '') {
    const memoBuffer = Buffer.from(memo.trim()).slice(0, 34);
    args.push(someCV(bufferCV(memoBuffer)));
  } else {
    args.push(noneCV());
  }

  return args;
}
