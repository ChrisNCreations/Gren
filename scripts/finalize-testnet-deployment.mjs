import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pendingPath = resolve(repoRoot, "contracts", "script", "deployments", "bot-chain-testnet.pending.json");
const finalPath = resolve(repoRoot, "contracts", "script", "deployments", "bot-chain-testnet.json");
const defaultBroadcastPath = resolve(
  repoRoot,
  "contracts",
  "broadcast",
  "DeployTestnet.s.sol",
  "968",
  "run-latest.json",
);
const broadcastPath = process.argv[2]
  ? (isAbsolute(process.argv[2]) ? process.argv[2] : resolve(repoRoot, process.argv[2]))
  : defaultBroadcastPath;

const hashPattern = /^0x[a-fA-F0-9]{64}$/;

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function transactionType(transaction) {
  return String(transaction.transactionType ?? transaction.type ?? "").toUpperCase();
}

function transactionTarget(transaction) {
  return transaction.contractAddress ?? transaction.to ?? transaction.address ?? null;
}

function transactionHash(transaction, receipt) {
  return transaction.hash ?? transaction.transactionHash ?? receipt?.transactionHash ?? null;
}

function transactionData(transaction) {
  return transaction.data ?? transaction.input ?? transaction.calldata ?? transaction.transaction?.data ?? null;
}

function isAllowlistCall(transaction, strategy) {
  const data = transactionData(transaction);
  if (typeof data === "string" && /^0x[0-9a-fA-F]+$/.test(data)) {
    const expected = `0x56a13690${strategy.slice(2).padStart(64, "0")}${"0".repeat(63)}1`;
    return data.toLowerCase().startsWith(expected.toLowerCase());
  }

  const functionName = String(transaction.function ?? transaction.functionName ?? "").toLowerCase();
  const args = transaction.arguments ?? transaction.args;
  return functionName.includes("setstrategyallowed")
    && Array.isArray(args)
    && String(args[0]).toLowerCase() === strategy.toLowerCase()
    && (args[1] === true || String(args[1]).toLowerCase() === "true");
}

function receiptSucceeded(receipt) {
  if (!receipt) return false;
  return receipt.status === "0x1" || receipt.status === 1 || receipt.status === true || receipt.status === "success";
}

function buildTransactionIndex(broadcast) {
  const transactions = Array.isArray(broadcast.transactions) ? broadcast.transactions : [];
  const receipts = Array.isArray(broadcast.receipts) ? broadcast.receipts : [];
  const receiptsByHash = new Map(
    receipts
      .filter((receipt) => receipt.transactionHash)
      .map((receipt) => [String(receipt.transactionHash).toLowerCase(), receipt]),
  );

  return (target, expectedType, predicate = () => true) => {
    const targetLower = target.toLowerCase();
    const transaction = transactions.find((candidate) => {
      const candidateTarget = transactionTarget(candidate);
      return transactionType(candidate) === expectedType
        && typeof candidateTarget === "string"
        && candidateTarget.toLowerCase() === targetLower
        && predicate(candidate);
    });
    if (!transaction) {
      throw new Error(`Missing ${expectedType} broadcast for ${target}`);
    }

    const hash = transactionHash(transaction);
    if (!hashPattern.test(String(hash))) {
      throw new Error(`Missing transaction hash for ${expectedType} ${target}`);
    }
    const receipt = receiptsByHash.get(String(hash).toLowerCase());
    if (!receipt || !receiptSucceeded(receipt)) {
      throw new Error(`Transaction receipt is missing or failed for ${hash}`);
    }
    return hash;
  };
}

async function main() {
  const pending = await readJson(pendingPath);
  const broadcast = await readJson(broadcastPath);
  if (pending.network !== "bot-chain-testnet" || pending.chainId !== 968) {
    throw new Error("Pending deployment metadata is not BOT Chain Testnet configuration");
  }

  const findTransaction = buildTransactionIndex(broadcast);
  const transactions = {
    conservativeVault: findTransaction(pending.vaults.conservative, "CREATE"),
    balancedVault: findTransaction(pending.vaults.balanced, "CREATE"),
    aggressiveVault: findTransaction(pending.vaults.aggressive, "CREATE"),
    conservativeReserve: findTransaction(pending.strategies.conservativeReserve, "CREATE"),
    balancedReserve: findTransaction(pending.strategies.balancedReserve, "CREATE"),
    aggressiveReserve: findTransaction(pending.strategies.aggressiveReserve, "CREATE"),
    conservativeAllowlist: findTransaction(
      pending.vaults.conservative,
      "CALL",
      (transaction) => isAllowlistCall(transaction, pending.strategies.conservativeReserve),
    ),
    balancedAllowlist: findTransaction(
      pending.vaults.balanced,
      "CALL",
      (transaction) => isAllowlistCall(transaction, pending.strategies.balancedReserve),
    ),
    aggressiveAllowlist: findTransaction(
      pending.vaults.aggressive,
      "CALL",
      (transaction) => isAllowlistCall(transaction, pending.strategies.aggressiveReserve),
    ),
  };

  const finalArtifact = {
    ...pending,
    transactions,
    deployedAt: new Date().toISOString(),
  };
  const temporaryPath = `${finalPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(finalArtifact, null, 2)}\n`, "utf8");
  await rename(temporaryPath, finalPath);
  await rm(pendingPath, { force: true });

  console.log(`Deployment artifact written: ${finalPath}`);
  console.log(`Conservative vault: ${pending.vaults.conservative}`);
  console.log(`Balanced vault: ${pending.vaults.balanced}`);
  console.log(`Aggressive vault: ${pending.vaults.aggressive}`);
  console.log(`Conservative reserve strategy: ${pending.strategies.conservativeReserve}`);
  console.log(`Balanced reserve strategy: ${pending.strategies.balancedReserve}`);
  console.log(`Aggressive reserve strategy: ${pending.strategies.aggressiveReserve}`);
}

main().catch((error) => {
  console.error(`Deployment artifact finalization failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
