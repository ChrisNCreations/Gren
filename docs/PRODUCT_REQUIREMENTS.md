# Product Requirements

## Functional requirements

- `FR-1`: Detect the connected wallet and active network.
- `FR-2`: Offer a one-action switch to BOT Chain Mainnet.
- `FR-3`: Display the three vaults and their immutable or governed limits.
- `FR-4`: Request USDT approval only for the selected deposit amount.
- `FR-5`: Deposit USDT and display the resulting vault shares.
- `FR-6`: Display current reserve and BDEX allocations from chain state.
- `FR-7`: Produce a decision conforming to the shared decision schema.
- `FR-8`: Show whether policy accepted or rejected the decision and why.
- `FR-9`: Link successful executions to the BOT Chain explorer.
- `FR-10`: Allow partial and full withdrawals.
- `FR-11`: Distinguish pending, confirmed, failed, and rejected actions.

## Risk profiles

| Vault | Maximum BDEX exposure | Initial maximum slippage |
| --- | ---: | ---: |
| Conservative | 25% | 0.5% |
| Balanced | 45% | 0.8% |
| Aggressive | 70% | 1.2% |

These are initial product parameters. They must be tested against real Mainnet
liquidity before deployment.

## Quality requirements

- No critical transaction depends on browser-only state.
- Every displayed financial value identifies its source and freshness.
- The core flow works at 390 px and 1280 px widths.
- A failed agent or unavailable API cannot block withdrawals.
- Demo claims match deployed behavior.
