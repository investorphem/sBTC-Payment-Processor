import { StacksMainnet, StacksTestnet } from '@stacks/network';
import { NetworkKey, getNetworkConfig } from './networkConfig';

/**
 * Returns a StacksNetwork object for the given network key.
 * Defaults to 'mainnet' for backward compatibility with any call site
 * that hasn't been updated to pass an explicit network yet.
 */
export function getNetwork(network: NetworkKey = 'mainnet') {
  const config = getNetworkConfig(network);
  return network === 'testnet'
    ? new StacksTestnet({ url: config.apiUrl })
    : new StacksMainnet({ url: config.apiUrl });
}
