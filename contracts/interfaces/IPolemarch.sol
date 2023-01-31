// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import {Types} from "../protocol/libraries/types/Types.sol";

interface IPolemarch {
	event Supply(address indexed exchequer, address indexed user, uint256 amount);
	event Withdraw(address indexed exchequer, address indexed user, uint256 amount);

	function supply(address underlyingAsset, uint256 amount) external;
	
	function withdraw(address underlyingAsset, uint256 amount) external;

	function createLineOfCredit(
		address borrower,
		address underlyingAsset,
		uint256 borrowMax,
		uint128 rate,
		uint40 termDays
	) external;

	function borrow(address underlyingAsset, uint256 amount) external;

	function repay(address underlyingAsset, uint256 amount) external;

	function addExchequer(
		address underlyingAsset, 
		address sTokenAddress, 
		address dTokenAddress, 
		uint8 decimals
	) external;

	function deleteExchequer(address underlyingAsset) external;

	function getExchequer(address underlyingAsset) external view returns (Types.Exchequer memory);

	function getLineOfCredit(address borrower) external view returns (Types.LineOfCredit memory);

	function getNormalizedReturn(address underlyingAsset) external view returns (uint256); 
}