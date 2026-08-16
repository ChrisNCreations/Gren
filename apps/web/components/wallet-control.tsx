"use client";

import { AlertCircle, Check, ChevronDown, Copy, LogOut, Wallet, X } from "lucide-react";
import { useState } from "react";
import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { botChain } from "@/lib/wagmi";

function shortenAddress(address?: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
}

export function WalletControl() {
  const [isOpen, setIsOpen] = useState(false);
  const { address, chainId, isConnected, isConnecting } = useAccount();
  const { data: balance } = useBalance({ address, chainId: botChain.id, query: { enabled: Boolean(address) } });
  const { connect, connectors, error: connectError, reset: resetConnect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching, error: switchError, reset: resetSwitch } = useSwitchChain();
  const isWrongNetwork = isConnected && chainId !== botChain.id;
  const error = connectError ?? switchError;

  function handlePrimaryAction() {
    setIsOpen(true);
    if (!isConnected && connectors[0]) {
      resetConnect();
      connect({ connector: connectors[0] });
    }
  }

  function copyAddress() {
    if (address && navigator.clipboard) void navigator.clipboard.writeText(address);
  }

  if (!isConnected) {
    return (
      <div className="walletControl">
        <button aria-label={isConnecting ? "Connecting wallet" : "Connect wallet"} className="walletButton" type="button" onClick={handlePrimaryAction} disabled={isConnecting}>
          <span className="walletDot" />
          <span>{isConnecting ? "Connecting..." : "Connect wallet"}</span>
          <Wallet size={14} />
        </button>
        {isOpen && (
          <div className="walletPopover" role="status">
            <div className="walletPopoverHeader"><strong>Wallet session</strong><button aria-label="Close wallet panel" onClick={() => setIsOpen(false)} type="button"><X size={14} /></button></div>
            {error ? <p className="walletError"><AlertCircle size={14} />{error.message.toLowerCase().includes("provider") ? "No browser wallet was detected." : "Connection was not completed."}</p> : <p>Connect an injected wallet to use the BOT Chain testnet.</p>}
            <button className="walletRetry" type="button" onClick={handlePrimaryAction} disabled={isConnecting}>Try again <Wallet size={13} /></button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="walletControl">
      <button aria-label={isWrongNetwork ? "Wallet connected to wrong network" : `Wallet ${shortenAddress(address)}`} className={`walletButton isConnected ${isWrongNetwork ? "isWarning" : ""}`} type="button" onClick={() => setIsOpen((value) => !value)} aria-expanded={isOpen}>
        <span className="walletDot" />
        <span>{isWrongNetwork ? "Wrong network" : shortenAddress(address)}</span>
        <ChevronDown size={14} />
      </button>
      {isOpen && (
        <div className="walletPopover" role="dialog" aria-label="Wallet session">
          <div className="walletPopoverHeader"><strong>Wallet session</strong><button aria-label="Close wallet panel" onClick={() => setIsOpen(false)} type="button"><X size={14} /></button></div>
          {isWrongNetwork ? (
            <div className="walletNetworkWarning"><AlertCircle size={15} /><div><strong>Switch to BOT Chain</strong><small>Your wallet is connected to an unsupported network.</small></div><button type="button" onClick={() => { resetSwitch(); switchChain({ chainId: botChain.id }); }} disabled={isSwitching}>{isSwitching ? "Switching..." : "Switch"}</button></div>
          ) : (
            <div className="walletIdentity"><span className="walletIdentityIcon"><Check size={14} /></span><div><strong>{shortenAddress(address)}</strong><small>{balance ? `${Number(balance.formatted).toFixed(3)} ${balance.symbol}` : "BOT Chain testnet"}</small></div><button aria-label="Copy wallet address" title="Copy wallet address" type="button" onClick={copyAddress}><Copy size={14} /></button></div>
          )}
          {error && <p className="walletError"><AlertCircle size={14} />{switchError ? "Network switch was not completed." : "Wallet action was not completed."}</p>}
          <button className="walletDisconnect" type="button" onClick={() => { disconnect(); setIsOpen(false); }}><LogOut size={14} /> Disconnect</button>
        </div>
      )}
    </div>
  );
}
