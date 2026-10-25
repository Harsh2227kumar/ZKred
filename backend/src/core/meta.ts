// Option lists, chain details and credential layouts for the UI (CONTRACTS §3.1).
// Values mirror the Postgres enums / zk-core layouts; labels are UI copy.
import { CREDENTIAL_LAYOUTS, CREDENTIAL_TYPES } from "@zkred/zk-core";
import { config } from "../config";
import { batchStatus, credentialType, issuerKind, keyStatus, verificationResult } from "../db/schema";
import type { ChainInfo, CredentialSchemaList, Enums } from "../schemas/meta.schema";

const LABELS: Record<string, string> = {
  university: "University",
  medical_council: "Medical council",
  government: "Government",
  Degree: "Degree",
  GovernmentId: "Government ID",
  MedicalLicense: "Medical license",
  active: "Active",
  rotated: "Rotated",
  compromised: "Compromised",
  open: "Open",
  anchored: "Anchored",
  age_gte: "Age at least",
  issuer_signature: "Issuer signature",
  zk_claim: "Zero-knowledge claim",
  revocation_status: "Revocation status",
  key_epoch_anchor: "Key epoch & anchor",
  accepted: "Accepted",
  rejected: "Rejected",
};

// Not stored in the DB: these mirror the contract (CONTRACTS §3.6) and the verifier engine.
const PREDICATE_TYPES = ["age_gte"] as const;
const VERIFICATION_STEPS = ["issuer_signature", "zk_claim", "revocation_status", "key_epoch_anchor"] as const;

const options = (values: readonly string[]) => values.map((value) => ({ value, label: LABELS[value] ?? value }));

export function getEnums(): Enums {
  return {
    issuer_kinds: options(issuerKind.enumValues),
    credential_types: options(credentialType.enumValues),
    key_statuses: options(keyStatus.enumValues),
    batch_statuses: options(batchStatus.enumValues),
    predicate_types: options(PREDICATE_TYPES),
    verification_steps: options(VERIFICATION_STEPS),
    verification_results: options(verificationResult.enumValues),
  };
}

export function getChainInfo(): ChainInfo {
  return {
    chain_id: config.CHAIN_ID,
    network_name: config.CHAIN_NETWORK_NAME,
    issuer_registry: config.ISSUER_REGISTRY_ADDRESS,
    anchor_registry: config.ANCHOR_REGISTRY_ADDRESS,
    status_registry: config.STATUS_REGISTRY_ADDRESS,
    explorer_tx_url_template: config.EXPLORER_TX_URL_TEMPLATE,
    breach_window_seconds: config.BREACH_WINDOW_SECONDS,
    demo_mode: config.DEMO_MODE,
  };
}

export function getCredentialSchemas(): CredentialSchemaList {
  return {
    items: CREDENTIAL_TYPES.map((t) => {
      const layout = CREDENTIAL_LAYOUTS[t];
      return { type: layout.type, version: layout.version, fields: layout.fields.map((f) => ({ ...f })) };
    }),
  };
}
