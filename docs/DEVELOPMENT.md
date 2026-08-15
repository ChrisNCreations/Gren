# Development

## Prerequisites

- Node.js 20 or newer
- pnpm 9
- Foundry
- An EVM wallet configured for BOT Chain

## Install and run

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

- Web: `http://localhost:3000`
- Agent health: `http://localhost:8787/health`
- Prototype: run `pnpm prototype`, then use `http://localhost:4173`

## Validation

```powershell
pnpm typecheck
pnpm test
pnpm build
Set-Location contracts
forge fmt --check
forge build
forge test
```

## Testnet configuration

Use a network-specific env file or deployment profile. The backend must fail
fast when a testnet RPC, chain ID, USDT address, or explorer URL is missing.
Never reuse the Mainnet USDT or router address as a testnet placeholder.

Record the resulting chain ID, deployed addresses, and transaction hashes in a
network-specific artifact under `contracts/script/deployments/`.

## Engineering rules

- Never commit private keys or funded demo secrets.
- Keep public and server-only environment variables separate.
- Validate all agent output at the API boundary and again on-chain.
- Do not hardcode deployed addresses in multiple packages.
- Add tests alongside contract and transaction-flow changes.
- Preserve `prototype/` as a reference until production parity is reached.
- Backend changes must read `docs/AGENT_HANDOFF.md` before implementation.
- Do not deploy to Mainnet until the testnet exit gates in `docs/BUILD_PHASES.md`
  are complete and explicitly approved.
