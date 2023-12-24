// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";

/**
 * @title GovernorContract
 * @dev This contract serves as the implementation for the governor contract.
 */
contract GovernorContract is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    /**
     * @dev Constructor function for the GovernorContract contract.
     * @param _token The address of the token contract used for voting.
     * @param _timelock The address of the TimelockController contract.
     * @param _quorumPercentage The percentage of votes required for a proposal to pass.
     * @param _votingPeriod The duration of the voting period in blocks.
     * @param _votingDelay The delay before voting can start after a proposal is created, in blocks.
     */
    constructor(
        IVotes _token,
        TimelockController _timelock,
        uint256 _quorumPercentage,
        uint256 _votingPeriod,
        uint256 _votingDelay
    )
        Governor("GovernorContract")
        GovernorSettings(
            _votingDelay, /* 1 block */ // voting delay
            _votingPeriod, // 45818, /* 1 week */ // voting period
            0 // proposal threshold
        )
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(_quorumPercentage)
        GovernorTimelockControl(_timelock)
    {}

    /**
     * @dev Returns the voting delay for the Governor contract.
     * @return The voting delay in seconds.
     */
    function votingDelay()
        public
        view
        override(IGovernor, GovernorSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }

    /**
     * @dev Returns the duration of the voting period.
     * @return The duration of the voting period in seconds.
     */
    function votingPeriod()
        public
        view
        override(IGovernor, GovernorSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    // The following functions are overrides required by Solidity.

    /**
     * @dev Returns the quorum required for a given block number.
     * @param blockNumber The block number for which to retrieve the quorum.
     * @return The quorum required for the specified block number.
     */
    function quorum(uint256 blockNumber)
        public
        view
        override(IGovernor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    /**
     * @dev Retrieves the number of votes for a specific account at a given block number.
     * @param account The address of the account to retrieve the votes for.
     * @param blockNumber The block number at which to retrieve the votes.
     * @return The number of votes for the specified account at the given block number.
     */
    function getVotes(address account, uint256 blockNumber)
        public
        view
        override(IGovernor, Governor)
        returns (uint256)
    {
        return super.getVotes(account, blockNumber);
    }

    /**
     * @dev Retrieves the state of a proposal.
     * @param proposalId The ID of the proposal.
     * @return The state of the proposal.
     */
    function state(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    /**
     * @dev Creates a new proposal in the governance contract.
     * @param targets The addresses of the contracts to be called in the proposal.
     * @param values The values to be sent along with the proposal calls.
     * @param calldatas The calldata to be sent along with the proposal calls.
     * @param description A description of the proposal.
     * @return The ID of the newly created proposal.
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override(Governor, IGovernor) returns (uint256) {
        return super.propose(targets, values, calldatas, description);
    }

    /**
     * @dev Returns the threshold required for a proposal to be approved.
     * @return The threshold value as a uint256.
     */
    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    /**
     * @dev Executes a proposal by calling the `_execute` function of the parent contracts.
     * @param proposalId The ID of the proposal to be executed.
     * @param targets The addresses of the contracts to be called.
     * @param values The values to be sent along with the calls.
     * @param calldatas The calldata to be passed to the contracts.
     * @param descriptionHash The hash of the proposal description.
     */
    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    /**
     * @dev Cancels a proposal by calling the `_cancel` function from the parent contracts.
     * @param targets The addresses of the contracts to be called in the proposal.
     * @param values The values to be passed to the contracts in the proposal.
     * @param calldatas The calldata to be passed to the contracts in the proposal.
     * @param descriptionHash The hash of the proposal description.
     * @return The proposal id.
     */
    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    /**
     * @dev Returns the address of the executor for the GovernorContract.
     * @return The address of the executor.
     */
    function _executor()
        internal
        view
        override(Governor, GovernorTimelockControl)
        returns (address)
    {
        return super._executor();
    }

    /**
     * @dev Checks if the contract supports a given interface.
     * @param interfaceId The interface identifier.
     * @return A boolean value indicating whether the contract supports the interface.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
