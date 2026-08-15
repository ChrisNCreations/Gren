# VS Code Agent Prompts

Use the following prompt as the initial handoff to the backend coding agent.

## Initial backend prompt

```text
You are the backend and smart-contract engineer for Gren. Work in the Gren
repository and read these files before changing code:

1. docs/AGENT_HANDOFF.md
2. docs/BACKEND_IMPLEMENTATION.md
3. docs/CONTRACT_SPEC.md
4. docs/API_CONTRACT.md
5. docs/ARCHITECTURE.md
6. docs/SECURITY.md
7. docs/BUILD_PHASES.md
8. docs/FRONTEND_BACKEND_TESTING.md

Your current goal is testnet custody and policy, not Mainnet deployment.

Non-negotiable product decisions:
- USDT only for the MVP.
- Three separate vault instances: Conservative, Balanced, Aggressive.
- AI produces structured decisions, never arbitrary calldata.
- Keeper permissions are restricted and withdrawals must work without the keeper.
- BDEX execution stays disabled until the target testnet router, pool,
  liquidity, price source, slippage, and unwind path are verified.

First inspect the repository and report assumptions. Then implement the smallest
testnet vertical slice: verified network config, GrenVault, policy checks,
reserve-only strategy, Foundry tests, deployment script, and the agent preview
endpoint. Do not rewrite apps/web or prototype styling.

At the end of each task report files changed, commands run, test results,
deployment assumptions, and the exact frontend/API/event changes required.
Never claim a simulated transaction is implemented.
```

## Follow-up prompt: contract phase

```text
Continue with the contract phase from docs/CONTRACT_SPEC.md. Implement or
finish the USDT ERC-4626 vault and policy boundary for testnet. Add tests for
accounting, access control, replay, expiry, exposure, slippage, cooldown,
allowlists, pause behavior, and withdrawals. Keep BDEX disabled unless you can
provide verified target-testnet evidence. Run forge fmt, forge test, and forge
build. Do not deploy to Mainnet.
```

## Follow-up prompt: agent phase

```text
Continue with the agent phase from docs/BACKEND_IMPLEMENTATION.md and
docs/API_CONTRACT.md. Implement deterministic input snapshots, decision schema
validation, preview responses, explanation persistence, and a restricted keeper
submission path. The frontend must never receive a private key. Add tests for
invalid allocations, stale input, expiry, duplicate decision IDs, and rejected
policy results. Run pnpm.cmd typecheck and pnpm.cmd build.
```
