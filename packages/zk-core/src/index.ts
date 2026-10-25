// Public API of @zkred/zk-core (md/CONTRACTS.md §4.1). Everything not exported here is internal.
// V0-H2 ships only the layouts; BBS, policy, age proof, merkle, status list and wallet crypto land in V0-H5.

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
