// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IPolemarch} from "../../interfaces/IPolemarch.sol";
import {Types} from "../libraries/types/Types.sol";
import {ConfigurationService} from "../libraries/services/ConfigurationService.sol";
import {ExchequerService} from "../libraries/services/ExchequerService.sol";
import {SupplyService} from "../libraries/services/SupplyService.sol";
import {DebtService} from "../libraries/services/DebtService.sol";
import {PolemarchStorage} from "./PolemarchStorage.sol";


contract Polemarch is Initializable, OwnableUpgradeable, PolemarchStorage, IPolemarch {
	using ExchequerService for Types.Exchequer;

	function initialize() external virtual initializer {
		__Ownable_init();
		_maxExchequersCount = 10;
	}

	function addExchequer(
		address underlyingAsset,
		address sTokenAddress,
		address dTokenAddress,
		uint8 decimals
	) external onlyOwner {
		if (ExchequerService.addExchequer(
			_exchequers,
			_exchequersList,
			underlyingAsset,
			sTokenAddress,
			dTokenAddress,
			decimals,
			_exchequersCount,
			_maxExchequersCount
		)) {
			_exchequersCount++;
		}
	}

	function supply(
		address underlyingAsset,
		uint256 amount
	) public virtual override {
		SupplyService.addSupply(_exchequers, underlyingAsset, amount);
	}

	function withdraw(
		address underlyingAsset,
		uint256 amount
	) public virtual override {
		SupplyService.withdraw(_exchequers, underlyingAsset, amount);
	}

	function deleteExchequer(address underlyingAsset) external onlyOwner {
		ExchequerService.deleteExchequer(_exchequers, _exchequersList, underlyingAsset);
	}

	function getExchequer(address underlyingAsset) external view returns (Types.Exchequer memory) {
		return _exchequers[underlyingAsset];
	}

	function createLineOfCredit(
		address borrower,
		address underlyingAsset,
		uint256 borrowMax,
		uint128 rate,
		uint40 termDays
	) external onlyOwner {
		DebtService.createLineOfCredit(
			_exchequers,
			_linesOfCredit,
			_linesOfCreditCount,
			borrower,
			underlyingAsset,
			borrowMax,
			rate,
			termDays
		);
		_linesOfCreditCount++;
	}

	function borrow(
		address underlyingAsset,
		uint256 amount
	) public virtual override {
		DebtService.borrow(
			_exchequers, 
			_linesOfCredit,
			underlyingAsset,
			amount
		);
	}

	function repay(
		address underlyingAsset,
		uint256 amount
	) public virtual override {
		DebtService.repay(
			_exchequers,
			_linesOfCredit,
			underlyingAsset,
			amount
		);
	}

	function markDelinquent(address underlyingAsset, address borrower) public virtual override {
		DebtService.markDelinquent(
			_exchequers, 
			_linesOfCredit, 
			borrower, 
			underlyingAsset
		);
	}

	function closeLineOfCredit(address underlyingAsset, address borrower) public virtual override {
		DebtService.closeLineOfCredit(
			_exchequers,
			_linesOfCredit,
			borrower,
			underlyingAsset
		);
	}

	function getLineOfCredit(address borrower) external view returns (Types.LineOfCredit memory) {
		return _linesOfCredit[borrower];
	}

	function getNormalizedReturn(address underlyingAsset)
		external 
		view 
		virtual 
		override 
		returns (uint256)
	{
		return _exchequers[underlyingAsset].getNormalizedReturn();
	}

	function setExchequerBorrowing(address underlyingAsset, bool enabled) external onlyOwner {
		ConfigurationService.setExchequerBorrowing(_exchequers, underlyingAsset, enabled);
	}

	function setExchequerActive(address underlyingAsset, bool active) external onlyOwner {
		ConfigurationService.setExchequerActive(_exchequers, underlyingAsset, active);
	}

	function setSupplyCap(address underlyingAsset, uint256 supplyCap) external onlyOwner {
		ConfigurationService.setSupplyCap(_exchequers, underlyingAsset, supplyCap);
	}

	function setBorrowCap(address underlyingAsset, uint256 borrowCap) external onlyOwner {
		ConfigurationService.setBorrowCap(_exchequers, underlyingAsset, borrowCap);
	}
	// function closeLineOfCredit(){}
}