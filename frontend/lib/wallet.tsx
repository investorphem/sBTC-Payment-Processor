import { showConnect, openContractCall, AppConfig, UserSession } from '@stacks/connect'
import { PostConditionMode } from '@stacks/transactions'

/**
 * ✅ App Config
 */
const appConfig = new AppConfig(['store_write', 'publish_data'])

/**
 * ✅ User session
 */
export const userSession = new UserSession({ appConfig })

/**
 * ✅ Connect Wallet
 */
export function connectWallet() {
  return new Promise((resolve) => {
    showConnect({
      appDetails: {
        name: 'sBTC Payment Processor',
        icon: '/favicon.ico',
      },
      userSession,
      onFinish: () => {
        const userData = userSession.loadUserData()
        resolve(userData)
      },
      onCancel: () => {
        resolve(null)
      }
    })
  })
}

/**
 * ✅ Get User Data
 */
export function getUserData() {
  return userSession.isUserSignedIn() ? userSession.loadUserData() : null
}

/**
 * ✅ Disconnect Wallet
 */
export function disconnectWallet() {
  if (userSession.isUserSignedIn()) {
    userSession.signUserOut()
    window.location.reload()
  }
}

/**
 * ✅ Call Smart Contract Function
 * Final Fix: Added anchorMode to ensure the Confirm button unlocks.
 */
export async function callCreateInvoice({
  contractAddress,
  contractName,
  functionName,
  functionArgs,
  network,
  onFinish,
}) {
  return openContractCall({
    contractAddress,
    contractName,
    functionName,
    functionArgs,
    network,
    onFinish,
    // 1. Unlocks the button by allowing asset transfers without strict pre-check
    postConditionMode: PostConditionMode.Allow,
    // 2. CRITICAL: Tells the wallet to broadcast regardless of microblock/anchor state
    // Use 1 for 'Any' (most compatible)
    anchorMode: 1, 
    appDetails: {
      name: 'sBTC Payment Processor',
      icon: '/favicon.ico',
    },
  })
}
