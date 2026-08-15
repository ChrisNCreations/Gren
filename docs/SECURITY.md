# Security

## Trust model

Users trust audited contract behavior and configured administrators. They do not
need to trust model output. The keeper can request an allowed action but cannot
bypass policy or withdraw user assets to itself.

## Required controls

- Reentrancy protection and checks-effects-interactions ordering
- Role separation for owner, policy administrator, pauser, and keeper
- Allowlists for tokens, routers, pools, and strategy adapters
- Allocation, slippage, cooldown, expiry, and replay checks on-chain
- Safe ERC-20 approval handling
- Fresh price requirements and manipulation-resistant valuation
- Pausable strategy execution with withdrawals available where practical
- Emergency strategy unwind and keeper revocation

## Test requirements

- Unit tests for every policy boundary and access-control path
- Invariant tests for asset/share accounting and total allocations
- Adversarial tests for stale inputs, replay, malicious tokens, and reentrancy
- Testnet smoke tests with minimal funds
- Withdrawal tests while the agent, keeper, or BDEX route is unavailable

## Operational rules

Use a dedicated low-balance keeper key. Store secrets only in the deployment
platform. Record configuration changes and publish deployed addresses. Do not
market the contracts as audited unless an actual audit has occurred.
