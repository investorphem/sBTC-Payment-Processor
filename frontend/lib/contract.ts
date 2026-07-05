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
import { NetworkKey, getNetworkConfig } from './networkConfig';

/** Payment contract {address, name} for the given network. */
export function getContractInfo(network: NetworkKey) {
  const config = getNetworkConfig(network);
  return { address: config.paymentContractAddress, name: config.paymentContractName };
}

// Backward-compatible mainnet-only exports (existing call sites that haven't
// been migrated to pass an explicit network yet will keep working against mainnet).
export const CONTRACT_ADDRESS = getNetworkConfig('mainnet').paymentContractAddress;
export const CONTRACT_NAME = getNetworkConfig('mainnet').paymentContractName;

/**
 * Reads invoice data from the blockchain.
 * Automatically unwraps Clarity Response (ok/err) for the frontend.
 */
export async function readInvoice(id: number, network: NetworkKey = 'mainnet') {
  const { address, name } = getContractInfo(network);
  try {
    const res = await callReadOnlyFunction({
      contractAddress: address,
      contractName: name,
      functionName: 'get-invoice',
      functionArgs: [uintCV(id)],
      senderAddress: address || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      network: getNetwork(network),
    });

    const result = cvToValue(res);
    if (result && typeof result === 'object' && 'value' in result) {
      return result.value;
    }
    return result;
  } catch (err) {
    console.error('Error reading invoice from contract:', err);
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
  const args: any[] = [
    uintCV(amount),
    bufferCV(Buffer.from(token.trim().toUpperCase())),
  ];

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
 * All reads below are network-scoped: pass 'mainnet' or 'testnet'
 * to match whichever network the connected wallet is actually on.
 */

async function readOnly(functionName: string, functionArgs: any[], network: NetworkKey) {
  const { address, name } = getContractInfo(network);
  try {
    const res = await callReadOnlyFunction({
      contractAddress: address,
      contractName: name,
      functionName,
      functionArgs,
      senderAddress: address || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      network: getNetwork(network),
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
export async function readRoutingRules(merchantAddress: string, network: NetworkKey = 'mainnet') {
  return readOnly('get-routing-rules', [standardPrincipalCV(merchantAddress)], network);
}

/** Reads a merchant's locked STX reserve: { locked, unlock-height }. */
export async function readReserveStx(merchantAddress: string, network: NetworkKey = 'mainnet') {
  return readOnly('get-reserve-stx', [standardPrincipalCV(merchantAddress)], network);
}

/** Reads a merchant's locked reserve of a specific SIP-010 token: { locked, unlock-height }. */
export async function readReserveFt(
  merchantAddress: string,
  tokenContractAddress: string,
  tokenContractName: string,
  network: NetworkKey = 'mainnet'
) {
  return readOnly(
    'get-reserve-ft',
    [standardPrincipalCV(merchantAddress), contractPrincipalCV(tokenContractAddress, tokenContractName)],
    network
  );
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
