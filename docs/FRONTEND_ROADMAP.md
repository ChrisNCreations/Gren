# Frontend Roadmap

This document defines the work owned by the frontend/design agent in this Codex
task. Backend and contract agents should not restructure `apps/web` without
coordinating through `API_CONTRACT.md`.

## Current frontend state

- Next.js application shell is running at `http://localhost:3000`
- Gren dashboard styling is inherited from the preserved prototype
- Desktop and mobile navigation exist
- Vault policy selection is interactive
- GSAP entrance motion and reduced-motion support exist
- Financial values and network actions are still pre-integration states

## Frontend work order

### 1. Extract the design system

- Convert CSS colors, spacing, typography, radii, and motion timings into stable
  design tokens.
- Extract reusable buttons, icon controls, status badges, panels, form fields,
  navigation, and empty states.
- Preserve the quiet editorial dashboard style and avoid generic Web3 visuals.

### 2. Componentize the dashboard

- Sidebar and mobile navigation
- Page header and transaction actions
- Portfolio summary and allocation visual
- Vault profile selector and vault cards
- Agent status and decision ledger
- Activity and transaction rows

Each component must expose loading, empty, unavailable, error, pending, and
confirmed states without changing its outer dimensions unexpectedly.

### 3. Add wallet and network UX

- Configure wagmi and viem for the verified testnet
- Connect/disconnect wallet
- Detect and switch network
- Display account, balance, and explorer links
- Keep wallet errors recoverable and human-readable

### 4. Add transaction flows

- Exact USDT approval
- Deposit into the selected vault
- Partial/full withdrawal
- Pending receipt, success, rejection, and failure states
- Refetch balances and activity after confirmation

### 5. Connect decisions

- Call the preview endpoint from `API_CONTRACT.md`
- Render reason code, explanation, allocation, input hash, expiry, and policy
  result
- Display execution status from verified chain events
- Never manufacture a successful execution locally

### 6. Complete the motion system

- GSAP page and panel entrances
- State-change transitions for allocation and status
- Modal/drawer transitions
- Activity-row insertion motion
- Reduced-motion alternatives for every effect

Motion must communicate state or hierarchy. It must not delay wallet prompts,
transaction confirmation, errors, or withdrawals.

### 7. Verify integration

Use `FRONTEND_BACKEND_TESTING.md` at desktop and mobile widths. Check semantic
interactions, console errors, layout stability, transaction states, and the full
testnet loop before Mainnet work begins.
