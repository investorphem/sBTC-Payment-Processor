# sBTC Payment Processor — Mainnet Ready

    

A **production-ready crypto payment processor** built on the **Stacks blockchain**, enabling merchants to accept **Bitcoin-backed payments (sBTC)** and **STX**. All payments are secured on-chain with **Clarity smart contracts**.

---

## 🚀 Overview

sBTC Payment Processor is designed for merchants, developers, and crypto enthusiasts who want a **decentralized, transparent, Bitcoin-backed payment system** on Stacks.

**Highlights:**

* Accept **sBTC (SIP-010)** or **STX** payments
* On-chain **invoice creation and settlement**
* **Wallet integration**: Hiro, Xverse, and other Stacks wallets
* Mainnet-ready and deployable via **Vercel or any Node host**
* Fully open-source and crypto-friendly

---

## 🔗 Why Stacks?

[Stacks](https://www.stacks.co/) brings **smart contracts and dApps to Bitcoin**, leveraging Bitcoin’s security and immutability. Key benefits:

* **Clarity smart contracts**: Predictable, secure, and decidable
* **SIP-010 tokens**: Standardized tokens like sBTC
* **Decentralized payments**: Trustless and on-chain
* **Wallet SDKs**: Integrates seamlessly with user wallets for transactions

---

## 🏗️ Repo Structure

```text
contracts/          # Clarity contracts + tests
frontend/           # Next.js + TypeScript frontend
Clarinet.toml       # Mainnet deployment config
README.md           # This file
deploy-mainnet.md   # Instructions for mainnet deployment
```

---

## 💡 Features

* **Merchant Dashboard** — Create and track invoices
* **Invoice Payments** — Accept STX or sBTC
* **Auto-settlement** — On-chain status updates
* **Wallet Connect** — Hiro, Xverse, and more
* **Webhook Support** — Optional serverless endpoint for off-chain tracking

---

## ⚡ Getting Started

### Prerequisites

* Node.js >= 18
* npm or yarn
* [Clarinet](https://docs.stacks.co/docs/clarinet-overview) for smart contract deployment
* Stacks wallet (Hiro/Xverse)

### Install Frontend Dependencies

```bash
cd frontend
npm install
```

### Running Locally

```bash
npm run dev
```

> Ensure `.env` variables point to **mainnet contracts**.

---

## 📝 Environment Variables

```env
NEXT_PUBLIC_STACKS_NETWORK=mainnet
STACKS_API_URL=https://api.hiro.so
NEXT_PUBLIC_CONTRACT_NAME=sbtc-payment-processor
NEXT_PUBLIC_CONTRACT_ADDRESS=SP...YOUR_CONTRACT_ADDRESS
NEXT_PUBLIC_SBTC_CONTRACT=SP000000000000000000002Q6VF78.sbtc-token
WEBHOOK_SECRET=replace_with_secure_value
```

---

## 🛠️ Deploying to Mainnet

1. Audit your Clarity contracts
2. Deploy contracts using Clarinet or official tooling:

```bash
clarinet deploy --network mainnet
```

3. Update `NEXT_PUBLIC_CONTRACT_ADDRESS` in `.env`
4. Deploy frontend to Vercel (or similar)
5. Test with small payments first

---

## 📈 Tech Stack

* **Blockchain**: Stacks (Bitcoin Layer 1-secured)
* **Smart Contracts**: Clarity (SIP-010 token support)
* **Frontend**: Next.js + React + TypeScript
* **Wallet SDK**: `@stacks/connect` / `@stacks/wallet-sdk`
* **Testing**: Clarinet + TypeScript

---

## 🔒 Security Notes

* Always audit contracts before mainnet
* Verify token contract addresses
* Consider off-chain indexer for invoice tracking
* Start with minimal amounts in production

---

## 📊 Crypto & GitHub Badges 

*
*
*
*
*

> https://github.com/investorphem/sBTC-Payment-Processor.

---

## 📂 Contributing

* Fork and clone repo
* Open issues for features or bugs
* Submit pull requests
* Ensure testing before merging

---

## 📄 License

[MIT License](LICENSE)
