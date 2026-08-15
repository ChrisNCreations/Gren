# User Flows

## Deposit

1. User connects a wallet.
2. Application checks chain ID and requests a BOT Chain switch if needed.
3. User compares risk policies and chooses one vault.
4. Application reads USDT balance, allowance, and vault state.
5. User approves the exact deposit amount if allowance is insufficient.
6. User deposits and waits for confirmation.
7. Application shows shares, allocation, and explorer link.

## Agent evaluation and execution

1. Agent reads an approved snapshot of vault and market inputs.
2. Agent returns a schema-valid allocation decision and reason code.
3. Service checks totals, expiry, replay status, and input freshness.
4. Keeper submits the decision.
5. Contracts apply the vault policy and either reject or execute it.
6. Application shows the input hash, explanation, result, and transaction.

## Withdrawal

1. User selects an amount or maximum shares.
2. Application previews assets and any unwind requirement.
3. User confirms the wallet transaction.
4. Vault returns USDT and burns shares.
5. Application displays the confirmed balance and explorer link.

Withdrawals must not depend on the agent service being available.
