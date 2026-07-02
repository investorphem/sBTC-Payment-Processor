/**
 * FlowVault SDK integration.
 *
 * This is a thin wrapper around `flowvault-sdk` configured in "browser wallet mode"
 * per the FlowVault docs (Production Practices: "Use wallet executor mode for
 * browser clients, never sender keys"). All writes are signed by the connected
 * merchant's own wallet via @stacks/connect's `request("stx_callContract", ...)`.
 *
 * Reference: FlowVault SDK docs, "Initialization > Browser wallet mode".
 */
import { FlowVault } from 'flowvault-sdk';
import { request } from '@stacks/connect';

export type FlowVaultNetwork = 'testnet' | 'mainnet';

const NETWORK = (process.env.NEXT_PUBLIC_FLOWVAULT_NETWORK || 'testnet') as FlowVaultNetwork;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT_ADDRESS || '';
const CONTRACT_NAME = process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT_NAME || 'flowvault-v2';
const TOKEN_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_ADDRESS || '';
const TOKEN_CONTRACT_NAME = process.env.NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_NAME || '';

function assertConfigured() {
  if (!CONTRACT_ADDRESS || !TOKEN_CONTRACT_ADDRESS || !TOKEN_CONTRACT_NAME) {
    throw new Error(
      'FlowVault is not configured. Set NEXT_PUBLIC_FLOWVAULT_CONTRACT_ADDRESS, ' +
      'NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_ADDRESS and NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_NAME ' +
      '(see .env.example).'
    );
  }
}

/**
 * Builds a wallet-signed FlowVault client scoped to one connected address.
 * Rule from the docs: "keep contract and token principals from the same
 * network" — we source both from the same NEXT_PUBLIC_FLOWVAULT_* env group
 * so testnet/mainnet can't be mixed by accident.
 */
export function getFlowVaultClient(senderAddress: string) {
  assertConfigured();
  return new FlowVault({
    network: NETWORK,
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    tokenContractAddress: TOKEN_CONTRACT_ADDRESS,
    tokenContractName: TOKEN_CONTRACT_NAME,
    senderAddress,
    contractCallExecutor: async (call: any) =>
      request('stx_callContract', {
        contract: `${call.contractAddress}.${call.contractName}`,
        functionName: call.functionName,
        functionArgs: call.functionArgs,
        network: call.network,
        postConditionMode: 'allow',
        postConditions: call.postConditions,
      }),
  });
}

/** Maps FlowVault SDK typed errors to short, user-facing messages (per docs "Error Handling"). */
export function describeFlowVaultError(error: any): string {
  switch (error?.name) {
    case 'InvalidAmountError':
      return "That amount isn't valid. Use a positive whole-number token amount (base units).";
    case 'InvalidAddressError':
      return 'Wallet address looks invalid. Try reconnecting your wallet.';
    case 'InvalidRoutingRuleError':
      return "That routing rule isn't valid — check the lock block is in the future.";
    case 'InvalidConfigurationError':
      return "FlowVault isn't configured correctly. Check your environment variables.";
    case 'ContractCallError':
      return 'The transaction was rejected by the contract. Check your balance and try again.';
    case 'NetworkError':
      return 'Network error talking to Stacks. Check your connection and retry.';
    case 'ParsingError':
      return 'Could not read the on-chain vault state. Try refreshing.';
    default:
      return error?.message || 'Something went wrong talking to FlowVault.';
  }
}

export type RoutingRuleParams = {
  lockAmount: string;
  lockUntilBlock: number;
  splitAddress: string | null;
  splitAmount: string;
};

/** Write: configure this merchant's routing rule (lock + optional split). */
export async function setVaultRoutingRules(senderAddress: string, params: RoutingRuleParams) {
  const vault = getFlowVaultClient(senderAddress);
  return vault.setRoutingRules(params);
}

/** Write: remove this merchant's routing rule. */
export async function clearVaultRoutingRules(senderAddress: string) {
  const vault = getFlowVaultClient(senderAddress);
  return vault.clearRoutingRules();
}

/** Write: deposit `amount` (base units, string) of the configured token into the vault. */
export async function depositToVault(senderAddress: string, amount: string) {
  const vault = getFlowVaultClient(senderAddress);
  return vault.deposit(amount);
}

/** Write: withdraw `amount` (base units, string) of unlocked balance from the vault. */
export async function withdrawFromVault(senderAddress: string, amount: string) {
  const vault = getFlowVaultClient(senderAddress);
  return vault.withdraw(amount);
}

/** Read: current vault balance/lock state for `address`. */
export async function getVaultState(address: string) {
  const vault = getFlowVaultClient(address);
  return vault.getVaultState(address);
}

/** Read: current routing rule configured for `address`. */
export async function getVaultRoutingRules(address: string) {
  const vault = getFlowVaultClient(address);
  return vault.getRoutingRules(address);
}

/** Read: whether `address` currently has any locked funds in the vault. */
export async function vaultHasLockedFunds(address: string) {
  const vault = getFlowVaultClient(address);
  return vault.hasLockedFunds(address);
}

/** Read: current Stacks block height, as seen by the vault's read path. */
export async function getVaultCurrentBlockHeight(address: string) {
  const vault = getFlowVaultClient(address);
  return vault.getCurrentBlockHeight(address);
}
