# Deployment scripts

Scripts must deploy and configure the three vault instances, verify policy
parameters, transfer administrative roles, and write addresses to a versioned
deployment artifact.

- Testnet: `DeployTestnet.s.sol` / `VerifyTestnet.s.sol` / `scripts/deploy-testnet.ps1`
- Mainnet: `DeployMainnet.s.sol` / `VerifyMainnet.s.sol` / `scripts/deploy-mainnet.ps1`

Both paths keep `bdexEnabled = false`. Do not run the Mainnet script until the
Phase 4 gate in `docs/BUILD_PHASES.md` is explicitly approved.
