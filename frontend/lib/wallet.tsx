import React from 'react';
import { showConnect, openContractCall } from '@stacks/connect';
import { AppConfig } from '@stacks/connect';

const appConfig = new AppConfig(['store_write', 'publish_data']);

export function connectWallet() {
  showConnect({
    appDetails: { name: 'sBTC Payment Processor', icon: '/favicon.ico' },
    onFinish: payload => {
      // payload contains auth response
      window.location.reload();
    },
    appConfig,
  });
}

export async function callCreateInvoice({
  contractAddress,
  contractName,
  functionName,
  functionArgs,
  network,
  onFinish,
  postConditionMode,
}: any) {
  return openContractCall({
    contractAddress,
    contractName,
    functionName,
    functionArgs,
    appDetails: { name: 'sBTC Payment Processor', icon: '/favicon.ico' },
    network,
    onFinish,
  });
}
