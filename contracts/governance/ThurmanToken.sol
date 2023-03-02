// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20VotesUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IPolemarch} from "../interfaces/IPolemarch.sol";
import {WadRayMath} from "../protocol/libraries/math/WadRayMath.sol";

contract ThurmanToken is ERC20Upgradeable, ERC20VotesUpgradeable {
	using WadRayMath for uint256;
    using SafeCast for uint256;

    modifier onlyPolemarch() {
        require(_msgSender() == address(POLEMARCH), "CALLER_MUST_BE_POLEMARCH");
        _;
    }

    uint8 private _decimals;
    IPolemarch public POLEMARCH;

    function initialize(
		IPolemarch polemarch,
        string memory name,
		string memory symbol,
        uint8 thurmanDecimals
	) external initializer {
		__ERC20_init(name, symbol);
        POLEMARCH = polemarch;
        _setDecimals(thurmanDecimals);
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

    function mint(address to, uint256 amount) external onlyPolemarch {
    	_mint(to, amount);
    }

    function burn(address account, uint256 amount) external onlyPolemarch {
    	_burn(account, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function _setDecimals(uint8 newDecimals) internal {
        _decimals = newDecimals;
    }
}
