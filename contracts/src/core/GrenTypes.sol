// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library GrenTypes {
    struct AllocationDecision {
        bytes32 decisionId;
        address vault;
        uint8 profile;
        uint16 reserveBps;
        uint16 dexBps;
        uint16 slippageBps;
        address asset;
        address strategy;
        bytes32 reasonCode;
        bytes32 inputHash;
        uint256 snapshotTotalAssets;
        uint256 snapshotTotalShares;
        uint16 snapshotReserveBps;
        uint16 snapshotDexBps;
        uint64 snapshotAt;
        uint64 expiresAt;
        uint64 policyVersion;
    }
}
