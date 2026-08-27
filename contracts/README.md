# Gren contracts

This directory is a Foundry project for the BOT Chain Testnet vertical slice.
The testnet USDT contract and decimals are verified before deployment.
Conservative and balanced vaults stay reserve-only. The aggressive vault may
route a capped slice through the verified BotDex V2 WBOT/USDT pool.

Components:

- `GrenVault`: ERC-4626 vault implementation deployed once per risk profile
- `ReserveStrategy`: liquid USDT reserve
- `BdexStrategy`: allowlisted BotDex V2 adapter, enabled only on the aggressive
  testnet vault after pool, route, liquidity, pair-reserve oracle, and unwind
  checks

The keeper may submit a structured decision, but contracts must reject any
decision outside configured policy. No model-generated arbitrary calldata is
accepted.

Foundry dependencies are pinned for this slice: OpenZeppelin Contracts `v5.4.0`
and forge-std `v1.10.0`. Install them under `contracts/lib/` before building a
fresh checkout.
