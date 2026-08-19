# Gren

Gren is an AI-guided portfolio manager for BOT Chain. Users deposit USDT into a
risk-specific vault, while an off-chain agent proposes structured allocation
decisions and on-chain policy contracts enforce what may be executed.

The project targets the AI Native Applications track of BOT Chain Builder
Challenge #2.

## Repository layout

```text
apps/web/        Next.js wallet and portfolio application
apps/agent/      Decision API and keeper worker
contracts/       Foundry contracts, tests, and deployment scripts
packages/shared/ Shared chain configuration and decision schemas
prototype/       Preserved browser-native product prototype
docs/            Product, architecture, security, and delivery context
```

## MVP decisions

- BOT Chain Mainnet is the production target; implementation is testnet-first
- USDT is the only deposit asset
- Conservative, Balanced, and Aggressive are separate vault instances
- AI produces structured proposals; it never receives arbitrary transaction
  authority or custody
- Contracts enforce allowlists, exposure limits, slippage, cooldowns, expiry,
  and replay protection

## Public testnet hosting

The recommended public topology is Vercel for `apps/web`, Render for the
long-running agent/keeper, and Supabase Postgres for durable decision records.
See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and `supabase/README.md`. Supabase
service-role credentials and keeper keys belong only on Render.

## Getting started

Prerequisites: Node.js 20+, pnpm 9+, and Foundry.

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

The preserved prototype can be served separately:

```powershell
pnpm prototype
```

Then open `http://localhost:4173`.

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the complete local workflow
and [docs/BUILD_PHASES.md](docs/BUILD_PHASES.md) for implementation order.

Backend agents must start with [docs/AGENT_HANDOFF.md](docs/AGENT_HANDOFF.md),
then follow [docs/BACKEND_IMPLEMENTATION.md](docs/BACKEND_IMPLEMENTATION.md).
Mainnet work requires the explicit gate described in `docs/BUILD_PHASES.md`.
