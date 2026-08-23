// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IBdexPair, IBdexRouter } from "../interfaces/IBdexRouter.sol";
import { IReserveStrategy } from "../interfaces/IReserveStrategy.sol";
import { GrenVault } from "../core/GrenVault.sol";

contract BdexStrategy is IReserveStrategy {
    using SafeERC20 for IERC20;

    uint16 public constant TOTAL_BPS = 10_000;

    address public immutable override asset;
    address public immutable override vault;
    address public immutable wbot;
    IBdexRouter public immutable router;
    IBdexPair public immutable pair;

    error OnlyVault();
    error InvalidConfig();
    error InvalidAllocation();

    event BdexRebalanced(uint16 reserveBps, uint16 dexBps, uint256 usdtIdle, uint256 wbotInventory);
    event BdexUnwound(uint256 usdtNeeded, uint256 usdtReturned);

    constructor(address vault_, address asset_, address wbot_, address router_, address pair_) {
        if (
            vault_ == address(0) || asset_ == address(0) || wbot_ == address(0) || router_ == address(0)
                || pair_ == address(0) || asset_ == wbot_
        ) revert InvalidConfig();

        IBdexPair pairContract = IBdexPair(pair_);
        address token0 = pairContract.token0();
        address token1 = pairContract.token1();
        bool usdtIsToken0 = token0 == asset_ && token1 == wbot_;
        bool usdtIsToken1 = token1 == asset_ && token0 == wbot_;
        if (!usdtIsToken0 && !usdtIsToken1) revert InvalidConfig();

        vault = vault_;
        asset = asset_;
        wbot = wbot_;
        router = IBdexRouter(router_);
        pair = pairContract;
    }

    function rebalance(uint16 reserveBps, uint16 dexBps, uint16 slippageBps) external override {
        if (msg.sender != vault) revert OnlyVault();
        if (uint256(reserveBps) + uint256(dexBps) != TOTAL_BPS) revert InvalidAllocation();

        uint256 usdtIdle = IERC20(asset).balanceOf(vault);
        uint256 dexValue = dexInventoryUsdt();
        uint256 total = usdtIdle + dexValue;
        uint256 targetDex = total * dexBps / TOTAL_BPS;

        if (targetDex > dexValue) {
            uint256 need = targetDex - dexValue;
            if (need > usdtIdle) need = usdtIdle;
            if (need > 0) {
                IERC20(asset).safeTransferFrom(vault, address(this), need);
                _swap(asset, wbot, need, slippageBps);
            }
        } else if (dexValue > targetDex) {
            uint256 surplus = dexValue - targetDex;
            uint256 wbotOut = _wbotForUsdt(surplus);
            uint256 wbotBal = IERC20(wbot).balanceOf(address(this));
            if (wbotOut > wbotBal) wbotOut = wbotBal;
            if (wbotOut > 0) {
                _swap(wbot, asset, wbotOut, slippageBps);
                uint256 usdtBal = IERC20(asset).balanceOf(address(this));
                if (usdtBal > 0) IERC20(asset).safeTransfer(vault, usdtBal);
            }
        }

        emit BdexRebalanced(reserveBps, dexBps, IERC20(asset).balanceOf(vault), IERC20(wbot).balanceOf(address(this)));
    }

    function unwind(uint256) external override {
        if (msg.sender != vault) revert OnlyVault();

        // Sell all WBOT back to USDT so the vault can cover withdrawals.
        uint256 wbotBal = IERC20(wbot).balanceOf(address(this));
        if (wbotBal > 0) {
            uint16 slippageBps = GrenVault(vault).maxSlippageBps();
            _swap(wbot, asset, wbotBal, slippageBps);
        }
        uint256 usdtBal = IERC20(asset).balanceOf(address(this));
        if (usdtBal > 0) IERC20(asset).safeTransfer(vault, usdtBal);
        emit BdexUnwound(wbotBal, usdtBal);
    }

    function dexInventoryUsdt() public view override returns (uint256) {
        uint256 wbotBal = IERC20(wbot).balanceOf(address(this));
        if (wbotBal == 0) return 0;
        return _usdtForWbot(wbotBal);
    }

    function _swap(address tokenIn, address tokenOut, uint256 amountIn, uint16 slippageBps) internal {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        uint256[] memory quoted = router.getAmountsOut(amountIn, path);
        uint256 minOut = quoted[1] * (TOTAL_BPS - slippageBps) / TOTAL_BPS;
        IERC20(tokenIn).forceApprove(address(router), amountIn);
        router.swapExactTokensForTokens(amountIn, minOut, path, address(this), block.timestamp);
        IERC20(tokenIn).forceApprove(address(router), 0);
    }

    function _usdtForWbot(uint256 wbotAmount) internal view returns (uint256) {
        (uint256 usdtReserve, uint256 wbotReserve) = _reserves();
        if (wbotReserve == 0) return 0;
        return wbotAmount * usdtReserve / wbotReserve;
    }

    function _wbotForUsdt(uint256 usdtAmount) internal view returns (uint256) {
        (uint256 usdtReserve, uint256 wbotReserve) = _reserves();
        if (usdtReserve == 0) return 0;
        uint256 raw = usdtAmount * wbotReserve / usdtReserve;
        return raw + 1;
    }

    function _reserves() internal view returns (uint256 usdtReserve, uint256 wbotReserve) {
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        if (pair.token0() == asset) {
            return (uint256(reserve0), uint256(reserve1));
        }
        return (uint256(reserve1), uint256(reserve0));
    }
}
