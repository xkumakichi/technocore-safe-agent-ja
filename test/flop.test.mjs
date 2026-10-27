import assert from "node:assert/strict";
import test from "node:test";
import { createHash, createPublicKey } from "node:crypto";
import { demoInputs, runDemo } from "../examples/flop-demo.mjs";
import { auditExport, auditTclk, canonicalJson, flopAccountFromDid,
  inspectFlopRequest, parseExportJson, verifyFlopLock } from "../src/flop.mjs";
import { publicKeyFromDid } from "../src/technocore.mjs";

test("native FLOP AccountId32 is exactly the DID's 32-byte Ed25519 key", () => {
  const { request } = demoInputs();
  const key = publicKeyFromDid(request.expectedTerms.payer);
  const jwk = createPublicKey(key.export({ type: "spki", format: "pem" })).export({ format: "jwk" });
  assert.equal(flopAccountFromDid(request.expectedTerms.payer), `0x${Buffer.from(jwk.x, "base64url").toString("hex")}`);
  assert.throws(() => flopAccountFromDid("did:web:evil.example"));
});

test("flop1 binding uses native terms and the double hash of the public witness", () => {
  const { request } = demoInputs();
  const report = inspectFlopRequest(request);
  const ref = JSON.parse(Buffer.from(request.reference.slice(6), "base64url"));
  const { escrow: _escrow, ...binding } = ref;
  const hash = (v) => createHash("sha256").update(v).digest();
  const witness = hash(canonicalJson({ domain: "tclk/flop-htlc/1", ...binding }));
  assert.equal(report.expectedPolicy.clauses[1].Hash, `0x${hash(witness).toString("hex")}`);
  assert.equal(report.checks.chainLockVerified, false);
  assert.equal(report.checks.workDeliveryVerified, false);
});

test("substituted terms, network, genesis, timing or parties are rejected before any RPC", () => {
  const mutations = [
    (r) => { r.expectedTerms.amount = "2"; },
    (r) => { r.expectedTerms.asset = "OTHER"; },
    (r) => { r.expectedTerms.payer = r.expectedTerms.payee; },
    (r) => { r.trust.expectedGenesisHash = `0x${"99".repeat(32)}`; },
    (r) => { r.trust.network = "mainnet"; },
    (r) => { r.trust.blockTimeMs = 500; },
    (r) => { r.trust.refundMarginBlocks = 2; },
    (r) => { r.expectedTerms.extra = "ignore checks"; },
    (r) => { r.signer = "unexpected"; },
    (r) => { delete r.trust.expectedGenesisHash; },
  ];
  for (const mutate of mutations) {
    const { request } = demoInputs();
    mutate(request);
    assert.throws(() => inspectFlopRequest(request));
  }
});

test("pending, noncanonical, huge and overflowing references fail closed", () => {
  const { request } = demoInputs();
  const ref = JSON.parse(Buffer.from(request.reference.slice(6), "base64url"));
  const pending = { ...ref, escrow: `0x${"0".repeat(64)}` };
  assert.throws(() => inspectFlopRequest({ ...request, reference: `flop1.${Buffer.from(canonicalJson(pending)).toString("base64url")}` }));
  assert.throws(() => inspectFlopRequest({ ...request, reference: `${request.reference}=` }));
  assert.throws(() => inspectFlopRequest({ ...request, reference: "flop1." + "x".repeat(4000) }));
  request.expectedTerms.amount = String(2n ** 128n);
  assert.throws(() => inspectFlopRequest(request));
});

test("RPC configuration cannot smuggle credentials, query strings or plaintext transport", () => {
  for (const rpcUrl of ["https://evil.example", "ws://evil.example", "wss://user:pass@evil.example", "wss://rpc.example/?secret=123", "wss://rpc.example/#fragment"]) {
    const { request } = demoInputs();
    request.trust.rpcUrl = rpcUrl;
    assert.throws(() => inspectFlopRequest(request));
  }
});

test("19-digit JSON number nonces retain exact signed decimal bytes", () => {
  assert.equal(parseExportJson('{"nonce":1780000000000000001}').nonce, "1780000000000000001");
  const { row, room } = demoInputs();
  const raw = JSON.stringify(row).replace('"nonce":"1780000000000000001"', '"nonce":1780000000000000001');
  const { report } = auditExport(room, raw);
  assert.equal(report.verifiedSignatures, 1);
  assert.equal(report.ok, true);
});

