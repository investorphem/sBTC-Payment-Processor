import { StacksMainnet } from '@stacks/network';

export function getNetwork() {
  return new StacksMainnet({ url: apiUrl });
}