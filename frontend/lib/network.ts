import { StacksMainnet } from '@stacks/network';

export function getNetwork() {
  return new StacksMainnet({ url: process.env.STACKS_API_URL || 'https://api.hiro.so' });
}
