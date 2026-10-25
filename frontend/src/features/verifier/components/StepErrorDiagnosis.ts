// frontend/src/features/verifier/components/StepErrorDiagnosis.ts
// Maps deterministic verification step error codes (from md/CONTRACTS.md §2 and backend/src/core/verifier.ts)
// to human-friendly, judge-ready diagnostic descriptions and recommendations.

export interface StepErrorDetail {
  title: string;
  explanation: string;
  recommendation: string;
}

export const STEP_ERROR_MAP: Record<string, StepErrorDetail> = {
  BBS_INVALID: {
    title: 'Signature Proof Mismatch or Replay',
    explanation: 'The BBS+ cryptographic signature proof is invalid, has been tampered with, or was generated for a different request nonce.',
    recommendation: 'Ensure the presentation is signed fresh directly for this verification nonce to prevent replay attacks.',
  },
  ISSUER_UNKNOWN: {
    title: 'Unregistered Institutional Issuer',
    explanation: 'The issuing authority is not registered in the institutional registry or is missing on Base Sepolia.',
    recommendation: 'Credentials must originate from an accredited university, medical council, or government agency.',
  },
  ISSUER_NOT_ACCREDITED: {
    title: 'Issuer Lacks On-Chain Accreditation',
    explanation: 'The issuing institution lacks active accreditation pinned on the Base Sepolia IssuerRegistry smart contract.',
    recommendation: 'The verifier policy requires credentials strictly from accredited institutions.',
  },
  ISSUER_NOT_ALLOWED: {
    title: 'Unauthorized Institution',
    explanation: 'This credential was issued by an authority not included in the verifier board’s permitted institution list.',
    recommendation: 'Submit credentials issued by an authorized university or medical council specified in the policy.',
  },
  KEY_UNKNOWN: {
    title: 'Signing Key Not Registered',
    explanation: 'The signing key does not belong to the claimed institutional issuer or is not published on Base Sepolia.',
    recommendation: 'The institution must publish and activate their BLS12-381 key epoch on-chain before issuance.',
  },
  PUBKEY_HASH_MISMATCH: {
    title: 'Public Key Hash Discrepancy',
    explanation: 'The published public key does not match the cryptographic SHA-256 hash pinned in the smart contract registry.',
    recommendation: 'Potential key tampering or MITM detected; key rejected for trust security.',
  },
  POLICY_FIELD_MISSING: {
    title: 'Required Disclosure Field Withheld',
    explanation: 'A field explicitly required by the verifier evaluation policy was withheld by the student wallet.',
    recommendation: 'Holder must selectively disclose all attributes requested by the evaluating board.',
  },
  POLICY_EQUALS_FAILED: {
    title: 'Qualification Criteria Mismatch',
    explanation: 'A disclosed credential attribute value does not match the required qualification criteria (e.g. required MBBS).',
    recommendation: 'Submit a credential satisfying the exact degree or qualification required by the employer.',
  },
  AGE_PROOF_INVALID: {
    title: 'zk-SNARK Range Proof Invalid',
    explanation: 'The zero-knowledge Groth16 age proof failed mathematical circuit verification against the committed verification key.',
    recommendation: 'Verify that the circuit proof was computed using the authentic circom artifacts.',
  },
  AGE_COMMITMENT_MISMATCH: {
    title: 'Commitment Binding Discrepancy',
    explanation: 'The age proof was computed on a different commitment than the signed dob_commitment in the GovernmentId.',
    recommendation: 'The zk-SNARK age predicate must bind directly to the signed identity commitment.',
  },
  AGE_PROOF_STALE_DATE: {
    title: 'Proof Cutoff Date Expired',
    explanation: 'The calendar cutoff date encoded in the range proof is older than today’s date, failing the age threshold.',
    recommendation: 'Generate a fresh zero-knowledge age proof using current calendar day calculations.',
  },
  REVOCATION_LIST_TAMPERED: {
    title: 'Revocation Registry Discrepancy',
    explanation: 'The published status list bitstring does not match the 32-byte root hash pinned on Base Sepolia.',
    recommendation: 'Institutional status list synchronization discrepancy detected.',
  },
  REVOKED: {
    title: 'Credential Revoked on Base Sepolia',
    explanation: 'The issuing authority has marked this specific credential as revoked in the StatusRegistry contract.',
    recommendation: 'Contact the issuing institution or registrar for credential re-issuance.',
  },
  BATCH_NOT_ANCHORED: {
    title: 'Issuance Batch Not Anchored',
    explanation: 'The credential’s issuance batch was never anchored on Base Sepolia or was anchored under another key.',
    recommendation: 'Issuing institutions must anchor open batches on-chain to seal timestamped evidence.',
  },
  MERKLE_PROOF_INVALID: {
    title: 'Merkle Tree Inclusion Failure',
    explanation: 'The credential’s Poseidon commitment does not exist in the Merkle root anchored on the blockchain.',
    recommendation: 'Credential leaf commitment is not part of the verified institutional batch.',
  },
  KEY_COMPROMISED_ANCHORED_IN_WINDOW: {
    title: 'Anchored During Breach Compromise Window',
    explanation: 'This credential was anchored during the 48-hour key compromise breach window and cannot be trusted.',
    recommendation: 'The holder must use the Wallet Refresh feature to obtain a safe, re-issued credential.',
  },
  CHAIN_UNAVAILABLE: {
    title: 'Blockchain RPC Offline (Fail-Closed)',
    explanation: 'Base Sepolia RPC connection failed. The evaluation engine fails closed to prevent unverified proofs from passing.',
    recommendation: 'Verification will succeed once the blockchain network connection stabilizes.',
  },
};

export function getStepErrorDiagnosis(code?: string): StepErrorDetail {
  if (!code) {
    return {
      title: 'Verification Step Failed',
      explanation: 'This evaluation stage could not be cryptographically confirmed.',
      recommendation: 'Review the presentation requirements and verify against on-chain records.',
    };
  }

  return (
    STEP_ERROR_MAP[code] || {
      title: `Verification Failed (${code})`,
      explanation: `Step check failed with error code: ${code}.`,
      recommendation: 'Check the evaluation chain details for cryptographic mismatch.',
    }
  );
}
