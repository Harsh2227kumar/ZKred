# Technical Implementation Specification: Task V0-S1 (Frontend Scaffold)

**Target:** `frontend/`  
**Owner:** **SPARSH**  
**Task ID:** **`V0-S1`** ⭐  
**Status:** **PROPOSED SPECIFICATION — AWAITING USER APPROVAL**

---

## 1. Architecture & Directory Hierarchy

```text
frontend/
├── index.html
├── package.json
├── vite.config.ts                  # Vite + @tailwindcss/vite + @ alias
├── tsconfig.app.json               # TypeScript config with paths: { "@/*": ["./src/*"] }
├── .env.example                    # VITE_API_BASE_URL and VITE_ZK_ARTIFACTS_BASE_URL
├── .env                            # Local dev environment
│
└── src/
    ├── main.tsx                    # ReactDOM root mounting App in StrictMode
    ├── App.tsx                     # Top-level Router & QueryClientProvider
    ├── config.ts                   # ⚓ THE ONLY FILE reading import.meta.env
    ├── index.css                   # Tailwind v4 theme tokens & modern dark palette
    │
    ├── api/
    │   ├── client.ts               # openapi-fetch client with toUserMessage error mapper
    │   ├── types.ts                # TypeScript interfaces mirroring CONTRACTS.md
    │   └── queries/
    │       └── meta.ts             # useHealth (15s poll), useChainInfo, useEnums, useCredentialSchemas
    │
    ├── components/
    │   ├── layout/
    │   │   ├── Navbar.tsx          # 4 top-level sections + live health pulse dot
    │   │   └── Layout.tsx          # Sticky header, outlet container, responsive footer
    │   └── common/
    │       ├── Loading.tsx         # Spinner / skeleton animation
    │       ├── EmptyState.tsx      # Clean empty state graphics with call-to-action
    │       ├── ErrorState.tsx      # Error card with retry trigger using toUserMessage
    │       ├── TxLink.tsx          # Dynamic BaseScan explorer link using /meta/chain template
    │       └── Hex.tsx             # Truncated hex viewer with one-click copy badge
    │
    └── features/
        ├── home/pages/HomePage.tsx
        ├── issuer/pages/
        │   ├── IssuerListPage.tsx      # Issuer list + admin authentication modal
        │   └── IssuerDetailPage.tsx    # Tabs: Keys, Issue, Issued, Batches
        ├── wallet/pages/
        │   ├── WalletPage.tsx          # Wallet setup, inbox, credential list
        │   └── WalletRespondPage.tsx   # 3-tier consent transparency (revealed / proven / private)
        ├── verifier/pages/
        │   ├── VerifierPage.tsx        # Natural language request prompt + requests feed
        │   └── RequestDetailPage.tsx   # 4-node evaluation chain visualizer
        └── attack/pages/
            └── AttackConsolePage.tsx   # Red-team attack stepper + comparative live metrics
```

---

## 2. Technical Standards & Code Specifications

### A. Strict Configuration Singleton (`src/config.ts`)
```typescript
// frontend/src/config.ts
// ⚓ Anchor: The ONLY file in the frontend allowed to read import.meta.env (AGENTS.md §2).

export interface FrontendConfig {
  apiBaseUrl: string;
  zkArtifactsBaseUrl: string;
}

function loadConfig(): FrontendConfig {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const zkArtifactsBaseUrl = import.meta.env.VITE_ZK_ARTIFACTS_BASE_URL;

  const missing: string[] = [];
  if (!apiBaseUrl) missing.push('VITE_API_BASE_URL');
  if (!zkArtifactsBaseUrl) missing.push('VITE_ZK_ARTIFACTS_BASE_URL');

  if (missing.length > 0) {
    throw new Error(
      `[ZKred Frontend] Missing required environment variable(s): ${missing.join(', ')}. ` +
      `Check your frontend/.env file.`
    );
  }

  return { apiBaseUrl, zkArtifactsBaseUrl };
}

export const config = loadConfig();
```

### B. Standardized API Error Mapper (`src/api/client.ts`)
Translates every HTTP error code from `CONTRACTS.md §2` into intuitive user messages:
- `NONCE_USED`: Presentation request already verified and cannot be replayed.
- `REQUEST_EXPIRED`: The presentation request has expired.
- `AI_UNAVAILABLE`: Bedrock Claude unavailable; fall back to manual policy builder.
- `AI_BAD_OUTPUT`: AI generated malformed policy format.
- `POLICY_AMBIGUOUS`: Verifier requirements ambiguous; prompts user for clarification.
- `CHAIN_UNAVAILABLE`: Base Sepolia RPC unreachable; fails closed.
- `CHAIN_TX_FAILED`: On-chain transaction reverted.
- `NOT_IMPLEMENTED`: Scheduled for upcoming milestone.

### C. Live Health Indicator & Meta Hooks (`src/api/queries/meta.ts`)
- **`useHealth()`:** Polled every 15,000 ms via TanStack Query.
  - Green pulse: All systems operational (`db: ok`, `chain: ok`, `ai: ok`).
  - Yellow pulse: Degraded subsystem.
  - Red pulse: Backend unreachable.
- **`useChainInfo()`:** Caches explorer URL template, chain ID, and breach window.
- **`useEnums()`:** Provides dropdown options without hardcoded client arrays.
- **`useCredentialSchemas()`:** Dynamically dictates form fields for credential issuance.

### D. Zero Hardcoded Data Rules Enforced
1. **No Mock Arrays:** Zero `const MOCK_DATA = [...]` in components.
2. **Dynamic Explorer URLs:** `<TxLink/>` builds URLs using `chainInfo.explorer_tx_url_template.replace('{tx}', hash)`.
3. **Fail-Closed States:** Unfinished endpoints return `501 Not Implemented`, rendering `<ErrorState/>` with helpful explanation.

---

## 3. Verification Protocol

1. `pnpm --filter frontend build` must exit with `code 0`.
2. `bash scripts/check-hardcoded.sh` must return `check-hardcoded: OK`.
3. `git diff --stat` must show zero files modified outside `frontend/` and `md/progress/SPARSH-PROGRESS.md`.
