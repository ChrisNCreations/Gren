# Project Overview

## Problem

On-chain portfolio automation is difficult to trust. Users often cannot see
why an action happened, what authority an agent holds, or what limits protect
their funds.

## Product

Gren provides three USDT vaults on BOT Chain, each with a fixed risk policy.
An off-chain agent evaluates approved signals and proposes a bounded allocation.
A keeper submits the proposal, and contracts independently enforce every limit.

## MVP users

- BOT Chain users who hold USDT and want transparent automated allocation
- Hackathon judges evaluating a complete AI-to-on-chain execution loop

## MVP capabilities

- Connect and switch an EVM wallet to BOT Chain Mainnet
- Choose a Conservative, Balanced, or Aggressive vault
- Approve and deposit USDT, receiving vault shares
- See balance, allocation, policy limits, and transaction history
- Run or observe an AI evaluation with structured reasoning
- Execute an allowed rebalance through a restricted keeper
- Withdraw part or all of the position

## Non-goals

- Guaranteed returns or investment advice
- Unverified yield claims
- Arbitrary AI-generated transactions
- Multiple deposit assets
- Cross-chain operation
- A production-grade RWA strategy during the hackathon

## Success criteria

The public application completes the full loop on BOT Chain Mainnet with a
small controlled amount and exposes explorer links for every material action.
