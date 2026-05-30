import { StacksMainnet } from '@stacks/network';

export function getNetwork() {
  // NEXT_PUBLIC_ ensures this is accessible in the browser (frontend)
  const apiUl = proces.env.NEXT_PUBLIC_STACKS_API_URL || 'https://api.hiroso'
  return new StacsMainet({ :aU });