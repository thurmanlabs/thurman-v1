// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Arrays} from "@openzeppelin/contracts/utils/Arrays.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ISToken} from "../../../interfaces/ISToken.sol";
import {IDToken} from "../../../interfaces/IDToken.sol";
import {Types} from "../types/Types.sol";
import {ExchequerService} from "./ExchequerService.sol";
import {StrategusService} from "./StrategusService.sol";

library DebtService {
	using ExchequerService for Types.Exchequer;
	using SafeCast for uint256; 

	event CreateLineOfCredit(
		uint128 indexed id,
		uint128 rate,
		address indexed borrower,
		address indexed exchequer,
		uint256 borrowMax,
		uint40 expirationTimestamp
	);

	event Borrow(
		uint128 indexed lineOfCreditId,
		uint128 rate,
		address indexed borrower,
		address indexed exchequer,
		uint256 amount
	);

	event Repay(
		uint128 indexed lineOfCreditId,
		address indexed borrower,
		address indexed exchequer,
		uint256 amount
	);

	event Deliquent(
		uint128 indexed lineOfCreditId,
		address indexed borrower,
		address indexed exchequer,
		uint256 remainingBalance,
		uint40 expirationTimestamp
	);

	event CloseLineOfCredit(
		uint128 indexed lineOfCreditId,
		address indexed borrower,
		address indexed exchequer,
		uint40 expirationTimestamp
	);

	function createLineOfCredit(
		mapping(address => Types.Exchequer) storage exchequers,
		mapping(address => Types.LineOfCredit) storage linesOfCredit,
		uint256 linesOfCreditCount,
		address borrower,
		address underlyingAsset,
		uint256 borrowMax,
		uint128 rate,
		uint40 termDays
	) internal {
		Types.Exchequer storage exchequer = exchequers[underlyingAsset];
		StrategusService.guardCreateLineOfCredit(
			exchequer,
			linesOfCredit,
			underlyingAsset,
			borrower,
			borrowMax
		);
		linesOfCredit[borrower].underlyingAsset = underlyingAsset;
		linesOfCredit[borrower].borrowMax = borrowMax;
		IDToken(exchequer.dTokenAddress).updateRate(borrower, rate);
		linesOfCredit[borrower].creationTimestamp = uint40(block.timestamp);
		linesOfCredit[borrower].expirationTimestamp = uint40(block.timestamp + termDays * 1 days);
		linesOfCredit[borrower].id = uint128(linesOfCreditCount + 1);
		linesOfCredit[borrower].deliquent = false;
		exchequer.totalDebt += borrowMax;
		uint256 protocolFee = exchequer.calculateProtocolFee(borrowMax, termDays);
		ISToken(exchequer.sTokenAddress).transferUnderlyingToExchequerSafe(protocolFee);
		emit CreateLineOfCredit(
			linesOfCredit[borrower].id,
			rate,
			borrower,
			underlyingAsset,
			borrowMax,
			linesOfCredit[borrower].expirationTimestamp
		);
	}

	function borrow(
		mapping(address => Types.Exchequer) storage exchequers,
		mapping(address => Types.LineOfCredit) storage linesOfCredit,
		address underlyingAsset,
		uint256 amount
	) internal {
		Types.Exchequer storage exchequer = exchequers[underlyingAsset];
		uint128 rate = IDToken(exchequer.dTokenAddress).userRate(msg.sender);
		exchequer.update();
		StrategusService.guardBorrow(
			exchequer,
			linesOfCredit,
			msg.sender,
			amount
		);
		IDToken(exchequer.dTokenAddress).mint(
			msg.sender,
			amount
		);
		exchequer.updateSupplyRate();
		ISToken(exchequer.sTokenAddress).transferUnderlying(msg.sender, amount);
		emit Borrow(
			linesOfCredit[msg.sender].id,
			rate,
			msg.sender,
			underlyingAsset,
			amount
		);
	}

	function repay(
		mapping(address => Types.Exchequer) storage exchequers,
		mapping(address => Types.LineOfCredit) storage linesOfCredit,
		address underlyingAsset,
		uint256 amount
	) internal {
		Types.Exchequer storage exchequer = exchequers[underlyingAsset];
		exchequer.update();
		
		StrategusService.guardRepay(
			exchequer,
			linesOfCredit,
			msg.sender,
			amount
		);
		IDToken(exchequer.dTokenAddress).burn(
			msg.sender,
			amount
		);
		IERC20(underlyingAsset).transferFrom(msg.sender, exchequer.sTokenAddress, amount);
		exchequer.updateSupplyRate();
		linesOfCredit[msg.sender].lastRepaymentTimestamp = uint40(block.timestamp);
		emit Repay(
			linesOfCredit[msg.sender].id,
			msg.sender,
			underlyingAsset,
			amount
		);
	}

	function markDeliquent(
		mapping(address => Types.Exchequer) storage exchequers,
		mapping(address => Types.LineOfCredit) storage linesOfCredit,
		address borrower,
		address underlyingAsset
	) internal {
		Types.Exchequer storage exchequer = exchequers[underlyingAsset];
		// exchequer.update();
		StrategusService.guardDeliquency(
			exchequer,
			linesOfCredit,
			borrower
		);
		uint256 remainingBalance = IDToken(exchequer.dTokenAddress).balanceOf(borrower);
		linesOfCredit[borrower].deliquent = true;
		emit Deliquent(
			linesOfCredit[borrower].id,
			borrower,
			underlyingAsset,
			remainingBalance,
			linesOfCredit[borrower].expirationTimestamp
		);
	}

	function closeLineOfCredit(
		mapping(address => Types.Exchequer) storage exchequers,
		mapping(address => Types.LineOfCredit) storage linesOfCredit,
		address underlyingAsset,
		address borrower
	) internal {
		Types.Exchequer storage exchequer = exchequers[underlyingAsset];
		// exchequer.update();
		StrategusService.guardCloseLineOfCredit(
			exchequer,
			linesOfCredit,
			borrower
		);
		exchequer.totalDebt -= linesOfCredit[borrower].borrowMax;
		delete linesOfCredit[borrower];
		emit CloseLineOfCredit(
			linesOfCredit[borrower].id,
			borrower,
			underlyingAsset,
			linesOfCredit[borrower].expirationTimestamp
		);
	}
}