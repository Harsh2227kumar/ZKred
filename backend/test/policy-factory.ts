// Test factory: the canonical employer policy (degree + age ≥ 21 + active license), built from the layouts.
import type { PresentationPolicy } from "@zkred/zk-core";

export function employerPolicy(purpose: string, minAge = 21): PresentationPolicy {
  const base = { accredited_only: true, issuer_kinds: null, issuer_dids: null, equals: [], require_not_revoked: true };
  return {
    purpose,
    requirements: [
      { ...base, id: "r1", credential_type: "Degree", reveal: ["degree_name", "institution"], predicates: [] },
      { ...base, id: "r2", credential_type: "GovernmentId", reveal: [], predicates: [{ type: "age_gte", years: minAge }] },
      { ...base, id: "r3", credential_type: "MedicalLicense", reveal: ["license_type", "license_status"], predicates: [] },
    ],
    never_collect: ["holder_name", "dob", "address"],
  };
}
