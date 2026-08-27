$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot ".env.local"
$contractsPath = Join-Path $repoRoot "contracts"

if (-not (Test-Path -LiteralPath $envPath)) {
    throw "Missing $envPath"
}

foreach ($line in Get-Content -LiteralPath $envPath) {
    $trimmed = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) {
        continue
    }

    $separator = $trimmed.IndexOf("=")
    if ($separator -lt 1) {
        continue
    }

    $name = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim()
    if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    if ($value.Length -ge 2 -and $value.StartsWith("'") -and $value.EndsWith("'")) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    if (($name -eq "DEPLOYER_PRIVATE_KEY" -or $name -eq "POLICY_ADMIN_PRIVATE_KEY" -or $name -eq "KEEPER_PRIVATE_KEY") -and $value -match '^[a-fA-F0-9]{64}$') {
        $value = "0x$value"
    }
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
}

if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("BOT_CHAIN_TESTNET_RPC_URL", "Process"))) {
    [Environment]::SetEnvironmentVariable("BOT_CHAIN_TESTNET_RPC_URL", "https://rpc.bohr.life", "Process")
}
if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("TESTNET_USDT_ADDRESS", "Process"))) {
    [Environment]::SetEnvironmentVariable("TESTNET_USDT_ADDRESS", "0x75edC9335175Fc0552D51D48439F229c10420fe3", "Process")
}

$required = @(
    "BOT_CHAIN_TESTNET_RPC_URL",
    "TESTNET_USDT_ADDRESS",
    "GREN_OWNER_ADDRESS",
    "GREN_POLICY_ADMIN_ADDRESS",
    "GREN_PAUSER_ADDRESS",
    "GREN_KEEPER_ADDRESS",
    "DEPLOYER_PRIVATE_KEY",
    "POLICY_ADMIN_PRIVATE_KEY"
)

foreach ($name in $required) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name, "Process"))) {
        throw "Missing required deployment variable: $name"
    }
}

Push-Location $contractsPath
try {
    forge script script/DeployTestnet.s.sol:DeployTestnet --broadcast --slow --rpc-url botchainTestnet -vv
    if ($LASTEXITCODE -ne 0) {
        throw "Foundry deployment failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}

node (Join-Path $repoRoot "scripts\finalize-testnet-deployment.mjs")
if ($LASTEXITCODE -ne 0) {
    throw "Deployment artifact finalization failed with exit code $LASTEXITCODE"
}

$artifactPath = Join-Path $repoRoot "contracts\script\deployments\bot-chain-testnet.json"
$artifact = Get-Content -LiteralPath $artifactPath -Raw | ConvertFrom-Json
$env:GREN_OWNER_ADDRESS = $artifact.roles.owner
$env:GREN_POLICY_ADMIN_ADDRESS = $artifact.roles.policyAdmin
$env:GREN_PAUSER_ADDRESS = $artifact.roles.pauser
$env:GREN_KEEPER_ADDRESS = $artifact.roles.keeper
$env:CONSERVATIVE_VAULT_ADDRESS = $artifact.vaults.conservative
$env:BALANCED_VAULT_ADDRESS = $artifact.vaults.balanced
$env:AGGRESSIVE_VAULT_ADDRESS = $artifact.vaults.aggressive
$env:CONSERVATIVE_RESERVE_STRATEGY_ADDRESS = $artifact.strategies.conservativeReserve
$env:BALANCED_RESERVE_STRATEGY_ADDRESS = $artifact.strategies.balancedReserve
$env:AGGRESSIVE_RESERVE_STRATEGY_ADDRESS = $artifact.strategies.aggressiveReserve
if ($artifact.strategies.aggressiveBdex) {
    $env:AGGRESSIVE_BDEX_STRATEGY_ADDRESS = $artifact.strategies.aggressiveBdex
}

Push-Location $contractsPath
try {
    forge script script/VerifyTestnet.s.sol:VerifyTestnet --rpc-url botchainTestnet -vv
    if ($LASTEXITCODE -ne 0) {
        throw "Deployment verification failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}

node (Join-Path $repoRoot "scripts\sync-public-env.mjs")
if ($LASTEXITCODE -ne 0) {
    throw "Public environment synchronization failed with exit code $LASTEXITCODE"
}
