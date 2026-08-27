# Phase 4: Mainnet Gate

This document tracks the checklist before deploying to BOT Chain Mainnet (chain ID 677).

## Gate Requirements

Per `docs/BUILD_PHASES.md`, the mainnet gate requires:

1. **Testnet evidence complete** — 17/17 Foundry tests pass, full-stack typecheck clean
2. **Code review complete** — Phase 3 diff reviewed and committed
3. **Mainnet addresses verified** — USDT, chain ID, RPC, explorer confirmed
4. **Deploy scripts updated** — New constructor signature (with `bdexEnabled` param) applied to both testnet and mainnet scripts
5. **Verification script updated** — `VerifyMainnet.s.sol` checks `inventoryAdapter`, `bdexEnabled`, all roles
6. **Smoke test script ready** — End-to-end test script for mainnet
7. **Owner approval** — Explicit confirmation before running `deploy-mainnet.ps1`

## Pre-Deploy Checklist

- [x] Testnet smoke test passed (deposit → decision → execute → withdraw)
- [x] All 17 Foundry tests green (`forge test --no-match-path "lib/*"`)
- [x] TypeScript typecheck clean (`pnpm -r typecheck`)
- [ ] `foundry.toml` has `botchainMainnet` RPC endpoint configured
- [ ] `.env.local` has `BOT_CHAIN_MAINNET_RPC_URL` and `MAINNET_USDT_ADDRESS` set
- [ ] Mainnet USDT address verified: `0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C`
- [ ] Mainnet chain ID verified: `677`
- [ ] Deployer and policy admin private keys funded for gas
- [ ] Owner, policyAdmin, pauser, keeper addresses are distinct and correct
- [ ] `bdexEnabled = false` in `DeployMainnet.s.sol` (BDEX not active on mainnet initial deploy)

## Deployment Steps

1. Ensure `.env.local` has all required variables (see `.env.example` for template)
2. Run: `./scripts/deploy-mainnet.ps1`
3. Script will:
   - Deploy 3 GrenVault instances (conservative/balanced/aggressive)
   - Deploy 3 ReserveStrategy instances
   - Allowlist each strategy on its vault
   - Write pending artifact → finalize → verify → sync env
4. Check deployment artifact at `contracts/script/deployments/bot-chain-mainnet.json`

## Post-Deploy Verification

1. Run `VerifyMainnet.s.sol` to confirm on-chain state matches expectations
2. Run smoke test (deposit → decision → execute → withdraw)
3. Verify all addresses on explorer: `https://scan.botchain.ai`

## Smoke Test

Run `node scripts/smoke-test-mainnet.mjs` to execute end-to-end on mainnet:
- Connects to mainnet RPC
- Reads deployment artifact
- Verifies bytecode exists at all addresses
- Checks vault state (totalAssets, policy, roles)
- Checks strategy allowlist
- Checks role separation

## Rollback

If deployment fails or verification reveals issues:
- Owner can pause vaults via `PAUSER_ROLE`
- Keeper role can be revoked
- No funds at risk until deposits begin
