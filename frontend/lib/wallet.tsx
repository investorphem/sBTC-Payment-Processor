import { showConnect, openContractCall, AppConfig, UserSession } from '@stacks/connect'
import { PostConditionMode } from '@stacks/transactions'

const appConfig = new AppConfig(['store_write', 'publish_data'])
export const userSession = new UserSession({ appConfig })

// 🚀 BRANDING HOOK
// We use window.location.origin so the wallet fetches the full URL (e.g., https://sbtc.vercel.app/logo.png)
const getAppDetails = () => ({
  name: 'sBTC Payment Processor',
  icon: typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : '/logo.png',
});

export function connectWallet() {
  return new Promise((resolve) => {
    showConnect({
      appDetails: getAppDetails(), // 👈 Updated to high-res PNG
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
}) {
  return openContractCall({
    contractAddress,
    contractName,
    functionName,
    functionArgs,
    network,
    onFinish,
    onCancel,
    // PostConditionMode.Allow is used for creating the invoice (data entry)
    // For payments, we will use PostConditionMode.Deny + Specific Conditions for extra security
    postConditionMode: PostConditionMode.Allow, 
    anchorMode: 1, // 1 = Any (Allows microblock inclusion for faster UX)
    appDetails: getAppDetails(), // 👈 Updated to high-res PNG
  })
}
