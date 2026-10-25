// Public API of @zkred/zk-core (md/CONTRACTS.md §4.1). Everything not exported here is internal.
// Age proof, Merkle, status list and buildPresentation are typed stubs that throw NOT_IMPLEMENTED until V1.1.

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

export { walletCrypto } from "./wallet-crypto";

export {
  dobCommitment,
  proveAgeGte,
  verifyAgeGte,
  merkleRoot,
  merkleProof,
  verifyMerkleProof,
  statusList,
  buildPresentation,
} from "./pending";
