# Build Phases

## Phase 0: Foundation

- Independent Git repository and GitHub remote
- Workspace, environment template, and context documents
- Verified target-testnet RPC, chain ID, USDT bytecode and decimals, explorer,
  and faucet path

Exit gate: clean install, typecheck, Foundry available, and a documented target
testnet configuration. Mainnet addresses are not used as testnet defaults.

## Phase 1: Testnet custody loop

- Minimal ERC-4626 vault and policy contracts
- Deposit and withdrawal tests
- Testnet deployment with tiny controlled funds
- Real wallet, approve, deposit, balance, and withdraw UI on testnet

Exit gate: public UI completes deposit and withdrawal on testnet and records the
transaction hashes.

## Phase 2: Testnet agent loop

- Structured input snapshot and decision schema
- Deterministic baseline policy plus model explanation
- Restricted keeper and replay/expiry checks
- Decision events and UI evidence

Exit gate: an agent decision causes one bounded testnet state change and one
out-of-bounds decision is visibly rejected.

## Phase 3: Testnet strategy integration

- Verify BDEX pool, route, liquidity, oracle, and unwind path
- Implement adapter and slippage tests
- Enable exposure per vault only after smoke tests

Exit gate: rebalance and withdrawal succeed under realistic testnet liquidity.

## Phase 4: Mainnet gate

- Confirm testnet evidence and code review are complete
- Re-verify every Mainnet address, ABI, pool, liquidity source, and oracle
- Deploy with a new network-specific artifact and controlled funds
- Repeat the full smoke test before enabling the public demo

Exit gate: explicit owner approval after testnet completion. No agent should
silently promote a testnet configuration to Mainnet.

## Phase 5: Submission

- Public deployment, monitoring, and seeded demo position
- Repository cleanup and reproducible instructions
- Explorer links, screenshots, demo video, and submission copy

Exit gate: a fresh wallet can complete the judged flow without team assistance.
