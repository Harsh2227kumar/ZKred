import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

const KeyStatus = { None: 0n, Active: 1n, Rotated: 2n, Compromised: 3n } as const;
const id = (label: string) => ethers.id(label); // keccak256 → bytes32

async function deployAll() {
  const [accreditor, governance, otherGov, attacker] = await ethers.getSigners();
  const issuerRegistry = await ethers.deployContract("IssuerRegistry");
  const anchorRegistry = await ethers.deployContract("AnchorRegistry", [await issuerRegistry.getAddress()]);
  const statusRegistry = await ethers.deployContract("StatusRegistry", [await issuerRegistry.getAddress()]);

  const issuerId = id("did:zkred:iiit-nagpur");
  const keyId = id("key-1");
  await issuerRegistry.registerIssuer(issuerId, "did:zkred:iiit-nagpur", governance.address);
  await issuerRegistry.connect(governance).addKey(issuerId, keyId, id("pubkey-1"));

  return { issuerRegistry, anchorRegistry, statusRegistry, accreditor, governance, otherGov, attacker, issuerId, keyId };
}

describe("IssuerRegistry", () => {
  it("registers + accredits issuers (accreditor only)", async () => {
    const { issuerRegistry, governance, attacker, issuerId } = await networkHelpers.loadFixture(deployAll);
    const [did, gov, accredited] = await issuerRegistry.getIssuer(issuerId);
    expect(did).to.equal("did:zkred:iiit-nagpur");
    expect(gov).to.equal(governance.address);
    expect(accredited).to.equal(true);

    await expect(
      issuerRegistry.connect(attacker).registerIssuer(id("x"), "did:zkred:x", attacker.address),
    ).to.be.revertedWithCustomError(issuerRegistry, "NotAccreditor");
    await expect(
      issuerRegistry.registerIssuer(issuerId, "did:zkred:dup", governance.address),
    ).to.be.revertedWithCustomError(issuerRegistry, "IssuerExists");

    await expect(issuerRegistry.setAccredited(issuerId, false))
      .to.emit(issuerRegistry, "IssuerAccreditationChanged")
      .withArgs(issuerId, false);
    expect((await issuerRegistry.getIssuer(issuerId))[2]).to.equal(false);
  });

  it("only governance manages keys; the BBS key holder has no on-chain power", async () => {
    const { issuerRegistry, attacker, issuerId, keyId } = await networkHelpers.loadFixture(deployAll);
    const [kIssuer, pubHash, activeFrom, status] = await issuerRegistry.getKey(keyId);
    expect(kIssuer).to.equal(issuerId);
    expect(pubHash).to.equal(id("pubkey-1"));
    expect(activeFrom).to.be.greaterThan(0n);
    expect(status).to.equal(KeyStatus.Active);

    await expect(
      issuerRegistry.connect(attacker).addKey(issuerId, id("key-x"), id("pk-x")),
    ).to.be.revertedWithCustomError(issuerRegistry, "NotGovernance");
    await expect(
      issuerRegistry.connect(attacker).markCompromised(issuerId, keyId, 0),
    ).to.be.revertedWithCustomError(issuerRegistry, "NotGovernance");
  });

  it("rotates keys: old → Rotated, new → Active", async () => {
    const { issuerRegistry, governance, issuerId, keyId } = await networkHelpers.loadFixture(deployAll);
    const newKey = id("key-2");
    await expect(issuerRegistry.connect(governance).rotateKey(issuerId, keyId, newKey, id("pubkey-2")))
      .to.emit(issuerRegistry, "KeyRotated")
      .withArgs(issuerId, keyId, newKey);
    expect((await issuerRegistry.getKey(keyId))[3]).to.equal(KeyStatus.Rotated);
    expect((await issuerRegistry.getKey(newKey))[3]).to.equal(KeyStatus.Active);
    expect(await issuerRegistry.isActiveKeyOf(issuerId, newKey)).to.equal(true);
    expect(await issuerRegistry.isActiveKeyOf(issuerId, keyId)).to.equal(false);
  });

  it("marks a key compromised with a past cutoff; the cutoff can only move earlier", async () => {
    const { issuerRegistry, governance, issuerId, keyId } = await networkHelpers.loadFixture(deployAll);
    const now = BigInt(await networkHelpers.time.latest());
    const window = 48n * 3600n;

    await expect(
      issuerRegistry.connect(governance).markCompromised(issuerId, keyId, now + 1000n),
    ).to.be.revertedWithCustomError(issuerRegistry, "CutoffInFuture");

    await expect(issuerRegistry.connect(governance).markCompromised(issuerId, keyId, now - window))
      .to.emit(issuerRegistry, "KeyCompromised")
      .withArgs(issuerId, keyId, now - window);
    const k = await issuerRegistry.getKey(keyId);
    expect(k[3]).to.equal(KeyStatus.Compromised);
    expect(k[4]).to.equal(now - window);

    await expect(
      issuerRegistry.connect(governance).markCompromised(issuerId, keyId, now - window + 10n),
    ).to.be.revertedWithCustomError(issuerRegistry, "CutoffNotEarlier");
    await issuerRegistry.connect(governance).markCompromised(issuerId, keyId, now - window - 10n);

    // Rotating away from a compromised key keeps it Compromised.
    await issuerRegistry.connect(governance).rotateKey(issuerId, keyId, id("key-2"), id("pubkey-2"));
    expect((await issuerRegistry.getKey(keyId))[3]).to.equal(KeyStatus.Compromised);
  });

  it("rejects keys owned by another issuer", async () => {
    const { issuerRegistry, otherGov, keyId } = await networkHelpers.loadFixture(deployAll);
    const other = id("did:zkred:other");
    await issuerRegistry.registerIssuer(other, "did:zkred:other", otherGov.address);
    await expect(
      issuerRegistry.connect(otherGov).markCompromised(other, keyId, 0),
    ).to.be.revertedWithCustomError(issuerRegistry, "KeyNotOwnedByIssuer");
  });
});

