# Gren Frontend Roadmap

This is the handoff document for any model continuing work on `apps/web`. It
describes the current product surface, design constraints, integration boundary,
completed milestones, and the exact order of remaining work.

## Product Context

Gren is an AI-guided USDT vault dashboard for BOT Chain Testnet. A user chooses
one of three fixed on-chain policies: Conservative, Balanced, or Aggressive.
Each policy is a separate vault instance. The agent can propose structured
decisions, but it cannot submit arbitrary calldata and it never controls user
withdrawals. Testnet is the only target until the deployment, smoke tests, and
security gates are complete.

The interface is intentionally a quiet editorial dashboard, inherited from the
preserved prototype in `prototype/`. Keep the restrained paper, sage, peach,
sky, and dark-green palette; serif display headings; compact sans-serif labels;
small radii; and GSAP hierarchy reveals. Do not replace it with a generic crypto
landing page, neon gradients, oversized cards, or speculative chart data.

## Current State

- Next.js marketing homepage runs at `http://localhost:3000`.
- The vault dashboard lives at `http://localhost:3000/app`.
- Prototype remains available at `http://localhost:4174`.
- Desktop and mobile sidebar navigation are implemented.
- Overview, Vaults, Decisions, and Activity views exist.
- Vault profile selection is interactive and maps to the selected profile.
- GSAP entrance motion and reduced-motion fallbacks exist.
- Wagmi/viem are configured for BOT Chain Testnet (chain ID `968`).
- Wallet connection, account balance, disconnect, wrong-network detection, and
  recoverable wallet errors are implemented.
- Agent decision preview and policy-reject demonstration are implemented in the
  Gren agent panel when a vault address and agent API are configured.
- Deposit and withdrawal transaction panels are implemented with exact USDT
  approval, wallet submission, receipt confirmation, failure, rejection, and
  deployment-unavailable states.
- Transaction execution remains unavailable until
  `NEXT_PUBLIC_*_VAULT_ADDRESS` values are populated from a verified testnet
  deployment artifact.

## Component Map

- `apps/web/app/page.tsx`: marketing landing at `/`.
- `apps/web/app/landing.css`: landing-only styles. Do not leak these into the dashboard.
- `apps/web/components/landing/`: header, hero, principles, story, architecture, proof, CTA, footer.
- `apps/web/hooks/use-landing-motion.ts`: GSAP + ScrollTrigger landing motion.
- `apps/web/app/app/page.tsx`: vault shell state, selected profile, active view,
  and transaction modal orchestration.
- `apps/web/app/design-tokens.css`: stable colors, typography, spacing, radii,
  and motion tokens. Landing artifacts may use `--radius-artifact` (16px);
  dashboard panels stay at `--radius-panel` (8px).
- `apps/web/app/globals.css`: dashboard layout and component styles. Preserve
  the class naming convention when extending the UI.
- `apps/web/components/app-sidebar.tsx`: responsive navigation.
- `apps/web/components/page-heading.tsx`: page identity plus Deposit/Withdraw
  actions.
- `apps/web/components/wallet-control.tsx`: wallet session and network UX.
- `apps/web/components/transaction-modal.tsx`: deposit/withdraw flow and exact
  transaction state machine.
- `apps/web/components/dashboard/overview-view.tsx`: portfolio, policy, agent,
  and activity summary.
- `apps/web/components/dashboard/agent-panel.tsx`: decision preview UI.
- `apps/web/components/dashboard/vaults-view.tsx`: policy cards.
- `apps/web/components/dashboard/status-views.tsx`: decisions/activity views.
- `apps/web/lib/wagmi.ts`: BOT Chain definition and Wagmi config.
- `apps/web/lib/agent.ts`: public vault address resolution and agent API calls.
- `packages/shared/src/abi.ts`: shared USDT and GrenVault ABIs. Do not duplicate
  ABI fragments in the web app.
- `packages/shared/src/chain.ts`: authoritative testnet chain and USDT config.

## Transaction State Contract

Use these exact status identifiers in UI, tests, and integration code:

`not_connected`, `awaiting_network`, `awaiting_approval`,
`pending_confirmation`, `confirmed`, `rejected_by_policy`, `failed`,
`unavailable`.

