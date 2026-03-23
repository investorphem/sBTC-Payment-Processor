import { showConnect, openContractCall, AppConfig, UserSession } from '@stacks/connect'
import { PostConditionMode } from '@stacks/transactions'

const appConfig = new AppConfig(['store_write', 'publish_data'])
export const userSession = new UserSession({ appConfig })

// 🚀 BRANDING HOOK
const getAppDetails = () => ({
  name: 'sBTC Payment Processor',
  icon: typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : '/logo.png',
});

export function connectWallet() {
  return new Promise((resolve) => {
    showConnect({
      appDetails: getAppDetails(),
      userSession,
      onFinish: () => {
        if (userSession.isUserSignedIn()) {
          resolve(userSession.loadUserData());
        }
      },
      onCancel: () => resolve(null)
    })
  })
}

export function getUserData() {
  return userSession.isUserSignedIn() ? userSession.loadUserData() : null
}

export function disconnectWallet() {
  if (userSession.isUserSignedIn()) {
    userSession.signUserOut()
    window.location.reload()
  }
}

/**
 * ✅ Nakamoto-Optimized Contract Call
 */
export async function callCreateInvoice({
  contractAddress,
  contractName,
  functionName,
  functionArgs,
  network,
  onFinish,
  onCancel,
}: any) {
  return openContractCall({
    contractAddress,
    contractName,
    functionName,
    functionArgs,
    network,
    onFinish,
    onCancel,
    postConditionMode: PostConditionMode.Allow, 
    anchorMode: 1, 
    appDetails: getAppDetails(),
  })
}
