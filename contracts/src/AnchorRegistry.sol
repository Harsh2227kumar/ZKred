// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IssuerRegistry} from "./IssuerRegistry.sol";

/// @title AnchorRegistry
/// @notice Anchors the Merkle root of each issuance batch. The block timestamp is the trusted
///         issuance time: verifiers compare it with a key's `compromisedFrom` cutoff
///         ("chain time, not claimed time").
contract AnchorRegistry {
    struct Anchor {
        bytes32 root;
        bytes32 issuerId;
        bytes32 keyId;
        uint64 anchoredAt;
    }

    IssuerRegistry public immutable issuerRegistry;
    mapping(bytes32 batchId => Anchor) private _anchors;

    event BatchAnchored(bytes32 indexed batchId, bytes32 indexed issuerId, bytes32 keyId, bytes32 root, uint64 anchoredAt);

    error NotGovernance(bytes32 issuerId);
    error KeyNotActive(bytes32 keyId);
    error BatchAlreadyAnchored(bytes32 batchId);
    error UnknownBatch(bytes32 batchId);
    error ZeroValue();

    constructor(IssuerRegistry registry) {
        issuerRegistry = registry;
    }

    function anchor(bytes32 batchId, bytes32 issuerId, bytes32 keyId, bytes32 root) external {
        if (batchId == bytes32(0) || root == bytes32(0)) revert ZeroValue();
        if (!issuerRegistry.isGovernance(issuerId, msg.sender)) revert NotGovernance(issuerId);
        if (!issuerRegistry.isActiveKeyOf(issuerId, keyId)) revert KeyNotActive(keyId);
        if (_anchors[batchId].anchoredAt != 0) revert BatchAlreadyAnchored(batchId);
        uint64 anchoredAt = uint64(block.timestamp);
        _anchors[batchId] = Anchor({root: root, issuerId: issuerId, keyId: keyId, anchoredAt: anchoredAt});
        emit BatchAnchored(batchId, issuerId, keyId, root, anchoredAt);
    }

    function getAnchor(bytes32 batchId)
        external
        view
        returns (bytes32 root, bytes32 issuerId, bytes32 keyId, uint64 anchoredAt)
    {
        Anchor storage a = _anchors[batchId];
        if (a.anchoredAt == 0) revert UnknownBatch(batchId);
        return (a.root, a.issuerId, a.keyId, a.anchoredAt);
    }
}
