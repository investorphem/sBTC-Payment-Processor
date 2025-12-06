import { callReadOnlyFunction, uintCV, bufferCV, noneCV, someCV, standardPrincipalCV } from '@stacks/transactions';
import { getNetwork } from './network';

export const CONTRACT_NAME = process.env.NEXT_PUBLIC_CONTRACT_NAME || 'sbtc-payment-processor';
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';

export async function readInvoice(id: number) {
  const res = await callReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'get-invoice',
    functionArgs: [uintCV(id)],
    network: getNetwork(),
  });
  return res;
}

// Example builder for create-invoice (used with openContractCall from wallet helper)
export function buildCreateInvoiceArgs(amount: number, token: string, tokenContract?: string, memo?: string) {
  const args: any[] = [uintCV(amount), bufferCV(Buffer.from(token))];
  if (tokenContract) args.push(someCV(standardPrincipalCV(tokenContract)));
  else args.push(noneCV());
  if (memo) args.push(someCV(bufferCV(Buffer.from(memo))));
  else args.push(noneCV());
  return args;
}
