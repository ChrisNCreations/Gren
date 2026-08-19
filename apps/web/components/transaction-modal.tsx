"use client";

import { AlertCircle, ArrowDownToLine, Check, ExternalLink, LoaderCircle, Plus, RefreshCw, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import {
  useAccount,
  useConnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { grenVaultAbi, usdtAbi } from "@gren/shared";
import { publicVaultAddress } from "@/lib/agent";
import type { ProfileId } from "@/lib/dashboard";
import { botChain } from "@/lib/wagmi";
import { expectedVaultProfile, publicChainConfig } from "@/lib/public-config";

type TransactionMode = "deposit" | "withdraw";
type TransactionStatus =
  | "not_connected"
  | "awaiting_network"
  | "awaiting_approval"
  | "pending_confirmation"
  | "confirmed"
  | "failed"
  | "unavailable";
type PendingAction = "approval" | "deposit" | "withdraw" | null;

const decimals = publicChainConfig.usdtDecimals;
const usdtAddress = publicChainConfig.usdtAddress;

export function TransactionModal({
  mode,
  profileId,
  onClose,
  onDepositConfirmed,
}: {
  mode: TransactionMode;
  profileId: ProfileId;
  onClose: () => void;
  onDepositConfirmed?: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [approvedAmount, setApprovedAmount] = useState<bigint | null>(null);
  const [status, setStatus] = useState<TransactionStatus | null>(null);
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirmedAction, setConfirmedAction] = useState<PendingAction>(null);
  const [submittedAmount, setSubmittedAmount] = useState<bigint | null>(null);
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const vault = publicVaultAddress(profileId);
  const isOnTargetChain = chainId === botChain.id;
  const walletReady = Boolean(address && vault && isConnected && isOnTargetChain);
  const expectedProfile = expectedVaultProfile(profileId);

  const { data: vaultAsset, isError: isVaultAssetError } = useReadContract({
    address: vault,
    abi: grenVaultAbi,
    functionName: "asset",
    query: { enabled: walletReady },
  });
  const { data: vaultProfile, isError: isVaultProfileError } = useReadContract({
    address: vault,
    abi: grenVaultAbi,
    functionName: "profile",
    query: { enabled: walletReady },
  });
  const { data: vaultBdexEnabled, isError: isVaultBdexError } = useReadContract({
    address: vault,
    abi: grenVaultAbi,
    functionName: "bdexEnabled",
    query: { enabled: walletReady },
  });
  const vaultIdentityReady = vaultAsset !== undefined && vaultProfile !== undefined && vaultBdexEnabled !== undefined;
  const vaultVerified = vaultIdentityReady
    && !isVaultAssetError
    && !isVaultProfileError
    && !isVaultBdexError
    && vaultAsset.toLowerCase() === usdtAddress.toLowerCase()
    && Number(vaultProfile) === expectedProfile
    && vaultBdexEnabled === false;

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdtAddress,
    abi: usdtAbi,
    functionName: "allowance",
    args: address && vault ? [address, vault] : undefined,
    query: { enabled: Boolean(walletReady && vaultVerified) },
  });
  const { data: usdtBalance, refetch: refetchUsdtBalance } = useReadContract({
    address: usdtAddress,
    abi: usdtAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && isConnected && isOnTargetChain) },
  });
  const { data: maxWithdraw, refetch: refetchMaxWithdraw } = useReadContract({
    address: vault,
    abi: grenVaultAbi,
    functionName: "maxWithdraw",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(walletReady && vaultVerified && mode === "withdraw") },
  });
  const { writeContract, data: transactionHash, isPending: isWalletPending, error: writeError, reset: resetWrite } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, isError: isReceiptError } = useWaitForTransactionReceipt({
    hash: transactionHash,
    query: { enabled: Boolean(transactionHash) },
  });

  const balanceLabel = usdtBalance === undefined ? "Reading balance" : `${formatUnits(usdtBalance, decimals)} USDT available`;
  const maxWithdrawLabel = maxWithdraw === undefined ? "Reading withdrawable balance" : `${formatUnits(maxWithdraw, decimals)} USDT withdrawable`;
  const title = mode === "deposit" ? "Deposit USDT" : "Withdraw USDT";
  const profileLabel = profileId.charAt(0).toUpperCase() + profileId.slice(1);
  const inputAmount = useMemo(() => {
    try {
      return amount.trim() ? parseUnits(amount.trim(), decimals) : 0n;
    } catch {
      return null;
    }
  }, [amount]);
  const hasApprovedAmount = mode === "deposit" && approvedAmount !== null && inputAmount !== null && approvedAmount >= inputAmount;

  useEffect(() => {
    if (status === "not_connected" && isConnected) {
      setStatus(null);
      setMessage("");
    }
    if (status === "awaiting_network" && isConnected && isOnTargetChain) {
      setStatus(null);
      setMessage("");
    }
  }, [isConnected, isOnTargetChain, status]);

  useEffect(() => {
    if (!transactionHash) return;
    if (isReceiptError && pendingAction) {
      setStatus("failed");
      setMessage("The transaction failed before confirmation. No balance was changed.");
      setPendingAction(null);
      return;
    }
    if (!pendingAction || isConfirming || !isConfirmed) return;
    if (!isConfirming && isConfirmed) {
      setStatus("confirmed");
      setConfirmedAction(pendingAction);
      if (pendingAction === "approval") {
        setApprovedAmount(submittedAmount);
        setMessage("Approval confirmed. Submit the deposit when you are ready.");
      } else {
        setMessage(`${mode === "deposit" ? "Deposit" : "Withdrawal"} confirmed on BOT Chain.`);
        if (pendingAction === "deposit") onDepositConfirmed?.();
      }
      setPendingAction(null);
      void Promise.all([refetchAllowance(), refetchUsdtBalance(), refetchMaxWithdraw()]);
    }
  }, [isConfirmed, isConfirming, isReceiptError, mode, onDepositConfirmed, pendingAction, refetchAllowance, refetchMaxWithdraw, refetchUsdtBalance, submittedAmount, transactionHash]);

  useEffect(() => {
    if (!writeError) return;
    setStatus("failed");
    setMessage(writeError.message.toLowerCase().includes("reject") ? "The wallet request was rejected. You can try again." : "The wallet could not submit this transaction. You can try again.");
    setPendingAction(null);
  }, [writeError]);

  function setMaxAmount() {
    const max = mode === "deposit" ? usdtBalance : maxWithdraw;
    if (max !== undefined) setAmount(formatUnits(max, decimals));
  }

  function submit() {
    resetWrite();
    setStatus(null);
    setMessage("");
    setConfirmedAction(null);
    if (!vault) {
      setStatus("unavailable");
      setMessage("Testnet vault addresses are not configured yet. Transactions will unlock after deployment artifact addresses are added.");
      return;
    }
    if (!isConnected || !address) {
      setStatus("not_connected");
      setMessage("Connect a wallet before submitting a transaction.");
      return;
    }
    if (!isOnTargetChain) {
      setStatus("awaiting_network");
      setMessage("Switch your wallet to BOT Chain Testnet before submitting.");
      return;
    }
    if (!vaultIdentityReady || !vaultVerified) {
      setStatus("unavailable");
      setMessage("The selected vault could not be verified as the configured BOT Chain testnet vault.");
      return;
    }
    if (inputAmount === null || inputAmount <= 0n) {
      setStatus("failed");
      setMessage("Enter a valid USDT amount greater than zero.");
      return;
    }
    if (mode === "deposit" && usdtBalance !== undefined && inputAmount > usdtBalance) {
      setStatus("failed");
      setMessage("The requested deposit is greater than your available USDT balance.");
      return;
    }
    if (mode === "withdraw" && maxWithdraw !== undefined && inputAmount > maxWithdraw) {
      setStatus("failed");
      setMessage("The requested withdrawal is greater than your withdrawable balance.");
      return;
    }
    setSubmittedAmount(inputAmount);
    if (mode === "deposit" && !hasApprovedAmount && (allowance === undefined || allowance < inputAmount)) {
      setPendingAction("approval");
      setStatus("awaiting_approval");
      setMessage("Approve the exact deposit amount in your wallet. Gren will wait for confirmation before depositing.");
      writeContract({ address: usdtAddress, abi: usdtAbi, functionName: "approve", args: [vault, inputAmount] });
      return;
    }
    setPendingAction(mode);
    setStatus("pending_confirmation");
    setMessage(`Confirm the ${mode} transaction in your wallet.`);
    if (mode === "deposit") {
      writeContract({ address: vault, abi: grenVaultAbi, functionName: "deposit", args: [inputAmount, address] });
    } else {
      writeContract({ address: vault, abi: grenVaultAbi, functionName: "withdraw", args: [inputAmount, address, address] });
    }
  }

  const isBusy = isWalletPending || isConfirming;
  const statusLabel = status ? status.replaceAll("_", " ") : "Ready";
  const explorerUrl = transactionHash ? `${publicChainConfig.explorerUrl}/tx/${transactionHash}` : undefined;

  return (
    <div className="transactionScrim" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !isBusy) onClose(); }}>
      <section className="transactionModal" role="dialog" aria-modal="true" aria-labelledby="transaction-title">
        <header className="transactionHeader">
          <div><span className="eyebrow">{profileLabel} vault</span><h2 id="transaction-title">{title}</h2></div>
          <button className="modalClose" aria-label="Close transaction panel" type="button" onClick={onClose} disabled={isBusy}><X size={17} /></button>
        </header>

        {!vault ? (
          <div className="transactionUnavailable" data-testid="transaction-status"><AlertCircle size={18} /><div><small>Unavailable</small><strong>Testnet deployment required</strong><p>{message || "This vault does not have a published address yet."}</p></div></div>
        ) : (
          <>
            <div className="transactionField">
              <div className="transactionFieldTop"><label htmlFor="transaction-amount">Amount</label><button type="button" onClick={setMaxAmount} disabled={usdtBalance === undefined && maxWithdraw === undefined}>Max</button></div>
              <div className="amountInput"><input id="transaction-amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={isBusy} aria-describedby="transaction-balance" /><span>USDT</span></div>
              <small id="transaction-balance">{mode === "deposit" ? balanceLabel : maxWithdrawLabel}</small>
            </div>
            <div className="transactionRoute"><span>From</span><strong>{mode === "deposit" ? "Wallet" : `${profileLabel} vault`}</strong><span>To</span><strong>{mode === "deposit" ? `${profileLabel} vault` : "Wallet"}</strong></div>
          </>
        )}

        {status && <div className={`transactionStatus transactionStatus--${status}`} data-testid="transaction-status"><StatusIcon status={status} /><div><strong>{statusLabel}</strong><p>{message}</p>{explorerUrl && <a href={explorerUrl} target="_blank" rel="noreferrer">View transaction <ExternalLink size={12} /></a>}</div></div>}

        {status === "not_connected" && <button className="primaryButton transactionAction" type="button" onClick={() => connectors[0] && connect({ connector: connectors[0] })} disabled={isConnecting}><Wallet size={15} />{isConnecting ? "Connecting..." : "Connect wallet"}</button>}
        {status === "awaiting_network" && <p className="transactionHint">Use the wallet control in the top bar to switch networks, then return here.</p>}
        {status === "unavailable" && <p className="transactionHint">The UI is ready for the deployment artifact. No transaction can be submitted without a verified vault address.</p>}

        {vault && status !== "confirmed" && status !== "unavailable" && status !== "not_connected" && status !== "awaiting_network" && (
          <button className="primaryButton transactionAction" data-testid={mode === "deposit" ? "deposit-submit" : "withdraw-submit"} type="button" onClick={submit} disabled={isBusy || !amount.trim()}>{isBusy ? <LoaderCircle className="spinIcon" size={15} /> : mode === "deposit" && !hasApprovedAmount && (allowance === undefined || allowance < (inputAmount ?? 0n)) ? <Check size={15} /> : mode === "deposit" ? <Plus size={15} /> : <ArrowDownToLine size={15} />}{isBusy ? "Waiting for confirmation..." : mode === "deposit" && !hasApprovedAmount && (allowance === undefined || allowance < (inputAmount ?? 0n)) ? "Approve exact amount" : mode === "deposit" ? "Deposit USDT" : "Withdraw USDT"}</button>
        )}
        {status === "confirmed" && mode === "deposit" && confirmedAction === "approval" && <button className="primaryButton transactionAction" data-testid="deposit-submit" type="button" onClick={submit}>Deposit USDT <Plus size={15} /></button>}
        {status === "confirmed" && mode === "deposit" && confirmedAction === "deposit" && <button className="primaryButton transactionAction" type="button" onClick={() => { setStatus(null); setMessage(""); setAmount(""); setApprovedAmount(null); setSubmittedAmount(null); }}>Deposit another amount <Plus size={15} /></button>}
        {status === "confirmed" && mode === "withdraw" && <button className="secondaryButton transactionAction" type="button" onClick={onClose}>Done <Check size={15} /></button>}
        {status === "failed" && <button className="secondaryButton transactionAction" type="button" onClick={() => { setStatus(null); setMessage(""); setPendingAction(null); }}>Try again <RefreshCw size={14} /></button>}
      </section>
    </div>
  );
}

function StatusIcon({ status }: { status: TransactionStatus }) {
  if (status === "confirmed") return <span className="transactionStatusIcon isConfirmed"><Check size={15} /></span>;
  if (status === "pending_confirmation" || status === "awaiting_approval") return <span className="transactionStatusIcon isPending"><LoaderCircle className="spinIcon" size={15} /></span>;
  if (status === "failed" || status === "unavailable") return <span className="transactionStatusIcon isError"><AlertCircle size={15} /></span>;
  return <span className="transactionStatusIcon"><Wallet size={15} /></span>;
}
