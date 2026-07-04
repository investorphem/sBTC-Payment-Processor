/**
 * FlowVault SDK integration.
 *
 * This is a thin wrapper around `flowvault-sdk` configured in "browser wallet mode"
 * per the FlowVault docs (Production Practices: "Use wallet executor mode for
 * browser clients, never sender keys"). All writes are signed by the connected
 * merchant's own wallet.
 *
 * NOTE: FlowVault's docs show `contractCallExecutor` wired to @stacks/connect's
 * v8-only `request("stx_callContract", ...)` API. This app is on @stacks/connect
 * v7 (the same version already used for the rest of the app's contract calls),
 * so instead we implement the executor with the proven `openContractCall`
 * popup flow and adapt its callback-based result into the Promise shape the
 * SDK expects. Functionally equivalent: still wallet-signed, still no private
 * key touches the browser.
 *
 * FlowVault currently only publishes a testnet deployment (see FlowVault docs'
 * Quick Path / Environment Setup, which only ever set
 * NEXT_PUBLIC_FLOWVAULT_NETWORK=testnet). Every function here requires the
 * caller to be on 'testnet' and will throw a clear error otherwise, so a
 * mainnet-connected merchant gets a readable message instead of a silent
 * wrong-network failure.
 */
import { FlowVault } from 'flowvault-sdk';
import { openContractCall } from '@stacks/connect';
import { PostConditionMode } from '@stacks/transactions';
import { NetworkKey, getNetworkConfig } from './networkConfig';
import { getNetwork } from './network';

function requireFlowVaultConfig(network: NetworkKey) {
  const config = getNetworkConfig(network);
  if (!config.flowVault) {
    throw new Error(
      `FlowVault has no deployment on ${network} yet — switch your wallet to Testnet to use this feature.`
    );
  }
  return config.flowVault;
}

/**
 * Builds a wallet-signed FlowVault client scoped to one connected address + network.
 */
export function getFlowVaultClient(senderAddress: string, network: NetworkKey) {
  const fv = requireFlowVaultConfig(network);
  return new FlowVault({
    network,
    contractAddress: fv.contractAddress,
    contractName: fv.contractName,
    tokenContractAddress: fv.tokenContractAddress,
    tokenContractName: fv.tokenContractName,
    senderAddress,
    contractCallExecutor: (call: any) =>
      new Promise((resolve, reject) => {
        openContractCall({
          contractAddress: call.contractAddress,
          contractName: call.contractName,
          functionName: call.functionName,
          functionArgs: call.functionArgs,
          // Always use our own network object for this network key — the value the
          // SDK echoes back in `call.network` is a string ('testnet'), not the
          // StacksNetwork instance openContractCall (v7) requires.
          network: getNetwork(network),
          postConditionMode: PostConditionMode.Allow,
          postConditions: call.postConditions || [],
          appDetails: { name: 'sBTC Payment Processor', icon: '/favicon.ico' },
          onFinish: (data: any) => resolve({ txId: data.txId, txRaw: data.txRaw }),
          onCancel: () => reject(new Error('Transaction cancelled')),
        });
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
export async function setVaultRoutingRules(senderAddress: string, network: NetworkKey, params: RoutingRuleParams) {
  const vault = getFlowVaultClient(senderAddress, network);
  return vault.setRoutingRules(params);
}

/** Write: remove this merchant's routing rule. */
export async function clearVaultRoutingRules(senderAddress: string, network: NetworkKey) {
  const vault = getFlowVaultClient(senderAddress, network);
  return vault.clearRoutingRules();
}

/** Write: deposit `amount` (base units, string) of the configured token into the vault. */
export async function depositToVault(senderAddress: string, network: NetworkKey, amount: string) {
  const vault = getFlowVaultClient(senderAddress, network);
  return vault.deposit(amount);
}

/** Write: withdraw `amount` (base units, string) of unlocked balance from the vault. */
export async function withdrawFromVault(senderAddress: string, network: NetworkKey, amount: string) {
  const vault = getFlowVaultClient(senderAddress, network);
  return vault.withdraw(amount);
}

/** Read: current vault balance/lock state for `address`. */
export async function getVaultState(address: string, network: NetworkKey) {
  const vault = getFlowVaultClient(address, network);
  return vault.getVaultState(address);
}

/** Read: current routing rule configured for `address`. */
export async function getVaultRoutingRules(address: string, network: NetworkKey) {
  const vault = getFlowVaultClient(address, network);
  return vault.getRoutingRules(address);
}

/** Read: whether `address` currently has any locked funds in the vault. */
export async function vaultHasLockedFunds(address: string, network: NetworkKey) {
  const vault = getFlowVaultClient(address, network);
  return vault.hasLockedFunds(address);
}

/** Read: current Stacks block height, as seen by the vault's read path. */
export async function getVaultCurrentBlockHeight(address: string, network: NetworkKey) {
  const vault = getFlowVaultClient(address, network);
  return vault.getCurrentBlockHeight(address);
}
