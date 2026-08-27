# Gren Submission Evidence

Date: 2026-08-27 (Phase 3). Phase 1–2 custody and agent proof from 2026-08-20
is retained below against the previous vault addresses.

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

## Phase 3 deployed contracts (2026-08-27)

Source of truth: `contracts/script/deployments/bot-chain-testnet.json`.

| Component | Address |
| --- | --- |
| Conservative vault | `0xDE27e4d9067D45Ccc4113813d248b62e69A22158` |
| Balanced vault | `0xd2e56743b0097b954fC1146a3d48eaC5a29E772c` |
| Aggressive vault (`bdexEnabled = true`) | `0xdad152240c6D950d2733f3Bb9b620E2242eAb2D7` |
| Conservative reserve | `0xd1b6c7121A721d7740BcDCC21a7290CEB3457a0E` |
| Balanced reserve | `0x918AB43De0efdbef3174EC7EC63Cd4927eb38AFe` |
| Aggressive reserve | `0xaF3Bd75932b0a150174C0549f093828a0344cB22` |
| Aggressive BDEX strategy | `0x405970f034B64E254C6f17BDcB7eAB2c9C1a7679` |

Verified BotDex V2 route (not copied from Mainnet):

| Piece | Address |
| --- | --- |
| WBOT | `0xD5452816194a3784dBa983426cCe7c122F4abd30` |
| Router (`BotDexV2Router` / UniswapV2Router02) | `0xD6425a02f0845B8D99e349C34D2E7A576E177345` |
| Factory | `0x65b8e98ceA190d8c28B3e4716402027f634d15a3` |
| WBOT/USDT pair | `0xD3EC267707BA234583645E75CE283Cf679dd94Fa` |
| Oracle | pair `getReserves()` / router `getAmountsOut` |

At verification the pair held about 15,320 USDT and 289.58 WBOT. Conservative
and balanced vaults stay `bdexEnabled = false`.

Roles (all distinct): owner `0x25D8bE97…8e051`, policyAdmin `0x5Bd41F6A…00a9`,
pauser `0x81E8b650…CCa88`, keeper `0x29754aA2…2c46`.

Deployment block: `21_325_462`.

## Phase 3 BDEX exit gate

Keeper `0x29754aA2422332F8122a94F52C804f2d66872c46` deposited 10 USDT into the
aggressive vault, executed a 30/70 reserve/BDEX rebalance through the live
BotDex V2 pool, then withdrew 6 USDT. Idle USDT after rebalance was 3 USDT, so
withdrawal had to unwind WBOT. After withdraw, WBOT inventory on the adapter
was 0. All receipts are status `0x1`.

| Action | Amount | Transaction hash | Explorer |
| --- | ---: | --- | --- |
| Approve | 10 USDT | `0xd0e7744a1233707cdad1d987e70707b61f32d4439d2c2c2e3705340214b35d2a` | https://scan.bohr.life/tx/0xd0e7744a1233707cdad1d987e70707b61f32d4439d2c2c2e3705340214b35d2a |
| Deposit | 10 USDT | `0x1f469ca05afee9bf579561fdf9a999348ccab253b880edf10e0a75ec6dcc1e5b` | https://scan.bohr.life/tx/0x1f469ca05afee9bf579561fdf9a999348ccab253b880edf10e0a75ec6dcc1e5b |
| BDEX rebalance (3000/7000 bps) | — | `0x5d83cf41aea7fb8e767f3a64f5c65ab139349cf70b7f257c793946ee811123aa` | https://scan.bohr.life/tx/0x5d83cf41aea7fb8e767f3a64f5c65ab139349cf70b7f257c793946ee811123aa |
| Withdraw (forces unwind) | 6 USDT | `0x58729a25926314d05b29ac0932d6a740d982ee9d27892746ab993ce299b344f8` | https://scan.bohr.life/tx/0x58729a25926314d05b29ac0932d6a740d982ee9d27892746ab993ce299b344f8 |

Reproduce with `node scripts/smoke-test-testnet.mjs` (read-only) and
`node scripts/smoke-test-testnet.mjs --live` (broadcasts a tiny new cycle).

## Prior Phase 1–2 contracts (2026-08-19 / 2026-08-20)

These addresses remain the source of the custody and agent proofs below. They
are superseded for new deposits by the Phase 3 artifact.

| Component | Address |
| --- | --- |
| Conservative vault | `0xBe47CA0C0b7346CC6764F33D72Fd691DB9B633E8` |
| Balanced vault | `0x7039E9A0495Be912A1589a979D862ED5d0f26e29` |
| Aggressive vault | `0x454d00aa518f2CA47bb4a127A1B86c3216c049c8` |
| Conservative reserve | `0x2022E743f1A2e144a72238F93892920Cfe2Ee331` |
| Balanced reserve | `0xabafd0BcE9991E712ea046c8bB88f7395A3284CB` |
| Aggressive reserve | `0x758990be9DbD19C288fD7C9a9B3525BA0eB2256E` |

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
# Contract unit + invariant tests (17 pass)
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

- Phase 3 enables BDEX on the aggressive testnet vault only. Conservative and
  balanced vaults, and every Mainnet vault, still reject nonzero `dexBps` with
  `BDEX_DISABLED`.
- The web application renders activity and the decision ledger from chain
  events (`Deposited`, `Withdrawn`, `DecisionAccepted`, `DecisionRejected`)
  starting from the deployment block. The dashboard Execute button calls the
  origin-checked agent execute endpoint. The browser never receives a keeper
  key or API key.
- Phase 4 (Mainnet) is unblocked by this evidence but still requires explicit
  owner approval. Mainnet deploys with `bdexEnabled = false`.