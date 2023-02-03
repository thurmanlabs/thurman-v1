// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20VotesUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";

contract ThurmanToken is ERC20Upgradeable, ERC20VotesUpgradeable {
	function initialize(
		string memory name,
		string memory symbol
	) external initializer {
		__ERC20_init(name, symbol);
		__ERC20Votes_init();
	}

	function _afterTokenTransfer(
		address from, 
		address to, 
		uint256 amount
	) 
		internal 
		override(ERC20Upgradeable, ERC20VotesUpgradeable)
    {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount)
        internal
        override(ERC20Upgradeable, ERC20VotesUpgradeable)
    {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount)
        internal
        override(ERC20Upgradeable, ERC20VotesUpgradeable)
    {
        super._burn(account, amount);
    }
}
