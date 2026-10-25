// Public API of @zkred/zk-core (md/CONTRACTS.md §4.1). Everything not exported here is internal.

export type { Hex32, SignedCredential, ZkArtifacts } from "./types";
export { ZkCoreError } from "./errors";

export {
  CREDENTIAL_TYPES,
  CREDENTIAL_LAYOUTS,
  MANDATORY_REVEAL_MAX_INDEX,
  type CredentialType,
  type CredentialLayout,
  type LayoutField,
  type FieldKind,
  type FieldSource,
} from "./layouts";

export {
  PresentationPolicySchema,
  PresentationSchema,
  ISSUER_KINDS,
  PREDICATE_TYPES,
  type PresentationPolicy,
  type PresentationRequirement,
  type Presentation,
  type PresentationItem,
  type IssuerKind,
} from "./policy";

export {
  generateIssuerKeyPair,
  pubKeyHash,
  encodeMessages,
  signCredential,
  verifyCredential,
  deriveDisclosure,
  verifyDisclosure,
} from "./bbs";

export { walletCrypto, BACKUP_KDF_ITERATIONS } from "./wallet-crypto";

export { dobCommitment, proveAgeGte, verifyAgeGte, dateToDays, ageCutoffDays, randomDobSalt } from "./age";

export { merkleRoot, merkleProof, verifyMerkleProof } from "./merkle";
export { statusList } from "./status-list";
export { buildPresentation, matchCredentials, revealFieldsFor, type IssuerInfo } from "./presentation";
