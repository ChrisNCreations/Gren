# Backend Implementation Guide

This document explains what the backend agent should build, in which order, and
how the services communicate. It is deliberately more concrete than the
architecture overview.

## Repository map

```text
contracts/src/core/          vault, policy, roles, errors, events
contracts/src/interfaces/    Gren and external protocol interfaces
contracts/src/strategies/    reserve and optional BDEX adapters
contracts/test/               unit, invariant, and fork tests
contracts/script/             deployment and configuration scripts
apps/agent/src/decisions/     input snapshots and decision generation
apps/agent/src/keeper/        restricted transaction submission
apps/agent/src/store/         explanation metadata and event indexing
packages/shared/src/          chain config, schemas, and ABI exports
```

## Delivery order

### Step 1: Verify the target testnet

Before writing protocol integrations, record the target testnet chain ID, RPC,
explorer, USDT address, decimals, deployment tool behavior, and faucet process.
Create a network-specific configuration. Reject missing or contradictory values
at startup.

### Step 2: Build the custody loop

Implement one `GrenVault` contract and deploy three instances with different
policy parameters. The first testnet version may hold all assets in the USDT
reserve strategy. It must support:

- `deposit` and `mint` for USDT
- `withdraw` and `redeem` for USDT
- share accounting that remains correct after multiple users and withdrawals
- pause controls that do not unnecessarily lock withdrawals
- emitted events for every user-visible state change

Use one implementation with constructor or initializer configuration per vault.
Do not create three divergent contract codepaths.

### Step 3: Add the policy boundary

The policy manager or vault must validate:

- keeper authorization
- profile/vault match
- unique decision ID
- decision expiry
- fresh input hash
- allocation totals equal `10_000` basis points
- profile exposure cap
- slippage cap
- rebalance cooldown
- allowlisted strategy and asset

Rejected decisions must emit a reason that the frontend can display. A failed
policy check must not mutate balances or consume a valid decision ID unless the
contract explicitly documents that behavior.

### Step 4: Add typed strategy execution

The reserve adapter should be the default and keep funds liquid in USDT. BDEX
execution is disabled until testnet verification proves the exact router call,
pool, quote source, liquidity, slippage behavior, and unwind path.

Do not expose a function that accepts arbitrary `target`, `value`, and `bytes`
from the model. Strategy adapters own their own typed calls and allowlists.

### Step 5: Add the agent and keeper

The agent reads a chain snapshot, produces a schema-valid decision, and stores
the explanation plus the hash of its inputs. The keeper submits only unexpired,
unreplayed decisions through the contract. The keeper key must not be an owner
or policy-admin key.

While BDEX is disabled, allocation stays deterministic (`reserveBps = 10_000`).
`apps/agent/src/decisions/model.ts` asks an OpenAI-compatible model (default Groq
`openai/gpt-oss-20b`) for the explanation. Missing key, timeout, or invalid JSON
falls back to the reserve-only engine. A client-supplied `proposal` is still
accepted so preview can demonstrate `policy.status: "rejected"`. Do not change
`GET /health`; it remains service, status, and version only.

### Step 6: Prove the testnet loop

Run this exact sequence with a small testnet amount:

`connect -> approve -> deposit -> read state -> preview decision -> reject an out-of-bounds decision -> execute an allowed decision -> inspect event -> withdraw`

Capture transaction hashes and add them to the deployment/evidence artifact.

## Backend API target

The frontend should be able to use these server endpoints without secrets:

### `GET /health`

Returns service status and version. It must not include keys or environment
values.

### `POST /v1/decisions/preview`

Accepts a vault address and a read-only input snapshot. Returns a structured
decision, explanation, input hash, expiry, and policy validation result. This
endpoint does not submit a transaction.

### `POST /v1/decisions/execute`

Server-to-server or authenticated keeper endpoint. Accepts only a previously
validated decision ID. The frontend must not receive the keeper private key.

### `GET /v1/decisions/:decisionId`

Returns explanation metadata and on-chain status. The chain remains the source
of truth for execution and balances.

## Definition of done

The backend agent should report:

- files changed and why
- contract addresses by network
- test commands and results
- remaining security or integration assumptions
- exact frontend API/event changes required

Never report a simulated flow as an implemented transaction flow.
