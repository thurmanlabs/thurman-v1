// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISToken} from "../../../interfaces/ISToken.sol";
import {Types} from "../types/Types.sol";
import {ExchequerService} from "./ExchequerService.sol";
import {StrategusService} from "./StrategusService.sol";
import {WadRayMath} from "../math/WadRayMath.sol";

library SupplyService {
	using WadRayMath for uint256;
	using ExchequerService for Types.Exchequer;

	event Supply(address indexed exchequer, address indexed user, uint256 amount);
	event Withdraw(address indexed exchequer, address indexed user, uint256 amount);

	function addSupply(
		mapping(address => Types.Exchequer) storage exchequers,
		address underlyingAsset,
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
		exchequer.updateSupplyRate();

		emit Supply(underlyingAsset, msg.sender, amount);

	}

	function withdraw(
		mapping(address => Types.Exchequer) storage exchequers,
		address underlyingAsset,
		uint256 amount
	) internal {
		Types.Exchequer storage exchequer = exchequers[underlyingAsset];
		exchequer.update();

		uint256 userBalance = ISToken(exchequer.sTokenAddress).scaledBalanceOf(msg.sender).rayMul(
			exchequer.supplyIndex
		);
		StrategusService.guardWithdraw(exchequer, userBalance, amount);

		ISToken(exchequer.sTokenAddress).burn(
			msg.sender,
			amount,
			exchequer.supplyIndex
		);
		exchequer.updateSupplyRate();

		emit Withdraw(underlyingAsset, msg.sender, amount);
	}
}