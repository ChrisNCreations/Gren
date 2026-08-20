# Backend and Frontend Contract

This file is the integration boundary between `apps/agent`, `contracts`, and
`apps/web`. Changes require updating the shared schema and notifying the other
agent.

## Status vocabulary

Use these exact user-facing states:

- `not_connected`
- `awaiting_network`
- `awaiting_approval`
- `pending_confirmation`
- `confirmed`
- `rejected_by_policy`
- `failed`
- `unavailable`

Do not render a pending, preview, or local state as confirmed on-chain state.

## Decision preview request

`POST /v1/decisions/preview` accepts only structured data. The snapshot is
optional and is treated as an advisory client observation; the agent reads the
authoritative vault state from BOT Chain before hashing or validating a decision.

```json
{
  "vault": "0x...",
  "profile": "balanced",
  "snapshot": {
    "totalAssets": "1000000",
    "totalShares": "1000000",
    "reserveBps": 10000,
    "dexBps": 0,
    "policyVersion": "1",
    "observedAt": 0
  },
  "proposal": {
    "reserveBps": 10000,
    "dexBps": 0,
    "slippageBps": 0,
    "reasonCode": "RESERVE_ONLY"
  }
}
```

`proposal` may contain a bounded allocation for policy preview, but it never
contains a target, value, router, or arbitrary calldata field. The testnet
baseline is reserve-only and rejects all nonzero BDEX allocation. The dashboard
reject demo uses `dexBps: 1` so the visible reason is `BDEX_DISABLED`.

## Decision response shape

```json
{
  "decisionId": "0x...",
  "vault": "0x...",
  "profile": "balanced",
  "allocation": {
    "reserveBps": 5500,
    "dexBps": 4500
  },
  "reasonCode": "VOLATILITY_WITHIN_BAND",
  "explanation": "string for the decision log",
  "inputHash": "0x...",
  "expiresAt": 0,
  "policy": {
    "status": "accepted",
    "reasons": []
  },
  "execution": {
    "status": "not_submitted",
    "transactionHash": null,
    "explorerUrl": null
  }
}
```

The schema in `packages/shared/src/decision.ts` is the validation source. Add
fields there first, then update the agent and web types.

`POST /v1/decisions/execute` accepts only `{ "decisionId": "0x..." }` for a
previously stored, policy-accepted preview. The keeper key is always
server-only. Authorization is either:

- `Authorization: Bearer <AGENT_API_KEY>` for server-to-server callers, or
- a browser `Origin` that exactly matches `AGENT_ALLOWED_ORIGINS`

Requests with neither an API key nor an allowlisted origin receive `401`.
`GET /v1/decisions/:decisionId` refreshes execution status from the
transaction receipt and verified decision events.

## Chain data rules

- Wallet balances, allowances, shares, and execution status come from chain reads
  or verified event logs.
- Agent explanations may come from the server but must be anchored by `inputHash`.
- The frontend may show a local pending state, but it must refetch after a
  confirmation or failure.
- Explorer URLs are built from the active network configuration, never guessed.
- Testnet execution statuses are derived from `DecisionAccepted` or
  `DecisionRejected` events; a successful transaction receipt alone is not an
  accepted decision.
