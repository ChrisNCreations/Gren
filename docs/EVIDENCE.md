# Gren Submission Evidence

Date: 2026-08-20

This log records the on-chain and service-level proof that the Gren testnet
deployment works end to end. Every claim below is reproducible by reading the
public chain or running the included commands.

## Network and demo wallet

- Network: BOT Chain Testnet
- Chain ID: `968`
- RPC: `https://rpc.bohr.life`
- Explorer: `https://scan.bohr.life`
- USDT: `0x75edC9335175Fc0552D51D48439F229c10420fe3` (6 decimals)
- Demo wallet used for the custody loop:
  `0x81E8b650e147F0e3979Cf6b1D4757521cE7CCa88`

## Deployed contracts

Source of truth: `contracts/script/deployments/bot-chain-testnet.json`.

| Component | Address |
| --- | --- |
| Conservative vault | `0xBe47CA0C0b7346CC6764F33D72Fd691DB9B633E8` |
| Balanced vault | `0x7039E9A0495Be912A1589a979D862ED5d0f26e29` |
| Aggressive vault | `0x454d00aa518f2CA47bb4a127A1B86c3216c049c8` |
| Conservative reserve | `0x2022E743f1A2e144a72238F93892920Cfe2Ee331` |
| Balanced reserve | `0xabafd0BcE9991E712ea046c8bB88f7395A3284CB` |
| Aggressive reserve | `0x758990be9DbD19C288fD7C9a9B3525BA0eB2256E` |

Roles (all distinct): owner `0x25D8bE97…8e051`, policyAdmin `0x5Bd41F6A…00a9`,
pauser `0x81E8b650…CCa88`, keeper `0x29754aA2…2c46`.

Deployment block: `20_439_347` (`0x137e133`).

## Custody loop proof

A real wallet approved, deposited, and partially withdrew USDT on the balanced
vault.

| Action | Amount | Transaction hash | Explorer |
| --- | ---: | --- | --- |
| Deposit | 10 USDT | `0x9f521a7327b00d311b8309f2d69899a76a71607bfc3544ad785316316a81de1d` | https://scan.bohr.life/tx/0x9f521a7327b00d311b8309f2d69899a76a71607bfc3544ad785316316a81de1d |
| Withdraw | 5 USDT | `0x9b2aa2363041c2551f6317fb8b8f331bfa6bc962ca1ecb3c69ef2ce51af6d5a4` | https://scan.bohr.life/tx/0x9b2aa2363041c2551f6317fb8b8f331bfa6bc962ca1ecb3c69ef2ce51af6d5a4 |

Both transactions are confirmed (status `0x1`) against the balanced vault and
emit the vault `Deposited` / `Withdrawn` events.

## Agent and policy proof

The keeper submitted allowed reserve-only decisions. Each receipt emits
`DecisionAccepted` and `RebalanceExecuted`. The 2026-08-20 UI run was started
from the dashboard Execute button; the browser did not receive a keeper key.

| Action | Vault | Transaction | Explorer |
| --- | --- | --- | --- |
| Execute allowed decision (keeper API) | Conservative | `0x922f06b26f92489b472d39cc9ce78682b667be8eb58698f8a8f8eea65288cf8c` | https://scan.bohr.life/tx/0x922f06b26f92489b472d39cc9ce78682b667be8eb58698f8a8f8eea65288cf8c |
| Execute allowed decision (dashboard Execute) | Balanced | `0x13e1624076a7488a244f9f60eb26a39f9118db07ba14788a4177abca57e0836b` | https://scan.bohr.life/tx/0x13e1624076a7488a244f9f60eb26a39f9118db07ba14788a4177abca57e0836b |

The UI execute receipt (`0x13e16240…`) is status `0x1` against the balanced vault
`0x7039E9A0495Be912A1589a979D862ED5d0f26e29`, submitted by keeper
`0x29754aA2422332F8122a94F52C804f2d66872c46`. Event topics:

- `0x03cb5bc8…` = `DecisionAccepted(bytes32,bytes32)`
- `0xf89a436f…` = `RebalanceExecuted(bytes32,uint256,uint256)`
- `0x5a093213…` = reserve strategy `ReserveMaintained`

The Decisions view lists both accepted executions with explorer links.

Agent service is live and healthy: `GET https://gren-pls2.onrender.com/health`
returns `{"service":"gren-agent","status":"ok","version":"testnet-1"}`. Local
dashboard Execute was verified against `http://localhost:8787`.

### Policy rejection

The dashboard **Test policy reject** button sends `reserveBps: 9999`,
`dexBps: 1`. Preview returns `policy.status: "rejected"` with reason
`BDEX_DISABLED`, shown in the agent panel. A 100% BDEX proposal still returns
`DEX_EXPOSURE_EXCEEDED`. The reserve-only baseline (`reserveBps: 10000`)
returns `policy.status: "accepted"`.

## Local verification

```powershell
# Contract unit + invariant tests (13 pass)
cd contracts
forge test

# Live deployment verification
forge script script/VerifyTestnet.s.sol:VerifyTestnet --rpc-url botchainTestnet -vv
# Output: "BOT Chain Testnet deployment verification passed"

# Workspace typecheck
pnpm -r typecheck
```

## How to reproduce the chain reads

```text
eth_getCode <vault address>            # deployed bytecode present
eth_getTransactionReceipt <hash>       # status 0x1 and emitted events
eth_getLogs {fromBlock: 0x137e133}     # vault events from deployment onward
```

## Notes

- BDEX is disabled on this testnet deployment, so the only valid execution is
  reserve-only (`reserveBps = 10000`). This is enforced by the contract.
- The web application renders this activity and decision ledger directly from
  chain events (`Deposited`, `Withdrawn`, `DecisionAccepted`,
  `DecisionRejected`) starting from the deployment block. The dashboard Execute
  button calls the origin-checked agent execute endpoint. The browser never
  receives a keeper key or API key. BDEX remains disabled.