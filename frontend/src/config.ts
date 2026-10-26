// frontend/src/config.ts
// ⚓ Anchor: The ONLY file in the frontend allowed to read import.meta.env (AGENTS.md §2).

export interface FrontendConfig {
  apiBaseUrl: string;
  zkArtifactsBaseUrl: string;
  demoWalletPassphrase?: string;
}

function loadConfig(): FrontendConfig {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const zkArtifactsBaseUrl = import.meta.env.VITE_ZK_ARTIFACTS_BASE_URL;
  const demoWalletPassphrase = import.meta.env.VITE_DEMO_WALLET_PASSPHRASE;

  const missing: string[] = [];
  if (!apiBaseUrl) missing.push('VITE_API_BASE_URL');
  if (!zkArtifactsBaseUrl) missing.push('VITE_ZK_ARTIFACTS_BASE_URL');

  if (missing.length > 0) {
    throw new Error(
      `[ZKred Frontend] Missing required environment variable(s): ${missing.join(', ')}. ` +
      `Check your frontend/.env file.`
    );
  }

  return {
    apiBaseUrl,
    zkArtifactsBaseUrl,
    demoWalletPassphrase,
  };
}

export const config = loadConfig();
