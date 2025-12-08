// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Arrays} from "@openzeppelin/contracts/utils/Arrays.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IGToken} from "../../../interfaces/IGToken.sol";
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

	event OriginationFee(
		uint128 indexed id,
		address indexed borrower,
		address indexed exchequer,
		uint256 borrowMax,
		uint256 feeAmount
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

	event Delinquent(
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
		uint256 protocolBorrowFee = exchequer.calculateProtocolFee(borrowMax);
		StrategusService.guardCreateLineOfCredit(
			exchequer,
			linesOfCredit,
			underlyingAsset,
			borrower,
			borrowMax,
			protocolBorrowFee
		);
		linesOfCredit[borrower].underlyingAsset = underlyingAsset;
		IDToken(exchequer.dTokenAddress).updateRate(borrower, rate);
		linesOfCredit[borrower].creationTimestamp = uint40(block.timestamp);
		linesOfCredit[borrower].expirationTimestamp = uint40(block.timestamp + termDays * 1 days);
		linesOfCredit[borrower].id = uint128(linesOfCreditCount + 1);
		linesOfCredit[borrower].deliquent = false;		
		linesOfCredit[borrower].borrowMax = borrowMax;
		exchequer.totalDebt += linesOfCredit[borrower].borrowMax;
		ISToken(exchequer.sTokenAddress).transferOnOrigination(borrower, protocolBorrowFee);
		emit OriginationFee(
			linesOfCredit[borrower].id,
			borrower,
			underlyingAsset,
			borrowMax,
			protocolBorrowFee
		);

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

	function ownerRepay(
		mapping(address => Types.Exchequer) storage exchequers,
		mapping(address => Types.LineOfCredit) storage linesOfCredit,
		address borrower,
		address underlyingAsset,
		uint256 amount
	) internal {
		Types.Exchequer storage exchequer = exchequers[underlyingAsset];
		exchequer.update();
		
		StrategusService.guardRepay(
			exchequer,
			linesOfCredit,
			borrower,
			amount
		);
		
		// Get borrower's actual debt balance (including accrued interest)
		uint256 borrowerDebt = IDToken(exchequer.dTokenAddress).balanceOf(borrower);
		
		// Validate borrower has debt
		require(borrowerDebt > 0, "BORROWER_HAS_NO_DEBT");
		
		// Cap amount to actual debt to prevent overpayment
		uint256 repayAmount = amount > borrowerDebt ? borrowerDebt : amount;
		
		// Burn debt tokens
		IDToken(exchequer.dTokenAddress).burn(
			borrower,
			repayAmount
		);
		
		// Transfer underlying tokens from owner to exchequer
		IERC20(underlyingAsset).transferFrom(msg.sender, exchequer.sTokenAddress, repayAmount);
		
		// Update state
		exchequer.updateSupplyRate();
		linesOfCredit[borrower].lastRepaymentTimestamp = uint40(block.timestamp);
		
		// Emit event with actual repayment amount
		emit Repay(
			linesOfCredit[borrower].id,
			msg.sender,
			underlyingAsset,
			repayAmount
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

	function markDelinquent(
		mapping(address => Types.Exchequer) storage exchequers,
		mapping(address => Types.LineOfCredit) storage linesOfCredit,
		address borrower,
		address underlyingAsset
	) internal {
		Types.Exchequer storage exchequer = exchequers[underlyingAsset];
		StrategusService.guardDelinquency(
			exchequer,
			linesOfCredit,
			borrower
		);
		uint256 remainingBalance = IDToken(exchequer.dTokenAddress).balanceOf(borrower);
		linesOfCredit[borrower].deliquent = true;
		emit Delinquent(
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
		address borrower,
		address underlyingAsset
	) internal {
		Types.Exchequer storage exchequer = exchequers[underlyingAsset];
		if (exchequer.totalDebt <= linesOfCredit[borrower].borrowMax) {
			exchequer.totalDebt = 0;
		} else {
			exchequer.totalDebt -= linesOfCredit[borrower].borrowMax;
		}
		
		uint128 logId = linesOfCredit[borrower].id;
		uint40 logExpirationTimestamp = linesOfCredit[borrower].expirationTimestamp;
		delete linesOfCredit[borrower];
		emit CloseLineOfCredit(
			logId,
			borrower,
			underlyingAsset,
			logExpirationTimestamp
		);
	}
}