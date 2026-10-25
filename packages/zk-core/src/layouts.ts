// BBS message layouts. Mirrors md/CONTRACTS.md §4.1 — indices are FROZEN forever:
// changing one invalidates every credential already issued.

export const CREDENTIAL_TYPES = ["Degree", "GovernmentId", "MedicalLicense"] as const;
export type CredentialType = (typeof CREDENTIAL_TYPES)[number];

export type FieldKind = "string" | "date" | "int";
/** meta = set by the issuer service, claim = typed by the issuer, derived = computed from claims. */
export type FieldSource = "meta" | "claim" | "derived";

export interface LayoutField {
  index: number;
  name: string;
  label: string;
  kind: FieldKind;
  pii: boolean;
  source: FieldSource;
}

export interface CredentialLayout {
  type: CredentialType;
  version: number;
  fields: readonly LayoutField[];
}

const META_FIELDS: readonly LayoutField[] = [
  { index: 0, name: "cred_type", label: "Credential type", kind: "string", pii: false, source: "meta" },
  { index: 1, name: "issuer_did", label: "Issuer DID", kind: "string", pii: false, source: "meta" },
  { index: 2, name: "key_id", label: "Issuer key id", kind: "string", pii: false, source: "meta" },
  { index: 3, name: "batch_id", label: "Issuance batch", kind: "string", pii: false, source: "meta" },
  { index: 4, name: "status_list_id", label: "Status list", kind: "string", pii: false, source: "meta" },
  { index: 5, name: "status_index", label: "Status index", kind: "int", pii: false, source: "meta" },
  { index: 6, name: "commitment", label: "Commitment", kind: "string", pii: false, source: "meta" },
  { index: 7, name: "issued_at", label: "Issued at (claimed)", kind: "string", pii: false, source: "meta" },
  { index: 8, name: "holder_binding", label: "Holder binding", kind: "string", pii: false, source: "meta" },
];

/** Indices 0–6 are always revealed in a presentation (CONTRACTS §4.1). */
export const MANDATORY_REVEAL_MAX_INDEX = 6;

export const CREDENTIAL_LAYOUTS: Readonly<Record<CredentialType, CredentialLayout>> = {
  Degree: {
    type: "Degree",
    version: 1,
    fields: [
      ...META_FIELDS,
      { index: 9, name: "holder_name", label: "Holder name", kind: "string", pii: true, source: "claim" },
      { index: 10, name: "degree_name", label: "Degree", kind: "string", pii: false, source: "claim" },
      { index: 11, name: "major", label: "Major", kind: "string", pii: false, source: "claim" },
      { index: 12, name: "institution", label: "Institution", kind: "string", pii: false, source: "claim" },
      { index: 13, name: "graduation_year", label: "Graduation year", kind: "int", pii: false, source: "claim" },
      { index: 14, name: "grade", label: "Grade", kind: "string", pii: true, source: "claim" },
    ],
  },
  GovernmentId: {
    type: "GovernmentId",
    version: 1,
    fields: [
      ...META_FIELDS,
      { index: 9, name: "holder_name", label: "Holder name", kind: "string", pii: true, source: "claim" },
      { index: 10, name: "dob", label: "Date of birth", kind: "date", pii: true, source: "claim" },
      { index: 11, name: "address", label: "Address", kind: "string", pii: true, source: "claim" },
      { index: 12, name: "dob_salt", label: "DOB salt", kind: "string", pii: true, source: "derived" },
      { index: 13, name: "dob_commitment", label: "DOB commitment", kind: "string", pii: false, source: "derived" },
      { index: 14, name: "nationality", label: "Nationality", kind: "string", pii: false, source: "claim" },
    ],
  },
  MedicalLicense: {
    type: "MedicalLicense",
    version: 1,
    fields: [
      ...META_FIELDS,
      { index: 9, name: "holder_name", label: "Holder name", kind: "string", pii: true, source: "claim" },
      { index: 10, name: "license_type", label: "License type", kind: "string", pii: false, source: "claim" },
      { index: 11, name: "registration_no", label: "Registration number", kind: "string", pii: true, source: "claim" },
      { index: 12, name: "council", label: "Council", kind: "string", pii: false, source: "claim" },
      { index: 13, name: "valid_until", label: "Valid until", kind: "date", pii: false, source: "claim" },
      { index: 14, name: "license_status", label: "License status", kind: "string", pii: false, source: "claim" },
    ],
  },
};
