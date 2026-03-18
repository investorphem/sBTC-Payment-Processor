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
    userSession, // Added userSession here for consistency
  })
}

/**
 * ✅ Get User Data (ADDED TO FIX BUILD ERROR)
 * Returns the user data if signed in, otherwise null.
 */
export function getUserData() {
  return userSession.isUserSignedIn() ? userSession.loadUserData() : null
}

/**
 * ✅ Disconnect Wallet (ADDED TO FIX BUILD ERROR)
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
