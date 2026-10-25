import { describe, expect, it } from "vitest";
import { ZkCoreError, buildPresentation, walletCrypto, type SignedCredential } from "../src";
import { randomHex32, randomText } from "./factories";

const credential = (): SignedCredential => ({
  type: "Degree",
  issuer_did: randomText("did:zkred"),
  key_id: randomHex32(),
  values: { holder_name: randomText("name") },
  signature: randomText("sig"),
});
const passphrase = () => randomText("pass");
const ITER = 1000; // low on purpose: tests only; the real value comes from config

describe("walletCrypto offers", () => {
  it("encrypt → decrypt round-trips a credential for the recipient", async () => {
    const wallet = await walletCrypto.generateWalletKeyPair();
    expect(wallet.privateKeyJwk.kty).toBe("EC");
    const cred = credential();
    const offer = await walletCrypto.encryptOffer(wallet.publicKeyB64, cred);
    expect(offer.ciphertext).not.toContain(cred.values.holder_name);
    expect(await walletCrypto.decryptOffer(wallet.privateKeyJwk, offer)).toEqual(cred);
  });

  it("another wallet or a tampered ciphertext cannot decrypt", async () => {
    const [a, b] = await Promise.all([walletCrypto.generateWalletKeyPair(), walletCrypto.generateWalletKeyPair()]);
    const offer = await walletCrypto.encryptOffer(a.publicKeyB64, credential());
    await expect(walletCrypto.decryptOffer(b.privateKeyJwk, offer)).rejects.toMatchObject({ code: "OFFER_DECRYPT_FAILED" });
    const flipped = { ...offer, ciphertext: (offer.ciphertext[0] === "A" ? "B" : "A") + offer.ciphertext.slice(1) };
    await expect(walletCrypto.decryptOffer(a.privateKeyJwk, flipped)).rejects.toBeInstanceOf(ZkCoreError);
  });

  it("rejects an invalid recipient key", async () => {
    await expect(walletCrypto.encryptOffer("AAAA", credential())).rejects.toMatchObject({ code: "INVALID_PUBLIC_KEY" });
  });
});

describe("walletCrypto backups", () => {
  it("encrypt → decrypt round-trips with the right passphrase", async () => {
    const pass = passphrase();
    const data = { credentials: [credential()] };
    const b = await walletCrypto.encryptBackup(pass, data, ITER);
    expect(b.kdf_iterations).toBe(ITER);
    expect(await walletCrypto.decryptBackup(pass, b)).toEqual(data);
  });

  it("throws BAD_PASSPHRASE on the wrong passphrase", async () => {
    const b = await walletCrypto.encryptBackup(passphrase(), { x: 1 }, ITER);
    await expect(walletCrypto.decryptBackup(passphrase(), b)).rejects.toMatchObject({ code: "BAD_PASSPHRASE" });
  });

  it("rejects non-positive iteration counts", async () => {
    await expect(walletCrypto.encryptBackup(passphrase(), {}, 0)).rejects.toMatchObject({ code: "INVALID_KDF_ITERATIONS" });
  });
});

describe("later-task stubs", () => {
  it("throw NOT_IMPLEMENTED instead of silently succeeding", async () => {
    await expect(buildPresentation({} as never)).rejects.toMatchObject({ code: "NOT_IMPLEMENTED" });
  });
});
