import { createPublicKey, generateKeyPairSync } from "node:crypto";
import { pathToFileURL } from "node:url";
import { didFromPublicKey, signRoomMessage } from "../src/technocore.mjs";
import { auditExport, canonicalJson, inspectFlopRequest } from "../src/flop.mjs";

// Synthetic, in-memory evidence only. No production key, remote call or payment.
export function demoInputs() {
  const payer = generateKeyPairSync("ed25519");
  const payee = generateKeyPairSync("ed25519");
  const expectedTerms = {
    contract: `0x${"11".repeat(32)}`, lock: "hash", statement: `0x${"22".repeat(32)}`,
    amount: "1000000000000000", asset: "FLOP",
    payer: didFromPublicKey(createPublicKey(payer.privateKey)),
    payee: didFromPublicKey(payee.publicKey),
    claimByMs: 1_800_000_000_000, refundAfterMs: 1_800_000_060_000,
  };
  const trust = { network: "devnet", rpcUrl: "wss://rpc.devnet.flop.network",
    expectedGenesisHash: `0x${"33".repeat(32)}`, blockTimeMs: 1000, refundMarginBlocks: 30 };
  const ref = { v: 1, network: trust.network, genesis: trust.expectedGenesisHash,
    escrow: `0x${"44".repeat(32)}`, anchor: `0x${"55".repeat(32)}`,
    blockTimeMs: trust.blockTimeMs, refundMarginBlocks: trust.refundMarginBlocks,
    terms: expectedTerms };
  const request = { reference: `flop1.${Buffer.from(canonicalJson(ref)).toString("base64url")}`,
    expectedTerms, trust };
  const room = "evidence-demo";
  const nonce = "1780000000000000001";
  const signed = signRoomMessage(payer.privateKey, room, nonce, "Synthetic FLOP evidence review.");
  const row = { seq: 1, ts: "2026-10-27T00:00:00.000Z", from: expectedTerms.payer,
    text: signed.text, nonce, sig: signed.signature };
  return { request, room, row, jsonl: `${JSON.stringify(row)}\n` };
}

export function runDemo() {
  const { request, room, jsonl } = demoInputs();
  const review = inspectFlopRequest(request);
  const { report } = auditExport(room, jsonl);
  if (!report.ok || report.verifiedSignatures !== 1 || review.checks.chainLockVerified !== false) {
    throw new Error("Demo checks failed.");
  }
  return { demonstrationOnly: true, networkRequests: 0,
    verifiedSignedRecords: report.verifiedSignatures,
    nineteenDigitNoncePreserved: true,
    checks: review.checks,
    conclusion: "Native reference binding and signature checks pass; no chain execution or work delivery is claimed." };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(runDemo(), null, 2));
}
