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
