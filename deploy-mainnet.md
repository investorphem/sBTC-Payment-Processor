# Deploying to Stacks Mainnet

1. Audit contracts.
2. Deploy contracts using your preferred method (Clarinet with mainnet, or the production deploy flow). Example with Clarinet:

```bash
clarinet deploy --network mainnet
```

3. After successful deploy, set `NEXT_PUBLIC_CONTRACT_ADDRESS` in your frontend environment.
4. Build and deploy frontend to Vercel. Set environment variables in Vercel matching `.env.example`.
5. Test with small payments before opening to merchants.

Security notes:
- Confirm token contract addresses (sBTC) are correct.
- Consider integrating an off-chain indexer to list invoices reliably and detect payments.
