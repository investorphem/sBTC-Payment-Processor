import { showConnect, openContractCall, AppConfig, UserSession } from '@stacks/connect'
// 1. Import PostConditionMode to fix the unclickable button
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
 * Fixed: Now explicitly uses PostConditionMode.Allow
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
    // 2. This is the fix for the "unclickable" button
    postConditionMode: PostConditionMode.Allow,
    appDetails: {
      name: 'sBTC Payment Processor',
      icon: '/favicon.ico',
    },
    network,
    onFinish,
  })
}
