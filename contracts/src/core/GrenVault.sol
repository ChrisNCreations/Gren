// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { ERC20, IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IReserveStrategy } from "../interfaces/IReserveStrategy.sol";
import { GrenTypes } from "./GrenTypes.sol";

contract GrenVault is ERC4626, AccessControl, Ownable2Step, Pausable, ReentrancyGuard {
    bytes32 public constant POLICY_ADMIN_ROLE = keccak256("POLICY_ADMIN_ROLE");
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    bytes32 public constant REASON_RESERVE_ONLY = "RESERVE_ONLY";
    bytes32 public constant REASON_VAULT_MISMATCH = "VAULT_MISMATCH";
    bytes32 public constant REASON_PROFILE_MISMATCH = "PROFILE_MISMATCH";
    bytes32 public constant REASON_DECISION_REPLAYED = "DECISION_REPLAYED";
    bytes32 public constant REASON_DECISION_EXPIRED = "DECISION_EXPIRED";
    bytes32 public constant REASON_INPUT_STALE = "INPUT_STALE";
    bytes32 public constant REASON_INPUT_HASH_MISMATCH = "INPUT_HASH_MISMATCH";
    bytes32 public constant REASON_ALLOCATION_TOTAL_INVALID = "ALLOCATION_TOTAL_INVALID";
    bytes32 public constant REASON_DEX_EXPOSURE_EXCEEDED = "DEX_EXPOSURE_EXCEEDED";
    bytes32 public constant REASON_SLIPPAGE_EXCEEDED = "SLIPPAGE_EXCEEDED";
    bytes32 public constant REASON_COOLDOWN_ACTIVE = "COOLDOWN_ACTIVE";
    bytes32 public constant REASON_ASSET_NOT_ALLOWED = "ASSET_NOT_ALLOWED";
    bytes32 public constant REASON_STRATEGY_NOT_ALLOWED = "STRATEGY_NOT_ALLOWED";
    bytes32 public constant REASON_EXECUTION_PAUSED = "EXECUTION_PAUSED";
    bytes32 public constant REASON_BDEX_DISABLED = "BDEX_DISABLED";

    uint16 public constant TOTAL_BPS = 10_000;

    uint8 public immutable profile;
    uint16 public maxDexBps;
    uint16 public maxSlippageBps;
    uint64 public rebalanceCooldown;
    uint64 public maxInputAge;
    uint64 public policyVersion;
    uint64 public lastDecisionAt;
    uint16 public currentReserveBps;
    uint16 public currentDexBps;
    bool public immutable bdexEnabled;

    mapping(bytes32 decisionId => bool used) public decisionUsed;
    mapping(address strategy => bool allowed) public strategyAllowed;

    error ZeroAddress();
    error InvalidProfile();
    error InvalidPolicy();
    error StrategyNotContract();
    error StrategyVaultMismatch();
    error StrategyAssetMismatch();

    event Deposited(address indexed user, uint256 assets, uint256 shares);
    event Withdrawn(address indexed user, uint256 assets, uint256 shares);
    event DecisionAccepted(bytes32 indexed decisionId, bytes32 inputHash);
    event DecisionRejected(bytes32 indexed decisionId, bytes32 reasonCode);
    event RebalanceExecuted(bytes32 indexed decisionId, uint256 reserveBps, uint256 dexBps);
    event StrategyAllowlistChanged(address indexed strategy, bool allowed);
    event PolicyChanged(
        uint16 maxDexBps,
        uint16 maxSlippageBps,
        uint64 rebalanceCooldown,
        uint64 maxInputAge,
        uint64 policyVersion
    );

    constructor(
        IERC20Metadata asset_,
        string memory name_,
        string memory symbol_,
        uint8 profile_,
        uint16 maxDexBps_,
        uint16 maxSlippageBps_,
        uint64 rebalanceCooldown_,
        uint64 maxInputAge_,
        address owner_,
        address policyAdmin_,
        address pauser_,
        address keeper_
    ) ERC20(name_, symbol_) ERC4626(asset_) Ownable(owner_) {
        if (
            address(asset_) == address(0) || owner_ == address(0) || policyAdmin_ == address(0)
                || pauser_ == address(0) || keeper_ == address(0)
        ) revert ZeroAddress();
        if (profile_ > 2) revert InvalidProfile();
        if (maxDexBps_ > TOTAL_BPS || maxSlippageBps_ > TOTAL_BPS || maxInputAge_ == 0) {
            revert InvalidPolicy();
        }

        profile = profile_;
        maxDexBps = maxDexBps_;
        maxSlippageBps = maxSlippageBps_;
        rebalanceCooldown = rebalanceCooldown_;
        maxInputAge = maxInputAge_;
        policyVersion = 1;
        currentReserveBps = TOTAL_BPS;
        currentDexBps = 0;
        bdexEnabled = false;

        _grantRole(DEFAULT_ADMIN_ROLE, owner_);
        _grantRole(POLICY_ADMIN_ROLE, policyAdmin_);
        _grantRole(PAUSER_ROLE, pauser_);
        _grantRole(KEEPER_ROLE, keeper_);
    }

    function deposit(uint256 assets, address receiver)
        public
        override
        whenNotPaused
        nonReentrant
        returns (uint256 shares)
    {
        shares = super.deposit(assets, receiver);
        emit Deposited(receiver, assets, shares);
    }

    function mint(uint256 shares, address receiver)
        public
        override
        whenNotPaused
        nonReentrant
        returns (uint256 assets)
    {
        assets = super.mint(shares, receiver);
        emit Deposited(receiver, assets, shares);
    }

    function withdraw(uint256 assets, address receiver, address owner_)
        public
        override
        nonReentrant
        returns (uint256 shares)
    {
        shares = super.withdraw(assets, receiver, owner_);
        emit Withdrawn(owner_, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner_)
        public
        override
        nonReentrant
        returns (uint256 assets)
    {
        assets = super.redeem(shares, receiver, owner_);
        emit Withdrawn(owner_, assets, shares);
    }

    function setPolicy(
        uint16 maxDexBps_,
        uint16 maxSlippageBps_,
        uint64 rebalanceCooldown_,
        uint64 maxInputAge_
    ) external onlyRole(POLICY_ADMIN_ROLE) {
        if (maxDexBps_ > TOTAL_BPS || maxSlippageBps_ > TOTAL_BPS || maxInputAge_ == 0) {
            revert InvalidPolicy();
        }

        maxDexBps = maxDexBps_;
        maxSlippageBps = maxSlippageBps_;
        rebalanceCooldown = rebalanceCooldown_;
        maxInputAge = maxInputAge_;
        unchecked {
            ++policyVersion;
        }
        emit PolicyChanged(
            maxDexBps_, maxSlippageBps_, rebalanceCooldown_, maxInputAge_, policyVersion
        );
    }

    function setStrategyAllowed(address strategy, bool allowed)
        external
        onlyRole(POLICY_ADMIN_ROLE)
    {
        if (strategy == address(0)) revert ZeroAddress();
        if (allowed) {
            if (strategy.code.length == 0) revert StrategyNotContract();
            if (IReserveStrategy(strategy).vault() != address(this)) {
                revert StrategyVaultMismatch();
            }
            if (IReserveStrategy(strategy).asset() != asset()) {
                revert StrategyAssetMismatch();
            }
        }

        strategyAllowed[strategy] = allowed;
        emit StrategyAllowlistChanged(strategy, allowed);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function inputHashFor(
        uint256 snapshotTotalAssets,
        uint256 snapshotTotalShares,
        uint16 snapshotReserveBps,
        uint16 snapshotDexBps,
        uint64 snapshotAt,
        uint64 snapshotPolicyVersion
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                address(this),
                profile,
                asset(),
                snapshotTotalAssets,
                snapshotTotalShares,
                snapshotReserveBps,
                snapshotDexBps,
                snapshotAt,
                snapshotPolicyVersion
            )
        );
    }

    function validateDecision(GrenTypes.AllocationDecision calldata decision)
        public
        view
        returns (bool valid, bytes32 reasonCode)
    {
        if (decision.vault != address(this)) return (false, REASON_VAULT_MISMATCH);
        if (decision.profile != profile) return (false, REASON_PROFILE_MISMATCH);
        if (decisionUsed[decision.decisionId]) return (false, REASON_DECISION_REPLAYED);
        if (decision.expiresAt <= block.timestamp) return (false, REASON_DECISION_EXPIRED);
        if (
            decision.snapshotAt > block.timestamp
                || block.timestamp - decision.snapshotAt > maxInputAge
        ) return (false, REASON_INPUT_STALE);
        if (decision.expiresAt <= decision.snapshotAt) return (false, REASON_DECISION_EXPIRED);
        if (
            decision.snapshotTotalAssets != totalAssets()
                || decision.snapshotTotalShares != totalSupply()
                || decision.snapshotReserveBps != currentReserveBps
                || decision.snapshotDexBps != currentDexBps
                || decision.policyVersion != policyVersion
        ) return (false, REASON_INPUT_STALE);
        if (
            decision.inputHash
                != inputHashFor(
                    decision.snapshotTotalAssets,
                    decision.snapshotTotalShares,
                    decision.snapshotReserveBps,
                    decision.snapshotDexBps,
                    decision.snapshotAt,
                    decision.policyVersion
                )
        ) return (false, REASON_INPUT_HASH_MISMATCH);
        if (decision.reserveBps + decision.dexBps != TOTAL_BPS) {
            return (false, REASON_ALLOCATION_TOTAL_INVALID);
        }
        if (decision.dexBps > maxDexBps) return (false, REASON_DEX_EXPOSURE_EXCEEDED);
        if (decision.slippageBps > maxSlippageBps) return (false, REASON_SLIPPAGE_EXCEEDED);
        if (!bdexEnabled && decision.dexBps != 0) return (false, REASON_BDEX_DISABLED);
        if (decision.dexBps == 0 && decision.slippageBps != 0) {
            return (false, REASON_SLIPPAGE_EXCEEDED);
        }
        if (decision.asset != asset()) return (false, REASON_ASSET_NOT_ALLOWED);
        if (!strategyAllowed[decision.strategy]) return (false, REASON_STRATEGY_NOT_ALLOWED);
        if (paused()) return (false, REASON_EXECUTION_PAUSED);
        if (lastDecisionAt != 0 && block.timestamp < uint256(lastDecisionAt) + rebalanceCooldown) {
            return (false, REASON_COOLDOWN_ACTIVE);
        }

        return (true, bytes32(0));
    }

    function executeDecision(GrenTypes.AllocationDecision calldata decision)
        external
        onlyRole(KEEPER_ROLE)
        nonReentrant
        returns (bool accepted)
    {
        (bool valid, bytes32 reasonCode) = validateDecision(decision);
        if (!valid) {
            emit DecisionRejected(decision.decisionId, reasonCode);
            return false;
        }

        decisionUsed[decision.decisionId] = true;
        lastDecisionAt = uint64(block.timestamp);
        currentReserveBps = decision.reserveBps;
        currentDexBps = decision.dexBps;

        IReserveStrategy(decision.strategy)
            .rebalance(decision.reserveBps, decision.dexBps, decision.slippageBps);

        emit DecisionAccepted(decision.decisionId, decision.inputHash);
        emit RebalanceExecuted(decision.decisionId, decision.reserveBps, decision.dexBps);
        return true;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
