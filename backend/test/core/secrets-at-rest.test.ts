import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { openSecret, sealSecret } from "../../src/core/secrets-at-rest";

const secret = () => new Uint8Array(randomBytes(32));

describe("secrets at rest (AES-256-GCM)", () => {
  it("round-trips and never stores the plaintext", () => {
    const plain = secret();
    const sealed = sealSecret("bbs_secret_key", "key-a", plain);
    expect(sealed).not.toContain(Buffer.from(plain).toString("base64url"));
    expect(openSecret("bbs_secret_key", "key-a", sealed)).toEqual(plain);
  });

  it("uses a fresh IV every time", () => {
    const plain = secret();
    expect(sealSecret("governance_key", "did", plain)).not.toBe(sealSecret("governance_key", "did", plain));
  });

  it("refuses a ciphertext moved to another row (context is bound as AAD)", () => {
    const sealed = sealSecret("bbs_secret_key", "key-a", secret());
    expect(() => openSecret("bbs_secret_key", "key-b", sealed)).toThrow();
  });

  it("refuses to open a governance key with the BBS key secret (separate keys per purpose)", () => {
    const sealed = sealSecret("governance_key", "did", secret());
    expect(() => openSecret("bbs_secret_key", "did", sealed)).toThrow();
  });

  it("detects tampering", () => {
    const [v, iv, ct, tag] = sealSecret("bbs_secret_key", "key-a", secret()).split(".");
    const flipped = Buffer.from(ct!, "base64url");
    flipped[0] = flipped[0]! ^ 1;
    expect(() => openSecret("bbs_secret_key", "key-a", [v, iv, flipped.toString("base64url"), tag].join("."))).toThrow();
    expect(() => openSecret("bbs_secret_key", "key-a", "v1.not-enough-parts")).toThrow();
  });
});
