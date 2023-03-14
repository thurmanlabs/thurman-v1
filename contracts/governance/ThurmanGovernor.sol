// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import {IERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC165Upgradeable.sol";
import {IVotesUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/utils/IVotesUpgradeable.sol";
import {GovernorUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/GovernorUpgradeable.sol";
import {GovernorCompatibilityBravoUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/compatibility/GovernorCompatibilityBravoUpgradeable.sol";
import {GovernorVotesUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesUpgradeable.sol";
import {GovernorVotesQuorumFractionUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol";
import {GovernorTimelockControlUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorTimelockControlUpgradeable.sol";
import {TimelockControllerUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/TimelockControllerUpgradeable.sol";
import {IGovernorUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/IGovernorUpgradeable.sol";

contract ThurmanGovernor is GovernorUpgradeable, GovernorCompatibilityBravoUpgradeable, GovernorVotesUpgradeable, GovernorVotesQuorumFractionUpgradeable, GovernorTimelockControlUpgradeable {
    uint256 public _votingDelay;
    uint256 public _votingPeriod;
    uint256 public _proposalThreshold;

    function initialize(
        IVotesUpgradeable _token,
        TimelockControllerUpgradeable _timelock,
        string memory name,
        uint256 govVotingDelay,
        uint256 govVotingPeriod,
        uint256 govProposalThreshold
    ) external initializer {
        __Governor_init(name);
        __GovernorVotes_init(_token);
        __GovernorVotesQuorumFraction_init(4);
        __GovernorTimelockControl_init(_timelock);
        _setVotingDelay(govVotingDelay);
        _setVotingPeriod(govVotingPeriod);
        _setProposalThreshold(govProposalThreshold);
    }

    function _setVotingDelay(uint256 newVotingDelay) internal {
        _votingDelay = newVotingDelay;
    }

    function _setVotingPeriod(uint256 newVotingPeriod) internal {
        _votingPeriod = newVotingPeriod;
    }

    function _setProposalThreshold(uint256 newProposalThreshold) internal {
        _proposalThreshold = newProposalThreshold;
    }

    function votingDelay() public view override returns (uint256) {
        // return 6575; // 1 day
        return _votingDelay;
    }

    function votingPeriod() public view override returns (uint256) {
        // return 46027; // 1 week
        return _votingPeriod;
    }

    function proposalThreshold() public view override returns (uint256) {
        // return 0;
        return _proposalThreshold;
    }

    // The functions below are overrides required by Solidity.

    function state(uint256 proposalId)
        public
        view
        override(GovernorUpgradeable, IGovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function propose(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description)
        public
        override(GovernorUpgradeable, GovernorCompatibilityBravoUpgradeable, IGovernorUpgradeable)
        returns (uint256)
    {
        return super.propose(targets, values, calldatas, description);
    }

    function _execute(uint256 proposalId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
    {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (uint256)
    {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (address)
    {
        return super._executor();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(GovernorUpgradeable, IERC165Upgradeable, GovernorTimelockControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}