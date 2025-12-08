// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IGToken} from "../../../interfaces/IGToken.sol";
import {ISToken} from "../../../interfaces/ISToken.sol";
import {IThurmanToken} from "../../../interfaces/IThurmanToken.sol";
import {Types} from "../types/Types.sol";
import {ExchequerService} from "./ExchequerService.sol";
import {StrategusService} from "./StrategusService.sol";
import {WadRayMath} from "../math/WadRayMath.sol";

library SupplyService {
	using WadRayMath for uint256;
	using ExchequerService for Types.Exchequer;

	event Supply(address indexed exchequer, address indexed user, uint256 amount);
	event GrantSupply(address indexed exchequer, address indexed user, uint256 amount);
	event Withdraw(address indexed exchequer, address indexed user, uint256 amount);
	event GrantWithdraw(address indexed exchequer, address indexed user, uint256 amount);

	function addSupply(
		mapping(address => Types.Exchequer) storage exchequers,
		address underlyingAsset,
		address governanceAsset,
		uint256 amount
	) internal {
		Types.Exchequer storage exchequer = exchequers[underlyingAsset];
		exchequer.update();
		StrategusService.guardAddSupply(exchequer, amount);

		IERC20(underlyingAsset).transferFrom(msg.sender, exchequer.sTokenAddress, amount);
		ISToken(exchequer.sTokenAddress).mint(
			msg.sender,
			amount,
			exchequer.supplyIndex
		);
		IThurmanToken(governanceAsset).mint(msg.sender, amount);
		exchequer.updateSupplyRate();

		emit Supply(underlyingAsset, msg.sender, amount);

	}

	function addGrantSupply(
		mapping(address => Types.Exchequer) storage exchequers,
		address underlyingAsset,
		address governanceAsset,
		uint256 amount
	) internal {
		Types.Exchequer storage exchequer = exchequers[underlyingAsset];
		StrategusService.guardAddGrantSupply(exchequer, amount);
		IERC20(underlyingAsset).transferFrom(msg.sender, exchequer.gTokenAddress, amount);
		IGToken(exchequer.gTokenAddress).mint(msg.sender, amount);
		IThurmanToken(governanceAsset).mint(msg.sender, amount);

		emit GrantSupply(underlyingAsset, msg.sender, amount);
	}

	function withdraw(
		mapping(address => Types.Exchequer) storage exchequers,
		address underlyingAsset,
		address governanceAsset,
		uint256 amount
	) internal {
		Types.Exchequer storage exchequer = exchequers[underlyingAsset];
		exchequer.update();

		uint256 userBalance = ISToken(exchequer.sTokenAddress).scaledBalanceOf(msg.sender).rayMul(
			exchequer.supplyIndex
		);
		
		StrategusService.guardWithdraw(
			exchequer,
			userBalance, 
			amount
		);

		ISToken(exchequer.sTokenAddress).burn(
			msg.sender,
			amount,
			exchequer.supplyIndex
		);

		uint256 thurmanTokenBalance = IThurmanToken(governanceAsset).balanceOf(msg.sender);
		
		if (userBalance > thurmanTokenBalance) {
			IThurmanToken(governanceAsset).burn(msg.sender, thurmanTokenBalance);
		} else {
			IThurmanToken(governanceAsset).burn(msg.sender, amount);	
		}

		exchequer.updateSupplyRate();

		emit Withdraw(underlyingAsset, msg.sender, amount);
	}

	function grantWithdraw(
		mapping(address => Types.Exchequer) storage exchequers,
		address underlyingAsset,
		address governanceAsset,
		uint256 amount
	) internal {
		Types.Exchequer storage exchequer = exchequers[underlyingAsset];
		uint256 userBalance = IGToken(exchequer.gTokenAddress).balanceOf(msg.sender);
		StrategusService.guardGrantWithdraw(
			exchequer,
			userBalance,
			amount
		);
		IGToken(exchequer.gTokenAddress).burn(msg.sender, amount);
		IThurmanToken(governanceAsset).burn(msg.sender, amount);

		emit GrantWithdraw(underlyingAsset, msg.sender, amount);
	}
}