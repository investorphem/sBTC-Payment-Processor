import { showConnect, openContractCall, AppConfig, UserSession } from '@stacks/connect'
import { PostConditionMode } from '@stacks/transactions'

const appConfig = new AppConfig(['store_write', 'publish_data'])
export const userSession = new UserSession({ appConfig })

export function connectWallet() {
  return new Promise((resolve) => {
    showConnect({
      appDetails: { name: 'sBTC Payment Processor', icon: '/favicon.ico' },
      userSession,
      onFinish: () => resolve(userSession.loadUserData()),
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
 * ✅ Fixed: Added onCancel and forced anchorMode 
 */
export async function callCreateInvoice({
  contractAddress,
  contractName,
  functionName,
  functionArgs,
  network,
  onFinish,
  onCancel, // Added to detect wallet closure
}) {
  return openContractCall({
    contractAddress,
    contractName,
    functionName,
    functionArgs,
    network,
    onFinish,
    onCancel, // Triggered when user closes the wallet popup
    postConditionMode: PostConditionMode.Allow, 
    anchorMode: 1, // 1 = Any (Ensures the Confirm button is clickable)
    appDetails: {
      name: 'sBTC Payment Processor',
      icon: '/favicon.ico',
    },
  })
}
