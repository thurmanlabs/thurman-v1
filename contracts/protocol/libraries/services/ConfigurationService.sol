// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import {Types} from "../types/Types.sol";
import {ExchequerService} from "./ExchequerService.sol";

library ConfigurationService {
	using ExchequerService for Types.Exchequer;

	function setExchequerBorrowing(
		mapping(address => Types.Exchequer) storage exchequers,
		address underlyingAsset, 
		bool enabled
	) internal {
		Types.Exchequer storage exchequer = exchequers[underlyingAsset];
		exchequer.borrowingEnabled = enabled;
	}

	function setExchequerActive(
		mapping(address => Types.Exchequer) storage exchequers,
		address underlyingAsset, 
		bool active
	) internal {
		Types.Exchequer storage exchequer = exchequers[underlyingAsset];
		exchequer.active = active;
	}

	function setSupplyCap(
		mapping(address => Types.Exchequer) storage exchequers,
		address underlyingAsset,
		uint256 supplyCap
	) internal {
		Types.Exchequer storage exchequer = exchequers[underlyingAsset];
		exchequer.supplyCap = supplyCap;
	}

	function setBorrowCap(
		mapping(address => Types.Exchequer) storage exchequers,
		address underlyingAsset,
		uint256 borrowCap
	) internal {
		Types.Exchequer storage exchequer = exchequers[underlyingAsset];
		exchequer.borrowCap = borrowCap;
	}
}