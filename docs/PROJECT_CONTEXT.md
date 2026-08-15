# Gren Project Context

Last updated: 2026-08-14

Gren is an AI-guided portfolio manager for BOT Chain. A user connects an EVM
wallet, chooses one of three risk-specific vaults, deposits USDT, and receives
transparent on-chain portfolio management. The AI proposes structured
allocation decisions. Contracts remain the custody and policy boundary.

## Fixed MVP decisions

- Production target: BOT Chain Mainnet, chain ID `677`
- Current delivery network: verified testnet first; Mainnet is a later gate
- Deposit asset: USDT only
- Vault model: separate Conservative, Balanced, and Aggressive ERC-4626 vaults
- Strategy scope: liquid USDT reserve first; constrained BDEX exposure only
  after target-network verification
- Authority model: AI proposes, keeper submits, contracts validate and execute
- RWA integrations: roadmap only until a real protocol is selected and tested

## Product promise

Deposit once, retain control, and understand every automated action.

The complete demo loop is:

`connect -> choose vault -> approve USDT -> deposit -> evaluate -> execute -> inspect -> withdraw`

## Mainnet constants

- RPC: `https://rpc.botchain.ai`
- Explorer: `https://scan.botchain.ai`
- USDT: `0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C`
- WBOT: `0xD5452816194a3784dBa983426cCe7c122F4abd30`
- Universal Router: `0xaE6ae8630f7A888dEc0B9195C85F7515d5887655`

These addresses are inputs to verification, not proof that an integration is
working. Confirm deployed bytecode, token decimals, interfaces, pools,
liquidity, and price behavior before routing funds.

## Source-of-truth documents

- [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md): product scope and success criteria
- [HACKATHON_REQUIREMENTS.md](HACKATHON_REQUIREMENTS.md): challenge compliance
- [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md): functional requirements
- [USER_FLOWS.md](USER_FLOWS.md): user and system flows
- [ARCHITECTURE.md](ARCHITECTURE.md): system boundaries and contracts
- [DEVELOPMENT.md](DEVELOPMENT.md): local workflow and engineering rules
- [BUILD_PHASES.md](BUILD_PHASES.md): delivery order and gates
- [SECURITY.md](SECURITY.md): threat model and controls
- [DEPLOYMENT.md](DEPLOYMENT.md): Mainnet release process
- [SUBMISSION.md](SUBMISSION.md): evidence and submission checklist
- [DESIGN.md](DESIGN.md): visual and interaction direction
- [AGENT_HANDOFF.md](AGENT_HANDOFF.md): mandatory instructions for backend agents
- [BACKEND_IMPLEMENTATION.md](BACKEND_IMPLEMENTATION.md): backend build guide
- [CONTRACT_SPEC.md](CONTRACT_SPEC.md): contract behavior and invariants
- [API_CONTRACT.md](API_CONTRACT.md): frontend/backend integration contract
- [AGENT_PROMPTS.md](AGENT_PROMPTS.md): reusable VS Code agent prompts
- [FRONTEND_BACKEND_TESTING.md](FRONTEND_BACKEND_TESTING.md): testnet browser
  integration checklist
- [FRONTEND_ROADMAP.md](FRONTEND_ROADMAP.md): frontend ownership and build order

## Current implementation

The original browser-native demo is preserved in `prototype/`. It includes the
landing experience, dashboard, simulated wallet, deposits, risk selection,
decisions, activity, strategies, and withdrawals. It does not connect a wallet
or move funds.

The production scaffold now exists in `apps/`, `contracts/`, and `packages/`.
The frontend is currently ahead of the backend. Contract and keeper work must
complete the testnet phases before any Mainnet deployment is considered. No
contract, keeper, or network integration should be described as complete until
the corresponding acceptance criteria in the documents above are met.
