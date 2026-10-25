# V0-S5 Implementation: AWS Bedrock Claude Sonnet Configuration

## 1. AWS Bedrock Setup Walkthrough

### Step 1: Enable Claude 3.5 Sonnet Model Access
1. Open AWS Management Console &rarr; Go to **Amazon Bedrock**.
2. Set region to `us-east-1` (N. Virginia) or `us-west-2` (Oregon).
3. In the left navigation pane, choose **Bedrock configurations** &rarr; **Model access**.
4. Click **Enable specific models** (or **Modify model access**).
5. Locate **Anthropic**:
   - Check `Claude 3.5 Sonnet` / `Claude 3.5 Sonnet v2`.
6. Submit and confirm that status shows **Access granted**.

---

### Step 2: Configure Authentication

#### Option A: IAM Instance Role (Recommended for EC2)
1. Go to **AWS IAM** &rarr; **Roles** &rarr; **Create role**.
2. Select **AWS service** &rarr; Use case: **EC2**.
3. Create inline policy named `ZKredBedrockInvokePolicy`:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "AllowBedrockInvokeModel",
         "Effect": "Allow",
         "Action": [
           "bedrock:InvokeModel",
           "bedrock:InvokeModelWithResponseStream"
         ],
         "Resource": [
           "arn:aws:bedrock:*::foundation-model/*",
           "arn:aws:bedrock:*:*:inference-profile/*"
         ]
       }
     ]
   }
   ```
4. Name the role `ZKredEC2BedrockRole` and save.
5. In EC2 Console &rarr; Select your instance &rarr; **Actions** &rarr; **Security** &rarr; **Modify IAM role** &rarr; Attach `ZKredEC2BedrockRole`.
6. With this role attached, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `.env` are left empty! The AWS SDK automatically retrieves temporary credentials from the EC2 instance metadata service (IMDSv2).

#### Option B: IAM User Access Key (For Local Development)
1. In **AWS IAM** &rarr; **Users** &rarr; **Create user** (e.g. `zkred-backend-dev`).
2. Attach the `ZKredBedrockInvokePolicy` above.
3. Under **Security credentials** &rarr; **Create access key** &rarr; Copy:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

---

## 2. Environment Configuration (`.env`)

Add the confirmed credentials and model identifiers to `.env` (never commit this file):

```env
# AWS Region where Bedrock model access was granted
AWS_REGION=us-east-1

# Recommended inference profile ID for Claude 3.5 Sonnet v2
BEDROCK_MODEL_ID=us.anthropic.claude-3-5-sonnet-20241022-v2:0

# IAM User Credentials (leave empty if using EC2 instance role)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Operational Limits
AI_TIMEOUT_MS=30000
AI_MAX_TOKENS=4000
AI_HEALTH_TTL_MS=300000
```

---

## 3. How the Backend Uses Bedrock (`backend/src/ai/bedrock.ts`)

The backend initializes the Anthropic SDK client via Bedrock Runtime:

```typescript
export const bedrock = new AnthropicBedrock({
  awsRegion: config.AWS_REGION,
  ...(config.AWS_BEARER_TOKEN_BEDROCK ? { apiKey: config.AWS_BEARER_TOKEN_BEDROCK } : { apiKey: null }),
  ...(config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY
    ? { awsAccessKey: config.AWS_ACCESS_KEY_ID, awsSecretKey: config.AWS_SECRET_ACCESS_KEY }
    : {}),
  timeout: config.AI_TIMEOUT_MS,
  maxRetries: 1,
});
```

And health is checked via `pingModel()`:
```typescript
export async function pingModel(): Promise<void> {
  await bedrock.messages.create({
    model: config.BEDROCK_MODEL_ID,
    max_tokens: 16,
    messages: [{ role: "user", content: "Reply with: ok" }],
  });
}
```

---

## 4. Verification

1. Start backend or run health check:
   ```bash
   pnpm --filter backend start
   ```
2. Request health endpoint:
   ```bash
   curl -s http://localhost:8080/api/v1/health | jq .
   ```
3. Expected Output:
   ```json
   {
     "status": "ok",
     "db": "ok",
     "chain": "ok",
     "ai": "ok",
     "version": "0.1.0"
   }
   ```
4. Run `bash scripts/check-hardcoded.sh` to ensure no keys or tokens were stored in code.
