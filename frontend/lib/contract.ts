import {
  callReadOnlyFunction,
  uintCV,
  bufferCV,
  noneCV,
  someCV,
  contractPrincipalCV,
  standardPrincipalCV,
  cvToValue,
} from '@stacks/transactions';
import { getNetwork } from './network';

// Ensure these environment variables are set in Vercel
export const CONTRACT_NAME =
  process.env.NEXT_PUBLIC_CONTRACT_NAME || 'sbtc-payment-processor';

export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';

/**
 * Reads invoice data from the blockchain.
 * Automatically unwraps Clarity Response (ok/err) for the frontend.
 */
export async function readInvoice(id: number) {
  try {
    const res = await callReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'get-invoice',
      functionArgs: [uintCV(id)],
      // Fallback address for read-only calls
      senderAddress: CONTRACT_ADDRESS || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      network: getNetwork(),
    });

    const result = cvToValue(res);

    // ✅ Unwrapping logic: If Clarity returns (ok {data}), 
    // cvToValue makes it { value: {data} }. We return the inner data.
    if (result && typeof result === 'object' && 'value' in result) {
      return result.value;
    }
    return result;
  } catch (err) {
    console.error("Error reading invoice from contract:", err);
    return null;
  }
}

/**
 * Formats arguments for creating an invoice.
 * Corrects token names to Uppercase (STX/SBTC) to match contract logic.
 */
export function buildCreateInvoiceArgs(
  amount: number | bigint,
  token: string,
  tokenContract?: string,
  memo?: string
) {
  // 1. Amount and Token Buffer (forced to Uppercase)
  const args: any[] = [
    uintCV(amount),
    bufferCV(Buffer.from(token.trim().toUpperCase())), 
  ];

  // 2. Token Contract Principal
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

  // 3. Memo (Fixed 34-byte buffer for Clarity compatibility)
  if (memo && memo.trim() !== '') {
    const memoBuf = Buffer.alloc(34);
    memoBuf.write(memo.trim(), 'utf8');
    args.push(someCV(bufferCV(memoBuf)));
  } else {
    args.push(noneCV());
  }

  return args;
}

/**
 * --- Treasury Routing (split / lock reserve) ---
 * Merchant-configurable rule: what % of each incoming payment gets
 * auto-locked into an on-chain reserve, and for how many blocks.
 */

async function readOnly(functionName: string, functionArgs: any[]) {
  try {
    const res = await callReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName,
      functionArgs,
      senderAddress: CONTRACT_ADDRESS || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      network: getNetwork(),
    });
    const result = cvToValue(res);
    if (result && typeof result === 'object' && 'value' in result) {
      return result.value;
    }
    return result;
  } catch (err) {
    console.error(`Error reading ${functionName} from contract:`, err);
    return null;
  }
}

/** Reads a merchant's current routing rule: { reserve-bps, lock-blocks }. */
export async function readRoutingRules(merchantAddress: string) {
  return readOnly('get-routing-rules', [standardPrincipalCV(merchantAddress)]);
}

/** Reads a merchant's locked STX reserve: { locked, unlock-height }. */
export async function readReserveStx(merchantAddress: string) {
  return readOnly('get-reserve-stx', [standardPrincipalCV(merchantAddress)]);
}

/** Reads a merchant's locked sBTC reserve: { locked, unlock-height }. */
export async function readReserveSbtc(merchantAddress: string) {
  return readOnly('get-reserve-sbtc', [standardPrincipalCV(merchantAddress)]);
}

/**
 * Builds args for `set-routing-rules`.
 * @param reservePercent 0-100 (e.g. 20 = lock 20% of every payment)
 * @param lockBlocks number of Stacks blocks the locked portion must wait
 */
export function buildSetRoutingRulesArgs(reservePercent: number, lockBlocks: number) {
  const reserveBps = Math.round(Math.max(0, Math.min(100, reservePercent)) * 100);
  return [uintCV(reserveBps), uintCV(Math.max(0, Math.floor(lockBlocks)))];
}