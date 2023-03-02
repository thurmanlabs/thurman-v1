// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import {TimelockControllerUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/TimelockControllerUpgradeable.sol";

contract ThurmanTimelock is TimelockControllerUpgradeable {
	function initialize(
		uint256 minDelay, 
		address[] memory proposers, 
		address[] memory executors, 
		address admin
	) external initializer {
		__TimelockController_init(minDelay, proposers, executors, admin);
	}
}