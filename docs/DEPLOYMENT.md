# Deployment

## Environments

- Local: mock contracts or local fork
- Mainnet smoke: tiny controlled funds and restricted access
- Public demo: verified configuration and monitored keeper

## Contract release

1. Verify chain ID, RPC, USDT decimals/code, router ABI, pool, and price source.
2. Run formatting, unit, invariant, and relevant fork tests.
3. Deploy implementations and three vault instances.
4. Configure each policy and strategy allowlist.
5. Assign roles and revoke deployer permissions that are no longer needed.
6. Verify source on the explorer where supported.
7. Save addresses and transaction hashes in a versioned deployment artifact.
8. Perform deposit, decision, rebalance, and withdrawal smoke tests.

## Application release

Deploy the web app and agent separately. For a public testnet release, use:

- Vercel project rooted at `apps/web` for the Next.js web app.
- One always-on Render web service for `apps/agent`.
- Supabase Postgres for decision records when `DECISION_STORE_BACKEND=supabase`.

The Vercel project receives only `NEXT_PUBLIC_*` values and an HTTPS
`NEXT_PUBLIC_AGENT_URL`. Render receives the keeper key, agent API key, and
Supabase service-role key. Never place those values in Vercel or the browser.

Apply `supabase/migrations/202608190001_decision_records.sql` before starting a
Supabase-backed agent. Keep one Render instance until execution storage is
replaced with a shared atomic claim mechanism.

The repository includes `render.yaml` and `apps/web/vercel.json` as starting
configuration. Set `AGENT_ALLOWED_ORIGINS` to the exact Vercel origin, not `*`.
Health checks must not expose configuration or keys.

For Vercel, set the project root to `apps/web`, enable access to workspace files
outside that directory, use Node.js 20, and configure Production and Preview
values for:

```text
NEXT_PUBLIC_BOT_CHAIN_RPC_URL
NEXT_PUBLIC_BOT_CHAIN_EXPLORER_URL
NEXT_PUBLIC_BOT_CHAIN_ID
NEXT_PUBLIC_USDT_ADDRESS
NEXT_PUBLIC_CONSERVATIVE_VAULT_ADDRESS
NEXT_PUBLIC_BALANCED_VAULT_ADDRESS
NEXT_PUBLIC_AGGRESSIVE_VAULT_ADDRESS
NEXT_PUBLIC_AGENT_URL=https://<render-agent-domain>
```

## Rollback

Frontend and agent deployments may roll back to a prior build. Contracts require
a documented pause, role-revocation, or upgrade procedure. Do not assume a web
rollback reverses an on-chain configuration change.
