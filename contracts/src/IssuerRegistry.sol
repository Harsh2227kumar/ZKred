// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IssuerRegistry
/// @notice Accredited credential issuers and their BBS+ signing keys, with key epochs.
/// @dev The accreditor (deployer) stands in for a national accreditation body. Each issuer is
///      controlled by a separate governance address — NOT the BBS signing key — so stealing the
///      signing key does not let an attacker rewrite the registry.
contract IssuerRegistry {
    enum KeyStatus {
        None,
        Active,
        Rotated,
        Compromised
    }

    struct Issuer {
        string did;
        address governance;
        bool accredited;
        bool exists;
    }

    struct Key {
        bytes32 issuerId;
        bytes32 pubKeyHash;
        uint64 activeFrom;
        KeyStatus status;
        uint64 compromisedFrom;
    }

    address public immutable accreditor;

    mapping(bytes32 issuerId => Issuer) private _issuers;
    mapping(bytes32 keyId => Key) private _keys;

    event IssuerRegistered(bytes32 indexed issuerId, string did, address governance);
    event IssuerAccreditationChanged(bytes32 indexed issuerId, bool accredited);
    event KeyAdded(bytes32 indexed issuerId, bytes32 indexed keyId, bytes32 pubKeyHash);
    event KeyRotated(bytes32 indexed issuerId, bytes32 oldKeyId, bytes32 newKeyId);
    event KeyCompromised(bytes32 indexed issuerId, bytes32 indexed keyId, uint64 compromisedFrom);

    error NotAccreditor();
    error NotGovernance(bytes32 issuerId);
    error IssuerExists(bytes32 issuerId);
    error UnknownIssuer(bytes32 issuerId);
    error ZeroValue();
    error KeyExists(bytes32 keyId);
    error UnknownKey(bytes32 keyId);
    error KeyNotOwnedByIssuer(bytes32 keyId, bytes32 issuerId);
    error CutoffInFuture(uint64 compromisedFrom);
    error CutoffNotEarlier(uint64 current, uint64 proposed);

    constructor() {
        accreditor = msg.sender;
    }

    modifier onlyAccreditor() {
        if (msg.sender != accreditor) revert NotAccreditor();
        _;
    }

    modifier onlyGovernance(bytes32 issuerId) {
        Issuer storage i = _issuers[issuerId];
        if (!i.exists) revert UnknownIssuer(issuerId);
        if (msg.sender != i.governance) revert NotGovernance(issuerId);
        _;
    }

    // ---------------------------------------------------------------- accreditor

    /// @notice Registers and accredits an issuer. Accreditation can later be withdrawn.
    function registerIssuer(bytes32 issuerId, string calldata did, address governance) external onlyAccreditor {
        if (issuerId == bytes32(0) || governance == address(0) || bytes(did).length == 0) revert ZeroValue();
        if (_issuers[issuerId].exists) revert IssuerExists(issuerId);
        _issuers[issuerId] = Issuer({did: did, governance: governance, accredited: true, exists: true});
        emit IssuerRegistered(issuerId, did, governance);
        emit IssuerAccreditationChanged(issuerId, true);
    }

    function setAccredited(bytes32 issuerId, bool accredited) external onlyAccreditor {
        Issuer storage i = _issuers[issuerId];
        if (!i.exists) revert UnknownIssuer(issuerId);
        i.accredited = accredited;
        emit IssuerAccreditationChanged(issuerId, accredited);
    }

    // ---------------------------------------------------------------- issuer governance

    function addKey(bytes32 issuerId, bytes32 keyId, bytes32 pubKeyHash) external onlyGovernance(issuerId) {
        _addKey(issuerId, keyId, pubKeyHash);
    }

    /// @notice Retires `oldKeyId` and activates `newKeyId`. A compromised key keeps its Compromised status.
    function rotateKey(bytes32 issuerId, bytes32 oldKeyId, bytes32 newKeyId, bytes32 newPubKeyHash)
        external
        onlyGovernance(issuerId)
    {
        Key storage old = _ownedKey(issuerId, oldKeyId);
        if (old.status == KeyStatus.Active) old.status = KeyStatus.Rotated;
        _addKey(issuerId, newKeyId, newPubKeyHash);
        emit KeyRotated(issuerId, oldKeyId, newKeyId);
    }

    /// @notice Declares that signatures by `keyId` cannot be trusted for batches anchored at or after
    ///         `compromisedFrom`. Can be called again only to move the cutoff EARLIER (more conservative).
    function markCompromised(bytes32 issuerId, bytes32 keyId, uint64 compromisedFrom)
        external
        onlyGovernance(issuerId)
    {
        if (compromisedFrom > block.timestamp) revert CutoffInFuture(compromisedFrom);
        Key storage k = _ownedKey(issuerId, keyId);
        if (k.status == KeyStatus.Compromised && compromisedFrom >= k.compromisedFrom) {
            revert CutoffNotEarlier(k.compromisedFrom, compromisedFrom);
        }
        k.status = KeyStatus.Compromised;
        k.compromisedFrom = compromisedFrom;
        emit KeyCompromised(issuerId, keyId, compromisedFrom);
    }

    // ---------------------------------------------------------------- views

    function getIssuer(bytes32 issuerId) external view returns (string memory did, address governance, bool accredited) {
        Issuer storage i = _issuers[issuerId];
        if (!i.exists) revert UnknownIssuer(issuerId);
        return (i.did, i.governance, i.accredited);
    }

    function getKey(bytes32 keyId)
        external
        view
        returns (bytes32 issuerId, bytes32 pubKeyHash, uint64 activeFrom, KeyStatus status, uint64 compromisedFrom)
    {
        Key storage k = _keys[keyId];
        if (k.status == KeyStatus.None) revert UnknownKey(keyId);
        return (k.issuerId, k.pubKeyHash, k.activeFrom, k.status, k.compromisedFrom);
    }

    /// @notice Used by AnchorRegistry / StatusRegistry to authorise writes.
    function isGovernance(bytes32 issuerId, address account) external view returns (bool) {
        Issuer storage i = _issuers[issuerId];
        return i.exists && i.governance == account;
    }

    /// @notice True when `keyId` belongs to `issuerId` and is currently Active.
    function isActiveKeyOf(bytes32 issuerId, bytes32 keyId) external view returns (bool) {
        Key storage k = _keys[keyId];
        return k.status == KeyStatus.Active && k.issuerId == issuerId;
    }

    // ---------------------------------------------------------------- internal

    function _addKey(bytes32 issuerId, bytes32 keyId, bytes32 pubKeyHash) private {
        if (keyId == bytes32(0) || pubKeyHash == bytes32(0)) revert ZeroValue();
        if (_keys[keyId].status != KeyStatus.None) revert KeyExists(keyId);
        _keys[keyId] = Key({
            issuerId: issuerId,
            pubKeyHash: pubKeyHash,
            activeFrom: uint64(block.timestamp),
            status: KeyStatus.Active,
            compromisedFrom: 0
        });
        emit KeyAdded(issuerId, keyId, pubKeyHash);
    }

    function _ownedKey(bytes32 issuerId, bytes32 keyId) private view returns (Key storage k) {
        k = _keys[keyId];
        if (k.status == KeyStatus.None) revert UnknownKey(keyId);
        if (k.issuerId != issuerId) revert KeyNotOwnedByIssuer(keyId, issuerId);
    }
}
