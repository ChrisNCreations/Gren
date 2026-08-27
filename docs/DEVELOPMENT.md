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

Phase 3 BDEX evidence on BOT Chain Testnet:

```powershell
pnpm deploy:testnet
node scripts/smoke-test-testnet.mjs
node scripts/smoke-test-testnet.mjs --live
```

The live smoke deposits 10 testnet USDT into the aggressive vault, executes a
70% BotDex V2 rebalance, then withdraws 6 USDT so idle USDT is insufficient and
the adapter must unwind WBOT. Copy the three transaction hashes into
`docs/EVIDENCE.md`. Verified testnet route: router
`0xD6425a02f0845B8D99e349C34D2E7A576E177345`, pair
`0xD3EC267707BA234583645E75CE283Cf679dd94Fa`, WBOT
`0xD5452816194a3784dBa983426cCe7c122F4abd30`. The pair reserves are the
on-chain oracle used by `BdexStrategy`.

## Engineering rules

- Never commit private keys or funded demo secrets.
- Keep public and server-only environment variables separate.
- Validate all agent output at the API boundary and again on-chain.
- Do not hardcode deployed addresses in multiple packages.
- Add tests alongside contract and transaction-flow changes.
- Preserve `prototype/` as a reference until production parity is reached.
- Backend changes must read `docs/AGENT_HANDOFF.md` before implementation.
- Do not deploy to Mainnet until the testnet exit gates in `docs/BUILD_PHASES.md`
  are complete and explicitly approved. When that gate is approved, use
  `scripts/deploy-mainnet.ps1`. Keep `bdexEnabled = false` on Mainnet until
  Phase 3 evidence exists.
