// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IssuerRegistry} from "./IssuerRegistry.sol";

/// @title StatusRegistry
/// @notice Pins the hash of each issuer's revocation bitstring list. The list itself is served
///         off-chain; verifiers download the whole list (herd privacy) and compare its hash here,
///         so no per-person revocation history is ever public.
contract StatusRegistry {
    struct StatusList {
        bytes32 issuerId;
        bytes32 listHash;
        uint64 updatedAt;
    }

    IssuerRegistry public immutable issuerRegistry;
    mapping(bytes32 listId => StatusList) private _lists;

    event StatusListUpdated(bytes32 indexed issuerId, bytes32 indexed listId, bytes32 listHash);

    error NotGovernance(bytes32 issuerId);
    error ListOwnedByAnotherIssuer(bytes32 listId, bytes32 owner);
    error UnknownList(bytes32 listId);
    error ZeroValue();

    constructor(IssuerRegistry registry) {
        issuerRegistry = registry;
    }

    /// @notice First write binds `listId` to `issuerId`; later writes must come from the same issuer.
    function setListHash(bytes32 issuerId, bytes32 listId, bytes32 listHash) external {
        if (listId == bytes32(0) || listHash == bytes32(0)) revert ZeroValue();
        if (!issuerRegistry.isGovernance(issuerId, msg.sender)) revert NotGovernance(issuerId);
        StatusList storage l = _lists[listId];
        if (l.updatedAt != 0 && l.issuerId != issuerId) revert ListOwnedByAnotherIssuer(listId, l.issuerId);
        l.issuerId = issuerId;
        l.listHash = listHash;
        l.updatedAt = uint64(block.timestamp);
        emit StatusListUpdated(issuerId, listId, listHash);
    }

    function getListHash(bytes32 listId) external view returns (bytes32 issuerId, bytes32 listHash, uint64 updatedAt) {
        StatusList storage l = _lists[listId];
        if (l.updatedAt == 0) revert UnknownList(listId);
        return (l.issuerId, l.listHash, l.updatedAt);
    }
}
