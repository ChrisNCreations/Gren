// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockWBOT is ERC20 {
    constructor() ERC20("Wrapped BOT", "WBOT") { }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}