The transaction modal follows this flow:

1. Resolve the selected profile to its public vault address.
2. If the address is missing, render `unavailable`; never submit a guessed
   address or pretend the action succeeded.
3. Require a connected wallet on BOT Chain Testnet.
4. For deposits, read USDT allowance and request approval for the exact amount
   when allowance is insufficient.
5. Wait for the approval receipt before enabling the deposit call.
6. Submit `GrenVault.deposit(assets, receiver)` or
   `GrenVault.withdraw(assets, receiver, owner)`.
7. Keep the UI at `pending_confirmation` until the receipt is confirmed.
8. On success, refetch allowance, USDT balance, and withdrawable assets; expose
   the explorer transaction link.
9. On wallet rejection or receipt failure, render `failed` and allow retry.

Withdrawals must remain usable when the agent API or keeper is unavailable.
The frontend must never expose a keeper key or arbitrary calldata.

## Environment And Deployment

Public browser values are defined in `.env.example`:

- `NEXT_PUBLIC_BOT_CHAIN_RPC_URL`
- `NEXT_PUBLIC_BOT_CHAIN_EXPLORER_URL`
- `NEXT_PUBLIC_BOT_CHAIN_ID`
- `NEXT_PUBLIC_USDT_ADDRESS`
- `NEXT_PUBLIC_CONSERVATIVE_VAULT_ADDRESS`
- `NEXT_PUBLIC_BALANCED_VAULT_ADDRESS`
- `NEXT_PUBLIC_AGGRESSIVE_VAULT_ADDRESS`
- `NEXT_PUBLIC_AGENT_URL`

The three vault addresses must come from
`contracts/script/deployments/bot-chain-testnet.json`. Never copy server-only
keys or deployment credentials into `NEXT_PUBLIC_*` variables.

## Remaining Work Order

### 1. Verify Deployed Testnet Transactions

- Populate the three public vault addresses from the deployment artifact.
- Connect a testnet wallet and verify USDT balance and allowance reads.
- Verify approval, deposit, partial withdrawal, and full withdrawal receipts.
- Confirm balances, shares, and Activity refresh from chain state.

### 2. Connect Decision Execution

- Use `docs/API_CONTRACT.md` for `/v1/decisions/preview`, `/execute`, and status
  polling.
- Render reason code, explanation, allocation, input hash, expiry, policy result,
  and verified execution transaction.
- Render `rejected_by_policy` from the API/chain result; do not infer it from a
  local button state.

### 3. Replace Placeholder Portfolio/Activity Data

- Read total assets, total shares, user shares, and max withdrawal from chain.
- Add an activity adapter backed by verified events or the documented API.
- Keep loading, empty, unavailable, error, pending, and confirmed states at
  stable outer dimensions.

### 4. Finish Motion And Integration QA

- Add state-change transitions for transaction status and activity insertion.
- Preserve reduced-motion behavior.
- Run `docs/FRONTEND_BACKEND_TESTING.md` at desktop and mobile widths.
- Check console errors, semantic selectors, layout stability, and testnet-only
  network behavior before any Mainnet work.

## Rules For Future Models

- Read this document, `docs/DESIGN.md`, `docs/API_CONTRACT.md`, and
  `docs/FRONTEND_BACKEND_TESTING.md` before editing frontend integration code.
- Prefer existing shared types, ABIs, chain constants, and class patterns.
- Do not edit backend or contracts from a frontend task unless the integration
  contract itself is wrong and the change is coordinated.
- Do not manufacture confirmed balances, receipts, decision execution, or
  explorer links.
- Use semantic roles and labels first; use `data-testid` only for state-machine
  assertions that cannot be selected semantically. Existing recommended IDs:
  `network-status`, `wallet-connect`, `vault-profile-balanced`,
  `deposit-submit`, `transaction-status`, `decision-policy-status`, and
  `withdraw-submit`.
- Test with the in-app browser skill at desktop and mobile sizes. A separate
  Playwright plugin is optional; if another agent adds `@playwright/test`, keep
  selectors aligned with `docs/FRONTEND_BACKEND_TESTING.md`.
- Before committing, run `pnpm.cmd --filter @gren/web typecheck` and
  `pnpm.cmd --filter @gren/web build`.
