# FlowVault Integration — Test Checklist

Run through this after any change to `frontend/lib/flowvault.ts`, `frontend/hooks/useFlowVault.ts`,
or the FlowVault env vars, before deploying or submitting for review.

## Build / static checks
- [ ] `npm install` in `frontend/` resolves `flowvault-sdk@0.1.1` with no peer-dep errors.
- [ ] `npm run build` compiles with no TypeScript errors in `lib/flowvault.ts` or `hooks/useFlowVault.ts`.
- [ ] `.env.example` values are present in your local `.env.local` (or Vercel env) before `npm run dev`.

## Configuration sanity
- [ ] `NEXT_PUBLIC_FLOWVAULT_NETWORK`, `NEXT_PUBLIC_FLOWVAULT_CONTRACT_ADDRESS`/`_NAME`, and
      `NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_ADDRESS`/`_NAME` are all from the **same** network
      (mixed testnet/mainnet pairs are invalid per FlowVault docs).
- [ ] Calling `getFlowVaultClient()` without these vars set throws the expected
      "FlowVault is not configured" error rather than a silent failure.

## Wallet connection
- [ ] Connecting a wallet on `/merchant` populates `merchantAddress` and triggers `flowVault.refresh()`.
- [ ] Disconnecting clears the FlowVault card state (no stale balances/rules shown).

## Read path
- [ ] `getVaultState(address)` returns without throwing for a fresh (never-deposited) address.
- [ ] `getVaultRoutingRules(address)` returns a default/empty rule for an address with none set.
- [ ] `hasLockedFunds(address)` returns `false` before any deposit, `true` after a locked deposit.
- [ ] `getCurrentBlockHeight(address)` returns a plausible current testnet block height.

## Write path (testnet, small amounts)
- [ ] `Save Routing Rule` with a short future `lockUntilBlock` and no split succeeds; refresh shows the new rule.
- [ ] `Save Routing Rule` with a `lockUntilBlock` in the past is rejected client-side or by the contract
      (`InvalidRoutingRuleError` surfaces a readable message, not a raw stack trace).
- [ ] `Deposit` a small amount; tx id is returned and the vault state updates after confirmation.
- [ ] `Withdraw` before the lock has elapsed is rejected with a clear message.
- [ ] `Withdraw` after the lock has elapsed (or of unlocked balance) succeeds.
- [ ] `Clear Rule` removes the routing rule; subsequent reads reflect the cleared state.

## Error handling UX
- [ ] Each of `InvalidAmountError`, `InvalidAddressError`, `InvalidRoutingRuleError`,
      `InvalidConfigurationError`, `ContractCallError`, `NetworkError`, `ParsingError` maps to a
      distinct, non-technical message via `describeFlowVaultError` (spot-check by forcing each case).
- [ ] Errors are shown in the UI (`flowVault.error`) without crashing the page.

## End-to-end (for bounty submission)
- [ ] One full cycle recorded: connect wallet → set routing rule → deposit → confirm state changed →
      wait for/simulate unlock → withdraw — with the final tx id linked on the Stacks explorer.
