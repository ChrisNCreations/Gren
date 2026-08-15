# Gren contracts

This directory is a Foundry project for the BOT Chain Testnet vertical slice.
The testnet USDT contract and decimals are verified before deployment. Reserve
custody and withdrawals do not require a router, pool, price source, or BDEX
integration.

Planned components:

- `GrenVault`: ERC-4626 vault implementation deployed once per risk profile
- `PolicyManager`: exposure, slippage, cooldown, expiry, and caller checks
- `StrategyRegistry`: allowlisted strategy adapters
- `ReserveStrategy`: liquid USDT reserve
- `BdexStrategy`: intentionally disabled until router, pool, liquidity, pricing,
  slippage, and unwind checks are complete

The keeper may submit a structured decision, but contracts must reject any
decision outside configured policy. No model-generated arbitrary calldata is
accepted.

Foundry dependencies are pinned for this slice: OpenZeppelin Contracts `v5.4.0`
and forge-std `v1.10.0`. Install them under `contracts/lib/` before building a
fresh checkout.
