# Deployment

## Environments

- Local: mock contracts or local fork
- Mainnet smoke: tiny controlled funds and restricted access
- Public demo: verified configuration and monitored keeper

## Contract release

1. Verify chain ID, RPC, USDT decimals/code, router ABI, pool, and price source.
2. Run formatting, unit, invariant, and relevant fork tests.
3. Deploy implementations and three vault instances.
4. Configure each policy and strategy allowlist.
5. Assign roles and revoke deployer permissions that are no longer needed.
6. Verify source on the explorer where supported.
7. Save addresses and transaction hashes in a versioned deployment artifact.
8. Perform deposit, decision, rebalance, and withdrawal smoke tests.

## Application release

Deploy the web app and agent separately. The web app receives only public
addresses and URLs. The agent receives model credentials and the keeper secret.
Health checks must not expose configuration or keys.

## Rollback

Frontend and agent deployments may roll back to a prior build. Contracts require
a documented pause, role-revocation, or upgrade procedure. Do not assume a web
rollback reverses an on-chain configuration change.
