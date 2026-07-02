# ⚡ sBTC Payment Processor
### The "Stripe for Bitcoin" on Stacks Layer 2

![Mainnet Ready](https://img.shields.io/badge/Mainnet-Ready-green?style=for-the-badge&logo=bitcoin)
![Stacks](https://img.shields.io/badge/Built%20on-Stacks-5546ff?style=for-the-badge&logo=stacks)
![sBTC](https://img.shields.io/badge/Liquidity-sBTC-f7931a?style=for-the-badge&logo=bitcoin)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js)
![Clarity](https://img.shields.io/badge/Smart%20Contracts-Clarity-white?style=for-the-badge&logo=clojure)
![License](https://img.shields.io/badge/License-MIT-white?style=for-the-badge)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel)

---

## 🚀 Overview

The **sBTC Payment Processor** is a production-grade, non-custodial merchant solution built for the Bitcoin Economy. It allows any business or freelancer to accept **Bitcoin-backed (sBTC)** and **STX** payments with the security of Bitcoin and the speed of Stacks Layer 2.

### 🎯 Hackathon Judging Highlights
* **Innovation:** First-mover sBTC merchant tooling for the Satoshi-era upgrade.
* **Technical Implementation:** Utilizes complex `SIP-010` trait handling and real-time Stacks API indexing for unanchored transactions.
* **Stacks Alignment:** Native integration with `sBTC`, `Clarity`, and `stacks.js`.
* **User Experience:** Clean, professional Merchant Dashboard with searchable revenue history.
* **Impact Potential:** Critical infrastructure for the "Circular Bitcoin Economy."

---


## 🎥 Video Demo
[**Watch the Demo on YouTube**](https://youtube.com/shorts/i_jzw2a_lGM?si=YsC3CPaEsqZoNs0v)  


---

## 🏗️ Technical Architecture

### The Workflow:
1.  **Invoice Creation:** Merchant generates a unique invoice (STX or sBTC) via the dashboard.
2.  **Smart Contract Interaction:** A Clarity contract call initializes the payment request with a unique `memo`.
3.  **Payment Link:** The frontend generates a unique `/pay/[tx_id]` URL for the customer.
4.  **Secure Settlement:** Customer pays via their Stacks wallet (Leather/Xverse). Funds move **directly** to the Merchant via the smart contract.
5.  **Revenue Tracking:** The dashboard indexes the Hiro API to show real-time "Paid" vs "Open" statuses.

---

## 🛠️ Features

* **Dual Asset Support:** Toggle between sBTC (BTC Liquidity) and STX.
* **Revenue Analytics:** Automatic calculation of revenue in both `uSTX` and `Sats`.
* **Non-Custodial:** Funds never touch our servers; they move peer-to-peer on-chain.
* **Security Post-Conditions:** Implements Stacks post-conditions to prevent "over-sending" and malicious asset draining.
* **Mainstream UX:** Integrated Help/Support modals and "Copy 🔗" functionality for non-technical users.
* **🏦 Programmable Treasury Routing:** Merchants set a reserve % (0–100) and a lock duration (in blocks). Every future payment is automatically split on-chain: the remainder pays out instantly, the reserve portion is locked in the contract until the lock period elapses, then withdrawable on demand.

---

## 🏦 Treasury Routing (Split & Lock)

Beyond simple invoice payments, the contract now supports merchant-configurable, automated fund routing on every payment:

1. **Set a rule once:** `set-routing-rules(reserve-bps, lock-blocks)` — e.g. lock 20% of every sale for ~2 weeks of Stacks blocks as a tax/runway reserve.
2. **Automatic split on payment:** `pay-invoice-stx` / `pay-invoice-ft` compute the split at the moment of payment — liquid funds go straight to the merchant, the reserve portion moves into the contract's per-merchant `ReserveSTX` / `ReserveSBTC` maps with an `unlock-height`.
3. **Time-locked withdrawal:** `withdraw-reserve-stx` / `withdraw-reserve-ft` release the locked balance to the merchant only once `block-height >= unlock-height`.
4. **Dashboard visibility:** The Merchant Portal shows current routing rule, locked STX/sBTC balances, and a live "unlocks in N blocks" countdown with a withdraw button.

## 🔗 FlowVault Integration

This project integrates [`flowvault-sdk`](https://www.npmjs.com/package/flowvault-sdk) (pinned at `0.1.1`) to give merchants a second, officially-supported way to route treasury funds — locking and optionally splitting a portion of their balance on-chain via the FlowVault contract, in addition to the payment flow above.

**Files:**
| File | Purpose |
| :--- | :--- |
| `frontend/lib/flowvault.ts` | Typed client wrapper — wallet-executor mode (never a private key in the browser), plus `describeFlowVaultError` for mapping SDK errors to readable messages. |
| `frontend/hooks/useFlowVault.ts` | React hook: `vaultState`, `routingRules`, `hasLocked`, `blockHeight`, `loading`, `error`, and action methods `saveRoutingRules`, `deposit`, `withdraw`, `clearRules`. |
| `frontend/.env.example` | Full env schema, including the FlowVault contract/token principals. |
| `docs/flowvault-test-checklist.md` | Manual test checklist for the integration (build, config, read/write paths, error handling, end-to-end). |

**Setup:**
```bash
cd frontend
npm install        # pulls in flowvault-sdk@0.1.1
cp .env.example .env.local   # fill in your FlowVault + sBTC contract addresses
npm run dev
```

**Usage (from the Merchant Portal):** connect your wallet → the "🔗 FlowVault Treasury" card lets you set a routing rule (`lockAmount`, `lockUntilBlock`, optional `splitAddress`/`splitAmount`), deposit, withdraw, and see live vault state (`hasLockedFunds`, current block height). All writes are signed by the connected wallet via `@stacks/connect`'s `request("stx_callContract", ...)`, never a stored key.

**Relationship to the native routing feature:** `contracts/payment.clar` also implements its own lock/split logic (see below) so the payment flow keeps working even without FlowVault configured. The FlowVault card is the primary, officially-integrated path; the native reserve is a self-contained fallback that doesn't depend on an external contract.

⚠️ **Not yet verified:** `@stacks/connect@^7.7.0`'s exact support for the `request("stx_callContract", ...)` API used by FlowVault's browser wallet mode — confirm this resolves correctly with `npm install` and bump the version if needed before relying on it in production.

---

## ⚙️ Configuration & Tech Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | Next.js 13+, TypeScript, Tailwind CSS |
| **Blockchain** | Stacks (L2 Secured by Bitcoin) |
| **Smart Contracts** | Clarity (Decidable Smart Contracts) |
| **Client Interaction** | @stacks/connect, @stacks/network |
| **Data Layer** | Hiro API (Unanchored transaction support) |

### Environment Variables
```env
NEXT_PUBLIC_STACKS_NETWORK=mainnet
NEXT_PUBLIC_CONTRACT_ADDRESS=SP...YOUR_CONTRACT_ADDRESS
NEXT_PUBLIC_CONTRACT_NAME=sbtc-payment-processor
NEXT_PUBLIC_SBTC_CONTRACT=SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
