# Gren Agent Handoff

Read this file before changing backend or contract code. It is the shortest
implementation contract for an AI coding agent working in the Gren repository.

## Current state

The repository contains:

- `apps/web`: production Next.js UI shell using the Gren design system
- `apps/agent`: Hono decision API (`/health`, preview, execute, status), keeper, store, and Groq model adapter with a deterministic reserve-only fallback
- `packages/shared`: BOT Chain constants and decision validation schema
- `contracts`: Foundry `GrenVault` + reserve strategy with BDEX disabled
- `prototype`: preserved visual and interaction reference

The frontend is intentionally ahead of the backend. Do not replace its design
with a generic dashboard and do not rewrite `prototype/` as part of backend work.

## Product in one sentence

Gren lets a user deposit USDT into one of three risk-specific BOT Chain vaults;
an agent proposes bounded allocations, a restricted keeper submits them, and
on-chain policy contracts decide whether they can execute.

## Non-negotiable decisions

1. USDT is the only MVP deposit asset.
2. Conservative, Balanced, and Aggressive are separate vault instances.
3. The vault underlying is USDT. WBOT is not a second deposit asset in the MVP.
4. The AI may produce a structured proposal, never arbitrary calldata.
5. The keeper may submit a proposal, but contracts enforce all safety limits.
6. Withdrawals must work when the agent, model provider, or keeper is offline.
7. Build and prove the complete loop on testnet first. Mainnet is a later gate.
8. Never copy Mainnet addresses into testnet configuration.
9. Do not claim audited, non-custodial, yield-bearing, or Mainnet-ready behavior
   without deployed evidence.

## Ownership boundaries

Backend agent owns:

- Solidity contracts, Foundry tests, deployment scripts, and deployment artifacts
- Agent API, deterministic policy logic, keeper worker, and server-side storage
- Shared ABI exports and backend-facing schemas

Frontend agent owns:

- `apps/web` components, wallet UX, transaction states, responsive layout,
  GSAP motion, and browser verification
- Rendering chain events and agent responses without inventing financial state

Both agents must coordinate through `packages/shared` and the documents in
`docs/`. Do not silently change the vault model or decision schema.

Use `FRONTEND_BACKEND_TESTING.md` as the acceptance checklist when connecting
contract and agent behavior to the Next.js interface.

## Required completion evidence

Backend work is not complete until all of these exist:

- Unit and invariant tests for vault accounting and policy boundaries
- A testnet deployment artifact with chain ID, addresses, and transaction hashes
- A testnet smoke test covering approve, deposit, decision rejection, allowed
  execution, and partial/full withdrawal
- A keeper key with limited permissions and documented rotation/revocation
- API examples that the frontend can call without reading server secrets
- `forge test`, `pnpm.cmd typecheck`, and `pnpm.cmd build` passing

## Safe default when uncertain

Choose the smallest testnet implementation that proves custody, policy, and
withdrawal. Keep BDEX execution disabled until its router, pool, liquidity,
price source, and unwind path have been verified on the target testnet.
