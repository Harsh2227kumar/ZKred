// V1.3-H1 demo: the true 48-hour compromise window, on chain time. Replays a breach on a simulated chain:
// a batch anchored ~4 days before the report keeps validating (legacy), one anchored inside the last 48 h is
// invalidated (needs reissue). Verdicts are computed with the same rule the backend uses (core/breach.ts) and
// asserted, so the demo cannot silently regress. Time travel only on simulated/local networks, never live.
//   pnpm --filter contracts replay48h
//   pnpm --filter contracts exec hardhat run --network localhost scripts/replay48h.ts   (against `contracts node`)
import { network } from "hardhat";

const LIVE_NETWORKS = new Set(["baseSepolia", "mainnet"]);
const HOUR = 3600;

const { ethers, networkName } = await network.create();
if (LIVE_NETWORKS.has(networkName)) {
  throw new Error(`refusing to time-travel the live network "${networkName}" — run without --network or on localhost`);
}

const provider = ethers.provider;
const latest = async () => Number((await provider.getBlock("latest"))!.timestamp);
const setNextBlockTimestamp = async (seconds: number) => {
  await provider.send("evm_setNextBlockTimestamp", [seconds]);
};
const iso = (seconds: number) => new Date(seconds * 1000).toISOString().replace(".000Z", "Z");

const [accreditor, governance] = await ethers.getSigners();
const issuerRegistry = await ethers.deployContract("IssuerRegistry", accreditor);
const anchorRegistry = await ethers.deployContract("AnchorRegistry", [await issuerRegistry.getAddress()]);

const issuerId = ethers.id("did:zkred:demo-university");
const keyId = ethers.id("demo-key-epoch-1");
await issuerRegistry.registerIssuer(issuerId, "did:zkred:demo-university", governance.address);
await issuerRegistry.connect(governance).addKey(issuerId, keyId, ethers.id("bbs-public-key"));

const t0 = await latest();

// ---- the breach timeline ---------------------------------------------------
// Batch A: anchored 10 s after t0. Batch B: anchored 72 h later. Breach reported 96 h after t0 with the
// standard 48 h window, so the cutoff lands at t0 + 48 h — 62 h after A, 24 h before B.
const anchorBatch = async (batchId: string, label: string, atSeconds: number) => {
  await setNextBlockTimestamp(atSeconds);
  await (await anchorRegistry.connect(governance).anchor(ethers.id(batchId), issuerId, keyId, ethers.id(`root-${label}`))).wait();
  return atSeconds;
};

const anchorA = await anchorBatch("batch-A", "a", t0 + 10);
const anchorB = await anchorBatch("batch-B", "b", t0 + 72 * HOUR);

const reportAt = t0 + 96 * HOUR;
const compromisedFrom = reportAt - 48 * HOUR;
await setNextBlockTimestamp(reportAt);
await (await issuerRegistry.connect(governance).markCompromised(issuerId, keyId, compromisedFrom)).wait();

// ---- read it back and judge (same rule as backend/src/core/breach.ts verdictFor) ----
const [, , , status, onchainCutoff] = await issuerRegistry.getKey(keyId);
const anchoredAtOf = async (batchId: string) => Number((await anchorRegistry.getAnchor(ethers.id(batchId)))[3]);
const verdictFor = (anchoredAt: number) =>
  anchoredAt < compromisedFrom ? "legacy_valid" : "in_window_needs_reissue";

const rows = [
  { batch: "batch-A", anchored_at: iso(anchorA), hours_before_report: (reportAt - anchorA) / HOUR, verdict: verdictFor(anchorA) },
  { batch: "batch-B", anchored_at: iso(anchorB), hours_before_report: (reportAt - anchorB) / HOUR, verdict: verdictFor(anchorB) },
];
console.log(`\nBreach replayed on "${networkName}" — key ${keyId.slice(0, 10)}… reported compromised at ${iso(reportAt)}`);
console.log(`Cutoff (compromisedFrom): ${iso(compromisedFrom)} = report time − 48 h window\n`);
console.table(rows);

// The demo's claims, asserted: the key is compromised with exactly the computed cutoff, and the two
// batches fall on opposite sides of it.
if (status !== 3n) throw new Error(`key status is ${status}, expected Compromised (3)`);
if (Number(onchainCutoff) !== compromisedFrom) throw new Error(`on-chain cutoff ${onchainCutoff} ≠ ${compromisedFrom}`);
if (rows[0]!.verdict !== "legacy_valid" || rows[1]!.verdict !== "in_window_needs_reissue") {
  throw new Error("verdicts do not match the 48 h window story");
}

console.log(
  [
    "",
    "Why this is the pitch line (“chain time, not claimed time”):",
    "  • The issuance time is the anchor block's timestamp — written by the chain, impossible to backdate.",
    "  • Honest holders whose credentials were issued before the cutoff keep working: only the last",
    `    48 h of issuance (${iso(compromisedFrom)} → ${iso(reportAt)}) is invalidated, so a breach never`,
    "    revokes everyone.",
    "  • Holders in the window refresh via POST /issuers/{id}/reissue; forgeries minted in the window",
    "    can never be laundered, because their batches anchor after the cutoff too.",
  ].join("\n"),
);