describe("AnchorRegistry", () => {
  it("anchors a batch from governance with the block time as issuance time", async () => {
    const { anchorRegistry, governance, issuerId, keyId } = await networkHelpers.loadFixture(deployAll);
    const batchId = id("batch-1");
    const root = id("root-1");
    await expect(anchorRegistry.connect(governance).anchor(batchId, issuerId, keyId, root)).to.emit(
      anchorRegistry,
      "BatchAnchored",
    );
    const [r, iss, k, anchoredAt] = await anchorRegistry.getAnchor(batchId);
    expect([r, iss, k]).to.deep.equal([root, issuerId, keyId]);
    expect(anchoredAt).to.equal(BigInt(await networkHelpers.time.latest()));

    await expect(
      anchorRegistry.connect(governance).anchor(batchId, issuerId, keyId, id("root-2")),
    ).to.be.revertedWithCustomError(anchorRegistry, "BatchAlreadyAnchored");
  });

  it("refuses anchors from non-governance (a stolen BBS key is not enough)", async () => {
    const { anchorRegistry, attacker, issuerId, keyId } = await networkHelpers.loadFixture(deployAll);
    await expect(
      anchorRegistry.connect(attacker).anchor(id("b"), issuerId, keyId, id("r")),
    ).to.be.revertedWithCustomError(anchorRegistry, "NotGovernance");
  });

  it("refuses anchors under a compromised or rotated key", async () => {
    const { issuerRegistry, anchorRegistry, governance, issuerId, keyId } = await networkHelpers.loadFixture(deployAll);
    const now = BigInt(await networkHelpers.time.latest());
    await issuerRegistry.connect(governance).markCompromised(issuerId, keyId, now - 60n);
    await expect(
      anchorRegistry.connect(governance).anchor(id("b"), issuerId, keyId, id("r")),
    ).to.be.revertedWithCustomError(anchorRegistry, "KeyNotActive");
  });

  it("breach scenario: legacy anchor is before the cutoff, in-window anchor is not", async () => {
    const { issuerRegistry, anchorRegistry, governance, issuerId, keyId } = await networkHelpers.loadFixture(deployAll);
    const window = 48n * 3600n;

    await anchorRegistry.connect(governance).anchor(id("legacy"), issuerId, keyId, id("root-legacy"));
    await networkHelpers.time.increase(72 * 3600); // 3 days later…
    await anchorRegistry.connect(governance).anchor(id("in-window"), issuerId, keyId, id("root-forged"));
    await networkHelpers.time.increase(3600);

    const now = BigInt(await networkHelpers.time.latest());
    await issuerRegistry.connect(governance).markCompromised(issuerId, keyId, now - window);
    const cutoff = (await issuerRegistry.getKey(keyId))[4];

    const legacyAt = (await anchorRegistry.getAnchor(id("legacy")))[3];
    const inWindowAt = (await anchorRegistry.getAnchor(id("in-window")))[3];
    expect(legacyAt < cutoff).to.equal(true); // stays valid
    expect(inWindowAt < cutoff).to.equal(false); // isolated
  });
});

describe("StatusRegistry", () => {
  it("pins list hashes from governance and binds a list to its issuer", async () => {
    const { issuerRegistry, statusRegistry, governance, otherGov, attacker, issuerId } =
      await networkHelpers.loadFixture(deployAll);
    const listId = id("list-1");
    await expect(statusRegistry.connect(governance).setListHash(issuerId, listId, id("h1")))
      .to.emit(statusRegistry, "StatusListUpdated")
      .withArgs(issuerId, listId, id("h1"));
    await statusRegistry.connect(governance).setListHash(issuerId, listId, id("h2"));
    const [iss, hash] = await statusRegistry.getListHash(listId);
    expect(iss).to.equal(issuerId);
    expect(hash).to.equal(id("h2"));

    await expect(
      statusRegistry.connect(attacker).setListHash(issuerId, listId, id("evil")),
    ).to.be.revertedWithCustomError(statusRegistry, "NotGovernance");

    const other = id("did:zkred:other");
    await issuerRegistry.registerIssuer(other, "did:zkred:other", otherGov.address);
    await expect(
      statusRegistry.connect(otherGov).setListHash(other, listId, id("evil")),
    ).to.be.revertedWithCustomError(statusRegistry, "ListOwnedByAnotherIssuer");

    await expect(statusRegistry.getListHash(id("missing"))).to.be.revertedWithCustomError(
      statusRegistry,
      "UnknownList",
    );
  });
});
