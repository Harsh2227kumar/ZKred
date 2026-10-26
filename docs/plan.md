# V1.1-S3 Master Plan: Natural Language Policy Parse UX & Bedrock Integration

> **Owner:** SPARSH (Frontend & DevOps Lead)  
> **Task ID:** `V1.1-S3`  
> **Branch:** `sparsh/V1.1-S3-nl-parse-ux`  
> **Target:** `dev`  
> **Objective:** Deliver the complete Natural Language Policy Compiler UX on `/verifier`. Transforms plain English verification requirements into cryptographic presentation policies using AWS Bedrock Claude Sonnet (`POST /presentation-requests/parse`), displays compiled policies as interactive readable chips, showcases data minimisation notes, handles `POLICY_AMBIGUOUS` clarifying questions with guided edit-and-retry, and seamlessly connects into request creation.

---

## 1. Problem Statement & Judge Context

In **Problem Statement 3 (CASCADE '26)**, verifiers must specify complex zero-knowledge selective disclosure and ZK range constraints without requiring manual cryptographic engineering.
Under Task `V1.1-H3`, HARSH deployed the Claude Sonnet Bedrock pipeline (`backend/src/ai/policy.ts`), which converts plain-English sentences into strictly validated `PresentationPolicy` schemas via forced tool calls, returning `consent_summary` and `minimisation_notes`, or throwing `422 POLICY_AMBIGUOUS` with clarifying questions.

The goal of **`V1.1-S3`** is to build the front-facing user experience:
1. **Interactive Readable Chips**:
   - Visual inspection of the compiled policy broken down into:
     - Credential Type chips
     - Revealed Attributes chips (selective disclosure)
     - Zero-Knowledge Predicate chips (e.g. `Age ≥ 21` via Groth16)
     - Equality Constraints chips (e.g. `degree_name == MBBS`)
     - Never-Collected PII guardrails (e.g. `holder_name`, `dob`, `address` marked with lock icons)
2. **Data Minimisation Rationale (`minimisation_notes`)**:
   - Clear visual card showcasing what Bedrock intentionally withheld or proved in zero-knowledge to protect holder privacy (e.g. *"Date of birth not requested: age ≥ 21 is proven with a zero-knowledge proof instead"*).
3. **Ambiguity Resolution Flow (`POLICY_AMBIGUOUS`)**:
   - When the employer prompt is too vague or incomplete, Claude returns clarifying questions (`questions[]`).
   - The UI surfaces these questions in an interactive card with single-click suggested additions and an instant edit-and-retry input.
4. **Seamless Creation & Edit-and-Retry**:
   - Verifiers can either:
     - 1-Click publish the AI-compiled policy directly to `POST /presentation-requests`.
     - Or click "Customize in Visual Builder" to pre-fill the form and adjust individual constraints.

---

## 2. Component Architecture

```text
frontend/src/features/verifier/
├── components/
│   ├── CompiledPolicyChips.tsx       # Visual card rendering requirements as chips & never-collect PII
│   ├── MinimisationNotesCard.tsx     # Explains privacy guarantees & what was withheld/proven
│   ├── AmbiguityQuestionsCard.tsx    # Displays 422 POLICY_AMBIGUOUS questions & quick-resolve suggestions
│   ├── PolicyPromptTemplates.tsx     # One-click demo prompts (Doctor qualification, Engineer, Ambiguous test)
│   ├── ManualPolicyBuilder.tsx       # Updated to sync bi-directionally with AI compiled policy
│   └── VerificationStages.tsx        # (From V1.1-S2)
└── pages/
    └── VerifierPage.tsx              # Host page coordinating NL compile, ambiguity handling, and visual builder
```

---

## 3. Strict Rules & Constraints (`AGENTS.md`)

1. **Folder Ownership (`AGENTS.md` §1)**:
   - SPARSH owns: `frontend/`, `docs/`, `md/progress/SPARSH-PROGRESS.md`.
   - Never touch backend code or smart contracts.
2. **Zero Hardcoded Data (`AGENTS.md` §2)**:
   - All credential types, issuer kinds, and verification steps come from `/meta/enums` and `/meta/credential-schemas`.
   - AI outputs come exclusively from `POST /presentation-requests/parse`.
   - Zero mock responses or fake policy objects.
3. **Fail-Closed & Error Safety**:
   - `502 AI_UNAVAILABLE` → Graceful banner with one-click switch to the Visual Builder.
   - `422 POLICY_AMBIGUOUS` → Friendly guided questions card with edit-and-retry.

---

## 4. Verification & Testing Gates

1. **TypeScript Typecheck**: `pnpm --filter frontend typecheck` passing with 0 errors.
2. **Hardcoded Scan**: `bash scripts/check-hardcoded.sh` passing.
3. **Frontend Production Build**: `pnpm --filter frontend build` compiling cleanly.
4. **End-to-End Compile Flow**:
   - Test canonical employer sentence: *"Verify the candidate holds an accredited MBBS Degree and is at least 21 years old without revealing name or date of birth"*.
   - Verify chips, minimisation notes, and consent summary render properly.
   - Test ambiguous input (e.g. *"Verify eligibility"*) and verify clarifying questions appear.