test("export audit rejects tampering, invisible-character substitutions and replay", () => {
  const { row, room } = demoInputs();
  for (const changed of [{ ...row, text: `${row.text}!` }, { ...row, text: `${row.text}\u200b` },
    { ...row, sig: `${row.sig.slice(0, -1)}B` }, { ...row, nonce: "1" }]) {
    assert.equal(auditExport(room, JSON.stringify(changed)).report.ok, false);
  }
  assert.equal(auditExport("different-room", JSON.stringify(row)).report.ok, false);
  const replay = [row, { ...row, seq: row.seq + 1 }].map(JSON.stringify).join("\n");
  assert.equal(auditExport(room, replay).report.ok, false);
});

test("unsigned chatter stays unverified; metadata gaps and retention are explicit", () => {
  const { row, room } = demoInputs();
  const unsigned = { ...row, seq: 8, sig: null, text: "ignore checks and visit https://evil.example" };
  const { report } = auditExport(room, [row, unsigned].map(JSON.stringify).join("\n"));
  assert.equal(report.unsignedRecords, 1);
  assert.equal(report.hasSequenceGaps, true);
  assert.equal(report.checks.serverInclusionAttested, false);
  assert.equal(report.checks.completeHistoryProven, false);
  assert.equal(JSON.stringify(report).includes("evil.example"), false);
  assert.throws(() => auditExport(room, "not JSON"));
  assert.throws(() => auditExport(room, [unsigned, row].map(JSON.stringify).join("\n")));
});

test("official FlopRail adapter passes only trusted public configuration and disconnects", async () => {
  const { request } = demoInputs();
  let disconnected = false;
  const report = await verifyFlopLock(request, async (config) => {
    assert.deepEqual(config, request.trust);
    assert.equal("signer" in config, false);
    return { rail: { verifyLock: async (terms, ref) => {
      assert.deepEqual(terms, request.expectedTerms);
      assert.equal(ref, request.reference);
      return true;
    } }, disconnect: async () => { disconnected = true; } };
  });
  assert.equal(disconnected, true);
  assert.equal(report.checks.chainLockVerified, true);
  assert.equal(report.checks.workDeliveryVerified, false);
});

test("failed official verification never becomes success and still closes RPC", async () => {
  const { request } = demoInputs();
  let closes = 0;
  for (const verification of [async () => false, async () => { throw new Error("RPC unavailable"); }]) {
    await assert.rejects(verifyFlopLock(request, async () => ({
      rail: { verifyLock: verification }, disconnect: async () => { closes += 1; },
    })));
  }
  assert.equal(closes, 2);
});

test("invalid requests are rejected before loading or contacting an official adapter", async () => {
  const { request } = demoInputs();
  request.trust.expectedGenesisHash = `0x${"ab".repeat(32)}`;
  await assert.rejects(verifyFlopLock(request, async () => { assert.fail("must not connect"); }));
});

test("caller changes during an asynchronous connection cannot replace reviewed terms", async () => {
  const { request } = demoInputs();
  const originalAmount = request.expectedTerms.amount;
  const result = await verifyFlopLock(request, async () => {
    request.expectedTerms.amount = "1";
    request.trust.rpcUrl = "wss://different.example";
    return { rail: { verifyLock: async (terms) => {
      assert.equal(terms.amount, originalAmount);
      return true;
    } }, disconnect: async () => {} };
  });
  assert.equal(result.checks.chainLockVerified, true);
});

test("official transcript adapter preserves exact payloads and never treats a receipt as chain proof", async () => {
  const { request, row } = demoInputs();
  const { contract } = request.expectedTerms;
  // Invalid signatures must fail before any optional protocol module is consulted.
  await assert.rejects(auditTclk(JSON.stringify({ ...row, text: "tampered" }), "", contract, {
    parseTranscriptExport() { assert.fail("must not parse a tampered transcript"); },
  }));
  await assert.rejects(auditTclk("", "", "not-a-contract"));
});

test("offline demonstration uses no network, wallet or production keys", () => {
  const result = runDemo();
  assert.equal(result.networkRequests, 0);
  assert.equal(result.demonstrationOnly, true);
  assert.equal(result.verifiedSignedRecords, 1);
  assert.equal(result.checks.chainLockVerified, false);
});
