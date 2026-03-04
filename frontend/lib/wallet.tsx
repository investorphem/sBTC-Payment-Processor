import { showConnect, openContractCall, AppConfig, UserSession } from '@stacks/connect'
import type { AuthOptions } from '@stacks/connect'

/**
 * ✅ App Config (used by UserSession)
 */
const appConfig = new AppConfig(['store_write', 'publish_data'])

/**
 * ✅ User session (correct modern way)
 */
export const userSession = new UserSession({ appConfig })

/**
 * ✅ Connect Wallet
 */
export function connectWallet() {
  showConnect({
    appDetails: {
      name: 'sBTC Payment Processor',
      icon: '/favicon.ico',
    },
    onFinish: () => {
      window.location.reload()
    },
  } as AuthOptions) // ✅ Type safe
}

/**
 * ✅ Call Smart Contract Function
 */
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
    appDetails: {
      name: 'sBTC Payment Processor',
      icon: '/favicon.ico',
    },
    network,
    onFinish,
    postConditionMode,
  })
}