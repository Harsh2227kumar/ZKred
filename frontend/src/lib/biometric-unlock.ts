// frontend/src/lib/biometric-unlock.ts
// Biometric unlock for the on-device wallet copy: a WebAuthn platform passkey with the PRF extension. The device's
// authenticator releases a stable 32-byte secret only after a fingerprint / face / device-PIN check; zk-core turns it
// into the AES key that seals the wallet (walletCrypto.sealWithDeviceSecret). Biometric data never leaves the device
// and nothing here talks to the server: the challenge is never verified by anyone, the security is the PRF secret.
// The only file that calls navigator.credentials.

export type BiometricErrorCode = 'UNSUPPORTED' | 'NO_PRF' | 'CANCELLED' | 'FAILED';

export class BiometricError extends Error {
  code: BiometricErrorCode;
  constructor(code: BiometricErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'BiometricError';
  }
}

export interface BiometricEnrollment {
  credentialId: Uint8Array<ArrayBuffer>;
  prfSalt: Uint8Array<ArrayBuffer>;
  secret: Uint8Array<ArrayBuffer>;
}

const PRF_SALT_BYTES = 32;
const CHALLENGE_BYTES = 32;
const USER_ID_BYTES = 16;

const random = (n: number): Uint8Array<ArrayBuffer> => crypto.getRandomValues(new Uint8Array(n));

/** True if this browser has a user-verifying platform authenticator (Touch ID, Windows Hello, Android biometrics). */
export async function biometricSupported(): Promise<boolean> {
  if (!window.isSecureContext || typeof PublicKeyCredential === 'undefined') return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function toBiometricError(err: unknown): BiometricError {
  if (err instanceof BiometricError) return err;
  if (err instanceof DOMException && err.name === 'NotAllowedError') {
    return new BiometricError('CANCELLED', 'The biometric check was cancelled or timed out.');
  }
  if (err instanceof DOMException && err.name === 'NotSupportedError') {
    return new BiometricError('UNSUPPORTED', 'This browser cannot create a device passkey.');
  }
  return new BiometricError('FAILED', err instanceof Error ? err.message : 'The biometric check failed.');
}

function prfSecret(cred: PublicKeyCredential): Uint8Array<ArrayBuffer> | null {
  const first = cred.getClientExtensionResults().prf?.results?.first;
  if (!first) return null;
  return ArrayBuffer.isView(first)
    ? new Uint8Array(first.buffer.slice(first.byteOffset, first.byteOffset + first.byteLength))
    : new Uint8Array(first.slice(0));
}

const noPrf = () =>
  new BiometricError(
    'NO_PRF',
    "This device's authenticator can't release an encryption secret (WebAuthn PRF), so biometric lock isn't available here.",
  );

/** Asks the authenticator for the PRF secret of an enrolled passkey (prompts for the biometric / device PIN). */
export async function biometricSecret(credentialId: Uint8Array<ArrayBuffer>, prfSalt: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  let cred: PublicKeyCredential | null;
  try {
    cred = (await navigator.credentials.get({
      publicKey: {
        challenge: random(CHALLENGE_BYTES),
        allowCredentials: [{ type: 'public-key', id: credentialId }],
        userVerification: 'required',
        extensions: { prf: { eval: { first: prfSalt } } },
      },
    })) as PublicKeyCredential | null;
  } catch (err) {
    throw toBiometricError(err);
  }
  if (!cred) throw new BiometricError('CANCELLED', 'The biometric check was cancelled.');
  const secret = prfSecret(cred);
  if (!secret) throw noPrf();
  return secret;
}

/** Creates the device passkey and returns its PRF secret. Throws NO_PRF where the authenticator lacks PRF. */
export async function enrollBiometric(displayName: string): Promise<BiometricEnrollment> {
  if (!(await biometricSupported())) throw new BiometricError('UNSUPPORTED', 'No fingerprint, face or device-PIN unlock on this device.');
  const prfSalt = random(PRF_SALT_BYTES);
  let cred: PublicKeyCredential | null;
  try {
    cred = (await navigator.credentials.create({
      publicKey: {
        rp: { name: 'ZKred Wallet' },
        user: { id: random(USER_ID_BYTES), name: displayName, displayName },
        challenge: random(CHALLENGE_BYTES),
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        extensions: { prf: { eval: { first: prfSalt } } },
      },
    })) as PublicKeyCredential | null;
  } catch (err) {
    throw toBiometricError(err);
  }
  if (!cred) throw new BiometricError('CANCELLED', 'The biometric check was cancelled.');
  const credentialId = new Uint8Array(cred.rawId);
  // Some authenticators only evaluate PRF on get(): fetch it with one more prompt when it is enabled but not returned.
  const secret = prfSecret(cred);
  if (secret) return { credentialId, prfSalt, secret };
  if (!cred.getClientExtensionResults().prf?.enabled) throw noPrf();
  return { credentialId, prfSalt, secret: await biometricSecret(credentialId, prfSalt) };
}
