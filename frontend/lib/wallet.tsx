import { showConnect, openContractCall, AppConfig, UserSession } from '@stacks/connect'

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
 * Wrapped in a Promise so 'await' returns the user data to your component.
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
        resolve(userData) // This allows 'if (user)' to work in your merchant page
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
