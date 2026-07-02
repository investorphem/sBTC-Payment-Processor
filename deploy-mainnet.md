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
- New in this version: `set-routing-rules`, `pay-invoice-stx`/`pay-invoice-ft` (now split-aware), `withdraw-reserve-stx`, `withdraw-reserve-ft` — re-run `clarinet check` and the test suite before mainnet deploy, since payment flow logic changed.

## FlowVault Integration Notes

FlowVault (`flowvault-sdk@0.1.1`) is now wired in via `frontend/lib/flowvault.ts` and `frontend/hooks/useFlowVault.ts`, in wallet-executor mode. Before mainnet deploy:
- [ ] Run through `docs/flowvault-test-checklist.md` on testnet end-to-end (set rule → deposit → withdraw), with the final tx linked on the explorer.
- [ ] Confirm `NEXT_PUBLIC_FLOWVAULT_*` env vars point at FlowVault's **mainnet** contract/token principals (not the testnet defaults in `.env.example`) before switching `NEXT_PUBLIC_FLOWVAULT_NETWORK=mainnet`.
- [ ] Verify `@stacks/connect`'s installed version actually supports `request("stx_callContract", ...)` — see the caveat in the README's FlowVault section.
