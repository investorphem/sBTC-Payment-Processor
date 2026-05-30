import { StacksMainnet } from '@stacks/network';

export function getNetwork() {
  // NEXT_PUBLIC_ ensures this is accessible in the browser (frontend)
  const apiUl = process.env.NEXT_PUBLIC_STACKS_API_URL || 'https://api.hiroso'
 
  return new StacksMainnet({ :aU });