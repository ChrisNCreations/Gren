# Deployment scripts

Scripts must deploy and configure the three vault instances, verify policy
parameters, transfer administrative roles, and write addresses to a versioned
deployment artifact.

- Testnet: `DeployTestnet.s.sol` / `VerifyTestnet.s.sol` / `scripts/deploy-testnet.ps1`
- Mainnet: `DeployMainnet.s.sol` / `VerifyMainnet.s.sol` / `scripts/deploy-mainnet.ps1`

Testnet enables `bdexEnabled` on the aggressive vault only, after verifying the
BotDex V2 router, factory, WBOT/USDT pair, liquidity, and pair-reserve quote.
Mainnet keeps `bdexEnabled = false`. Do not run the Mainnet script until the
Phase 4 gate in `docs/BUILD_PHASES.md` is explicitly approved.

Live Phase 3 smoke:

```powershell
node ..\scripts\smoke-test-testnet.mjs --live
```

That broadcasts `script/SmokeBdexTestnet.s.sol` (deposit → BDEX rebalance →
withdraw that forces unwind). Record the resulting hashes in `docs/EVIDENCE.md`.
