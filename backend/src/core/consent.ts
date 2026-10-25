// Plain-language consent summary for a policy. Deterministic: it is the fallback the spec requires when Bedrock is
// unavailable, and the only summary until ai.consentSummary lands (V1.1-H3). Field names come from the layouts.
import { CREDENTIAL_LAYOUTS, MANDATORY_REVEAL_MAX_INDEX, type PresentationPolicy } from "@zkred/zk-core";

const TYPE_LABELS: Record<string, string> = {
  Degree: "degree",
  GovernmentId: "government ID",
  MedicalLicense: "medical license",
};

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Layout label of `field` in `type` (falls back to the field name), lower-cased for running text. */
function labelOf(field: string): string {
  for (const layout of Object.values(CREDENTIAL_LAYOUTS)) {
    const f = layout.fields.find((x) => x.name === field);
    if (f) return f.label.toLowerCase();
  }
  return field.replace(/_/g, " ");
}

export function consentTemplate(verifierName: string, policy: PresentationPolicy): string {
  const lines = [`${verifierName} is asking for proof: ${policy.purpose}`];
  for (const r of policy.requirements) {
    const type = TYPE_LABELS[r.credential_type] ?? r.credential_type;
    const fields = CREDENTIAL_LAYOUTS[r.credential_type].fields;
    const revealed = r.reveal
      .map((name) => fields.find((f) => f.name === name))
      .filter((f) => f !== undefined && f.index > MANDATORY_REVEAL_MAX_INDEX)
      .map((f) => f!.label.toLowerCase());
    const parts = [`From your ${type}${r.accredited_only ? " (accredited issuer only)" : ""}:`];
    parts.push(revealed.length ? `you share ${list(revealed)}` : "you share no personal fields");
    for (const p of r.predicates) parts.push(`you prove you are at least ${p.years} years old without revealing your date of birth`);
    if (r.require_not_revoked) parts.push("it is checked to be not revoked");
    lines.push(`${parts[0]} ${parts.slice(1).join("; ")}.`);
  }
  if (policy.never_collect.length) lines.push(`Never shared: ${list(policy.never_collect.map(labelOf))}.`);
  lines.push("Each proof also shows its issuer, signing key, issuance batch and revocation slot so it can be checked.");
  return lines.join("\n");
}
