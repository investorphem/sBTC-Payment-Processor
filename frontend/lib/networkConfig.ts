/**
 * Single source of truth for "which contract/token/API lives where".
 * Every network-dependent value in the app should come from here —
 * nothing else should hardcode a contract address or API URL directly.
 */
export type NetworkKey = 'mainnet' | 'testnet';

export type NetworkConfig = {
  label: string;
  apiUrl: string;
  explorerUrl: string;
  explorerChainParam: string;
  paymentContractAddress: string;
  paymentContractName: string;
  sbtcTokenContractAddress: string;
  sbtcTokenContractName: string;
  /** null when FlowVault has no deployment on this network yet. */
  flowVault: {
    contractAddress: string;
    contractName: string;
    tokenContractAddress: string;
    tokenContractName: string;
  } | null;
};

const MAINNET_CONFIG: NetworkConfig = {
  label: 'Mainnet',
  apiUrl: process.env.NEXT_PUBLIC_STACKS_API_URL_MAINNET || 'https://api.hiro.so',
  explorerUrl: 'https://explorer.hiro.so',
  explorerChainParam: '',
  paymentContractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_MAINNET || '',
  paymentContractName: process.env.NEXT_PUBLIC_CONTRACT_NAME_MAINNET || 'sbtc-payment-processor',
  sbtcTokenContractAddress: process.env.NEXT_PUBLIC_SBTC_TOKEN_ADDRESS_MAINNET || 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4',
  sbtcTokenContractName: 'sbtc-token',
  // FlowVault has not published a mainnet deployment — see FlowVault docs, which only
  // ever configure NEXT_PUBLIC_FLOWVAULT_NETWORK=testnet. Keep this null until they do.
  flowVault: null,
};

const TESTNET_CONFIG: NetworkConfig = {
  label: 'Testnet',
  apiUrl: process.env.NEXT_PUBLIC_STACKS_API_URL_TESTNET || 'https://api.testnet.hiro.so',
  explorerUrl: 'https://explorer.hiro.so',
  explorerChainParam: '?chain=testnet',
  paymentContractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_TESTNET || '',
  paymentContractName: process.env.NEXT_PUBLIC_CONTRACT_NAME_TESTNET || 'sbtc-payment-processor',
  sbtcTokenContractAddress: process.env.NEXT_PUBLIC_SBTC_TOKEN_ADDRESS_TESTNET || '',
  sbtcTokenContractName: 'sbtc-token',
  flowVault: {
    contractAddress: process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT_ADDRESS || 'STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD',
    contractName: process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT_NAME || 'flowvault-v2',
    tokenContractAddress: process.env.NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_ADDRESS || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    tokenContractName: process.env.NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_NAME || 'usdcx',
  },
};

export const NETWORK_CONFIGS: Record<NetworkKey, NetworkConfig> = {
  mainnet: MAINNET_CONFIG,
  testnet: TESTNET_CONFIG,
};

export function getNetworkConfig(network: NetworkKey): NetworkConfig {
  return NETWORK_CONFIGS[network];
}

/** Builds a working Stacks Explorer link for a tx id on the given network. */
export function getExplorerTxUrl(txId: string, network: NetworkKey): string {
  const config = getNetworkConfig(network);
  return `${config.explorerUrl}/txid/${txId}${config.explorerChainParam}`;
}

/** SP/SM prefixes are mainnet, ST/SN prefixes are testnet — used to sanity-check an address against a selected network. */
export function addressMatchesNetwork(address: string | null | undefined, network: NetworkKey): boolean {
  if (!address) return false;
  const prefix = address.slice(0, 2).toUpperCase();
  const isMainnetAddress = prefix === 'SP' || prefix === 'SM';
  const isTestnetAddress = prefix === 'ST' || prefix === 'SN';
  if (network === 'mainnet') return isMainnetAddress;
  if (network === 'testnet') return isTestnetAddress;
  return false;
}
