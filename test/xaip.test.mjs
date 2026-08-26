import assert from "node:assert/strict";
import test from "node:test";
import { generateEncryptedIdentity, loadEncryptedIdentity, signRoomMessage } from "../src/technocore.mjs";
import {
  canonicalize,
  createTechnocoreXaipArtifact,
  verifyTechnocoreXaipArtifact,
  xaipHash,
} from "../src/xaip.mjs";

function fixture() {
  const generated = generateEncryptedIdentity("correct horse battery staple");
  const identity = loadEncryptedIdentity(generated.encryptedPem, "correct horse battery staple");
  const nonce = "1787716000000";
  const signed = signRoomMessage(identity.privateKey, "technocore", nonce, "useful contribution");
  const receipt = {
    service: "https://technocore.chat",
    room: "technocore",
    did: identity.did,
    nonce,
    text: signed.text,
    canonical: signed.canonical,
    signature: signed.signature,
    signatureAlgorithm: "Ed25519",
    offlineVerified: true,
    latencyMs: 123,
    sequence: 42,
    serverTimestamp: "2026-08-26T04:00:00.000000Z",
    receivedAt: "2026-08-26T04:00:00.123Z",
  };
  return { identity, receipt };
}

test("XAIPのJCSとhash profileを再現する", () => {
  assert.equal(canonicalize({ z: 1, a: "x" }), '{"a":"x","z":1}');
  assert.equal(xaipHash(undefined), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(xaipHash("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("Technocoreの署名付き結果からXAIP v1証跡を生成して検証できる", () => {
  const { identity, receipt } = fixture();
  const artifact = createTechnocoreXaipArtifact({
    privateKey: identity.privateKey,
    publicKey: identity.publicKey,
    technocoreReceipt: receipt,
    latencyMs: receipt.latencyMs,
  });
  assert.equal(artifact.receipt.formatVersion, "1");
  assert.equal(artifact.receipt.agentDid, receipt.did);
  assert.equal(artifact.receipt.callerDid, receipt.did);
  assert.equal(artifact.receipt.signature.length, 128);
  assert.equal(verifyTechnocoreXaipArtifact(artifact), true);
});

test("公開鍵の差し替えと証跡改変をfail-closedで拒否する", () => {
  const { identity, receipt } = fixture();
  const artifact = createTechnocoreXaipArtifact({
    privateKey: identity.privateKey,
    publicKey: identity.publicKey,
    technocoreReceipt: receipt,
    latencyMs: receipt.latencyMs,
  });
  const other = fixture();
  const wrongKey = createTechnocoreXaipArtifact({
    privateKey: other.identity.privateKey,
    publicKey: other.identity.publicKey,
    technocoreReceipt: other.receipt,
    latencyMs: 1,
  }).publicKey;
  assert.throws(() => verifyTechnocoreXaipArtifact({ ...artifact, publicKey: wrongKey }));
  const tampered = structuredClone(artifact);
  tampered.evidence.input.text = "tampered";
  assert.throws(() => verifyTechnocoreXaipArtifact(tampered));
});
