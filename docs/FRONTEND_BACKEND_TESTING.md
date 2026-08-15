# Frontend and Backend Verification

This is the shared test plan for the Next.js frontend and the testnet backend.
It is the checklist to use before declaring a component operational.

## Local services

Run the web app and agent separately:

```powershell
pnpm.cmd --filter @gren/web dev
pnpm.cmd --filter @gren/agent dev
```

Expected URLs:

- Web: `http://localhost:3000`
- Agent health: `http://localhost:8787/health`

The browser must use the target testnet configuration loaded from environment
variables. Do not test with a Mainnet wallet or funded Mainnet account while
the custody loop is still under development.

## Browser test matrix

### App boot

- Page loads without console errors.
- Network status is explicit: connected, wrong network, or unavailable.
- No server-only value appears in rendered HTML or browser requests.
- Loading and unavailable states do not shift the dashboard layout.

### Wallet and network

- A disconnected wallet sees `not_connected`.
- A connected wallet on another chain sees `awaiting_network`.
- The switch-network action requests the configured testnet chain ID.
- Rejected wallet permissions remain recoverable without a page reload.

### Deposit

- The selected profile maps to the correct vault address.
- Allowance is read from chain state.
- Insufficient allowance produces `awaiting_approval`.
- Approval and deposit show `pending_confirmation` until receipt confirmation.
- A confirmed deposit refreshes USDT balance, shares, and activity.
- A rejected or failed transaction never appears as confirmed.

### Agent decision

- Preview displays the same profile and vault the user selected.
- Decision allocation totals exactly `10_000` basis points.
- Explanation, reason code, input hash, expiry, and policy result render.
- An out-of-bounds decision renders `rejected_by_policy` with a reason.
- The UI never exposes a keeper private key or arbitrary calldata.

### Execution and withdrawal

- An allowed decision shows its transaction hash and explorer link after receipt.
- The activity feed is populated from verified events or a documented API.
- Withdrawal remains available when the agent endpoint is stopped.
- Partial and full withdrawal refresh balances and shares correctly.

## Playwright expectations

Use stable semantic selectors first. Add `data-testid` only for elements that
cannot be selected by role, label, or visible text. Recommended IDs include:

- `network-status`
- `wallet-connect`
- `vault-profile-balanced`
- `deposit-submit`
- `transaction-status`
- `decision-policy-status`
- `withdraw-submit`

The in-app browser control skill provides Playwright-backed DOM inspection,
screenshots, viewport overrides, and console-log checks in this environment. A
separate Microsoft Playwright plugin is not required for the current workflow;
if the VS Code agent adds `@playwright/test`, keep its selectors and assertions
aligned with this document.

## Evidence to keep

For each testnet smoke run, record:

- network and wallet address used
- selected vault and deposit amount
- approval, deposit, decision, execution, and withdrawal transaction hashes
- screenshots of pending, confirmed, rejected, and failed states
- browser console result
- exact commit or deployment artifact version
