// Claude on AWS Bedrock (Bedrock Runtime client). Model id + region + credentials come from config only.
// Not the Mantle client: its endpoint 404s every Claude model for our Bedrock API key; the Runtime client works
// with a cross-region inference profile id (e.g. `global.anthropic.claude-sonnet-4-6`).
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
import { config } from "../config";

const common = { awsRegion: config.AWS_REGION, timeout: config.AI_TIMEOUT_MS, maxRetries: 1 };

// Exactly one credential source: Bedrock API key, else IAM key pair, else the default AWS chain (e.g. the EC2
// instance role). One constructor call per source, because the SDK's option types forbid mixing them.
export const bedrock = config.AWS_BEARER_TOKEN_BEDROCK
  ? new AnthropicBedrock({ ...common, apiKey: config.AWS_BEARER_TOKEN_BEDROCK })
  : config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY
    ? new AnthropicBedrock({
        ...common,
        apiKey: null,
        awsAccessKey: config.AWS_ACCESS_KEY_ID,
        awsSecretKey: config.AWS_SECRET_ACCESS_KEY,
      })
    : new AnthropicBedrock({ ...common, apiKey: null });

/** Smallest real request that proves the model is reachable with our credentials. */
export async function pingModel(): Promise<void> {
  await bedrock.messages.create({
    model: config.BEDROCK_MODEL_ID,
    max_tokens: 16,
    messages: [{ role: "user", content: "Reply with: ok" }],
  });
}
