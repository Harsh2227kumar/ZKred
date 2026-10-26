# V1.1-S3 Implementation Specification: Natural Language Policy Parse UX

> **Owner:** SPARSH (Frontend & DevOps Lead)  
> **Task ID:** `V1.1-S3`  
> **Target Files:**
> - `frontend/src/features/verifier/components/CompiledPolicyChips.tsx`
> - `frontend/src/features/verifier/components/AmbiguityQuestionsCard.tsx`
> - `frontend/src/features/verifier/components/PolicyPromptTemplates.tsx`
> - `frontend/src/features/verifier/pages/VerifierPage.tsx`
> - `md/progress/SPARSH-PROGRESS.md`

---

## 1. Technical Data Flow & State Machine

```
User enters plain English text
          │
          ▼
POST /presentation-requests/parse
          │
    ┌─────┴─────────────────────────────────┐
    │                                       │
    ▼ (200 OK: ParseOut)                    ▼ (422 Error: POLICY_AMBIGUOUS)
CompiledPolicyChips.tsx              AmbiguityQuestionsCard.tsx
- Purpose chip                       - Displays AI clarifying questions
- Requirement cards:                 - Clickable prompt refinements
  * Credential Type                  - "Retry with Refinement" action
  * Accredited Only badge
  * Reveal fields chips
  * Equals constraints chips
  * ZK Predicates (Age ≥ 21)
- Data Minimisation Notes
- Never-Collect PII Guardrails
- "1-Click Create Request" button
- "Fine-Tune in Visual Builder"
```

---

## 2. Component Specifications

### 2.1 `CompiledPolicyChips.tsx`

Renders an AI-compiled `PresentationPolicy` in readable chips and cards:
- **Purpose**: Displays the parsed intention.
- **Requirements List**:
  - Credential Type badge (e.g. `Degree`, `GovernmentId`).
  - `accredited_only` badge (`Accredited Institutions Only`).
  - `require_not_revoked` badge (`Active Revocation Check`).
  - Disclosed fields chips (emerald green with eye icon).
  - Equals constraints chips (e.g. `degree_name == MBBS`).
  - ZK Predicates chips (e.g. `Age ≥ 21 years` via Groth16).
- **Data Minimisation Section**:
  - Explains each entry in `minimisation_notes` (e.g. *"Date of birth not requested: age ≥ 21 is proven with a zero-knowledge proof instead"*).
- **Never-Collect PII Guardrails**:
  - Locked chips (red/rose) showing `holder_name`, `dob`, `address`, `dob_salt` with lock icons.
- **Actions**:
  - "Publish Presentation Request Now": Instantly calls `useCreateRequest` with the compiled policy.
  - "Customize in Visual Builder": Scrolls to and populates `ManualPolicyBuilder` for manual adjustments.

### 2.2 `AmbiguityQuestionsCard.tsx`

Handles the `422 POLICY_AMBIGUOUS` response from Bedrock Claude:
- Reads `error.details.questions` (array of questions returned by the AI).
- Displays each question with a warning icon and clear explanation.
- Provides interactive quick-add chips to help the user resolve the ambiguity without manual typing (e.g. `+ Accredited MBBS Degree`, `+ Age ≥ 21 years`, `+ Do not reveal PII`).
- Features an edit-and-retry input and button that appends clarifications to the original prompt and re-triggers compilation.

### 2.3 `PolicyPromptTemplates.tsx`

A row of quick-fill prompt chips for judges and evaluators to test various scenarios in 1 click:
1. **Hospital Hiring (Canonical)**:
   *"Verify the candidate holds an accredited MBBS Degree and is at least 21 years old, without revealing their name, date of birth, or home address."*
2. **Tech Company B.Tech**:
   *"Verify the applicant completed an accredited B.Tech Degree with active status, keeping identity PII confidential."*
3. **Ambiguity Test**:
   *"Verify that this person has qualifications and is allowed to work."* (triggers `POLICY_AMBIGUOUS` with questions).

### 2.4 `VerifierPage.tsx` Updates

- Integrates `PolicyPromptTemplates`, `AmbiguityQuestionsCard`, and `CompiledPolicyChips`.
- Tracks compile states: `idle`, `compiling`, `compiled`, `ambiguous`, `error`.
- Handles direct request creation from compiled policy with instant redirect to `/verifier/requests/:requestId`.

---

## 3. Invariants & Acceptance Gates

1. [x] Zero hardcoded credential schemas (mirrors `useCredentialSchemas` and `useEnums`).
2. [x] Friendly display for all Bedrock responses (200 OK, 422 Ambiguous, 502 Offline).
3. [x] Strict TypeScript typing (`ParseOut`, `PresentationPolicy`).
4. [x] Passes `check-hardcoded.sh`, `typecheck`, and `build`.
