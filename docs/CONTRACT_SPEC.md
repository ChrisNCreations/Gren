# Contract Specification

This is the MVP contract target. It is a behavioral specification, not a claim
that the interfaces are already deployed.

## Deployment model

Deploy one `GrenVault` implementation three times:

| Vault | Maximum BDEX exposure | Maximum slippage |
| --- | ---: | ---: |
| Conservative | 25% | 0.5% |
| Balanced | 45% | 0.8% |
| Aggressive | 70% | 1.2% |

All three instances use the same verified USDT token on the target testnet.

## Roles

- `owner`: emergency configuration and role administration
- `policyAdmin`: changes bounded policy parameters and strategy allowlists
- `keeper`: submits decisions; cannot change policy or withdraw user funds
- `pauser`: can pause strategy execution and deposits when necessary
- users: deposit, inspect, and withdraw their own shares

Use explicit role checks. Keep administrative roles separate even if the first
testnet deployment temporarily assigns them to one multisig or operator.

## Decision payload

The canonical payload must contain at least:

```solidity
struct AllocationDecision {
    bytes32 decisionId;
    address vault;
    uint8 profile;
    uint16 reserveBps;
    uint16 dexBps;
    uint16 slippageBps;
    address asset;
    address strategy;
    bytes32 reasonCode;
    bytes32 inputHash;
    uint256 snapshotTotalAssets;
    uint256 snapshotTotalShares;
    uint16 snapshotReserveBps;
    uint16 snapshotDexBps;
    uint64 snapshotAt;
    uint64 expiresAt;
    uint64 policyVersion;
}
```

`reserveBps + dexBps` must equal `10_000`. The contract must reject a payload
whose `vault` is not the calling vault, whose profile does not match the vault,
or whose expiry, ID, or input hash is invalid.

The current testnet deployment has `bdexEnabled = false`. The only accepted
execution is `reserveBps = 10_000`, `dexBps = 0`, and `slippageBps = 0`. The
reserve adapter performs no external protocol call and leaves USDT in the
vault so withdrawals remain direct and keeper-independent.

The input hash is the keccak256 hash of the canonical ABI encoding of the vault,
profile, USDT address, snapshot totals, current allocation, snapshot timestamp,
and policy version. The vault compares every snapshot value with current state
and enforces a 15-minute freshness window. Testnet deployment uses a one-hour
rebalance cooldown.

## Required events

Emit events with enough data for the frontend and a lightweight indexer:

- `Deposited(address indexed user, uint256 assets, uint256 shares)`
- `Withdrawn(address indexed user, uint256 assets, uint256 shares)`
- `DecisionAccepted(bytes32 indexed decisionId, bytes32 inputHash)`
- `DecisionRejected(bytes32 indexed decisionId, bytes32 reasonCode)`
- `RebalanceExecuted(bytes32 indexed decisionId, uint256 reserveBps, uint256 dexBps)`
- `StrategyAllowlistChanged(address indexed strategy, bool allowed)`
- `Paused(address indexed account)` and `Unpaused(address indexed account)`

Use the repository's established naming if an implementation requires a slight
variation, but update `packages/shared` and this document together.

## Invariants

Tests must establish that:

1. Total shares and asset conversions remain coherent after deposits/withdrawals.
2. A user cannot withdraw another user's assets.
3. An expired or replayed decision cannot execute.
4. A decision cannot exceed profile exposure or slippage limits.
5. An unallowlisted strategy cannot be called.
6. Arbitrary external calldata cannot be supplied by the agent.
7. Pausing strategy execution does not silently destroy withdrawal access.
8. A failed execution leaves accounting and decision state consistent.

Policy-invalid keeper calls emit `DecisionRejected` and return `false` without
consuming the decision ID or changing accounting. Unauthorized callers revert.
