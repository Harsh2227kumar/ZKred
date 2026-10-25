# V0-S5 Plan: AWS Bedrock Model Access & AI Health Integration

## Overview
- **Task ID:** `V0-S5` (per `md/VERSION-PLAN.md`)
- **Owner:** SPARSH
- **Target Output:** AWS Bedrock Claude Sonnet model access configured, credentials wired to backend, and verified via `GET /health` returning `"ai": "ok"`.
- **Done When:** Harsh's `/health` endpoint probe (`pingModel()` via `AnthropicBedrock`) successfully invokes the Claude Sonnet model and returns status `"ok"`.

---

## 1. Scope & Architecture

```
Client / Frontend (UI)
        │
        ▼ GET /api/v1/health
┌───────────────────────────────────────────────┐
│              Backend Service                  │
│                                               │
│  probe(pingModel, AI_TIMEOUT_MS)              │
│       │                                       │
│       ▼ AnthropicBedrock SDK                  │
│  AWS Bedrock Runtime Endpoint                 │
│  (Region: AWS_REGION)                         │
└───────┬───────────────────────────────────────┘
        │
        ▼ (InvokeModel API)
┌───────────────────────────────────────────────┐
│       AWS Bedrock Foundation Models           │
│   Model ID: BEDROCK_MODEL_ID                  │
│   (Claude 3.5 Sonnet Inference Profile)       │
└───────────────────────────────────────────────┘
```

### Impact on the Project
1. **Unlocks Natural Language Policy Parsing (Milestone V1.1-H3 & V1.1-S3)**:
   - Verifiers will be able to type natural language requirements (e.g. *"Doctor registered with Medical Council of India and age over 21"*).
   - Claude Sonnet will parse this into mathematically sound ZK disclosure policies (`PresentationPolicy`).
2. **Completes Gate G0 Backend Health**:
   - The health pulse dot on the frontend Navbar turns solid green only when DB, Chain, and AI all report `"ok"`.
3. **Fail-Closed AI Security Architecture**:
   - Bedrock is invoked exclusively from the backend (`backend/src/ai/bedrock.ts`), never exposing AWS credentials or raw prompts to holder browsers.

---

## 2. Step-by-Step Execution Plan

### Step 1: AWS Bedrock Model Access in AWS Console
- Navigate to Amazon Bedrock Console in the target region (`us-east-1` or `us-west-2`).
- Open **Model access** &rarr; Request access for Anthropic models:
  - `Anthropic Claude 3.5 Sonnet` (or cross-region inference profile `us.anthropic.claude-3-5-sonnet-20241022-v2:0`).
- Wait for the access status to display **Access granted**.

### Step 2: Authentication Strategy (Choose Option A, B, or C)
- **Option A (Recommended for EC2 in V0-S4): IAM Instance Profile**
  - Create IAM Role with policy:
    ```json
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
          "Resource": "*"
        }
      ]
    }
    ```
  - Attach role to EC2 instance. Zero secrets needed in `.env`.
- **Option B: IAM User Access Keys (Local Dev & Testing)**
  - Create IAM User with `AmazonBedrockFullAccess` (or custom `InvokeModel` policy).
  - Generate `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
- **Option C: Bedrock API Key / Bearer Token**
  - Set `AWS_BEARER_TOKEN_BEDROCK`.

### Step 3: Configure Environment Variables
- Add Bedrock variables into `.env`:
  ```env
  AWS_REGION=us-east-1
  BEDROCK_MODEL_ID=us.anthropic.claude-3-5-sonnet-20241022-v2:0
  AWS_ACCESS_KEY_ID=<your-access-key-id>
  AWS_SECRET_ACCESS_KEY=<your-secret-access-key>
  AI_TIMEOUT_MS=30000
  AI_MAX_TOKENS=4000
  AI_HEALTH_TTL_MS=300000
  ```

### Step 4: Verification & Acceptance
- Run health check test:
  - In backend: `pingModel()` sends small 16-token prompt `"Reply with: ok"`.
  - Backend responds with `{ "status": "ok", "db": "ok", "chain": "ok", "ai": "ok" }`.
- Run `bash scripts/check-hardcoded.sh` to ensure no credentials or raw model keys are committed.
