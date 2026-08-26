import assert from "node:assert/strict";
import { createPublicKey } from "node:crypto";
import test from "node:test";
import {
  generateEncryptedIdentity,
  base58Decode,
  base58Encode,
  loadEncryptedIdentity,
  makeNonce,
  publishSignedMessage,
  signRoomMessage,
  sweepText,
  verifyRoomMessage,
  verifyRoomMessageFromDid,
} from "../src/technocore.mjs";

test("DIDはTechnocoreのEd25519 did:key形式になる", () => {
  const identity = generateEncryptedIdentity("correct horse battery staple");
  assert.match(identity.did, /^did:key:z6Mk[1-9A-HJ-NP-Za-km-z]{44}$/);
});

test("base58btcは先頭ゼロを含めて往復できる", () => {
  const input = Buffer.from("0000ed01abcdef", "hex");
  assert.deepEqual(base58Decode(base58Encode(input)), input);
});

test("暗号化PEMは正しいパスフレーズでのみ開く", () => {
  const identity = generateEncryptedIdentity("correct horse battery staple");
  const loaded = loadEncryptedIdentity(identity.encryptedPem, "correct horse battery staple");
  assert.equal(loaded.did, identity.did);
  assert.throws(() => loadEncryptedIdentity(identity.encryptedPem, "definitely wrong passphrase"));
});

test("Technocoreと同じ正規化後の本文を署名・検証する", () => {
  const identity = generateEncryptedIdentity("correct horse battery staple");
  const loaded = loadEncryptedIdentity(identity.encryptedPem, "correct horse battery staple");
  const nonce = makeNonce(1787670000000);
  const signed = signRoomMessage(loaded.privateKey, "lobby", nonce, "  hello\nworld\u200b  ");
  assert.equal(signed.text, "hello world");
  assert.equal(signed.signature.length, 86);
  assert.equal(verifyRoomMessage(loaded.publicKey, "lobby", nonce, signed.text, signed.signature), true);
  assert.equal(verifyRoomMessageFromDid(identity.did, "lobby", nonce, signed.text, signed.signature), true);
  assert.equal(verifyRoomMessage(loaded.publicKey, "lobby", nonce, `${signed.text}!`, signed.signature), false);
  assert.equal(createPublicKey(loaded.privateKey).asymmetricKeyType, "ed25519");
});

test("署名付きPOSTは秘密情報を含めず正しいJSONだけを送る", async () => {
  let captured;
  const result = await publishSignedMessage({
    origin: "https://example.test",
    room: "lobby",
    did: "did:key:z6Mk11111111111111111111111111111111111111111111",
    signature: "a".repeat(86),
    nonce: "1787670000000",
    text: "hello",
    fetchImpl: async (url, options) => {
      captured = { url: String(url), options };
      return new Response(JSON.stringify({ posted: { seq: 1 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  assert.equal(captured.url, "https://example.test/r/lobby?format=json");
  assert.equal(captured.options.method, "POST");
  assert.deepEqual(JSON.parse(captured.options.body), {
    did: "did:key:z6Mk11111111111111111111111111111111111111111111",
    sig: "a".repeat(86),
    nonce: "1787670000000",
    text: "hello",
  });
  assert.equal(result.posted.seq, 1);
});

test("空の本文と不正なルーム名を拒否する", () => {
  assert.throws(() => sweepText("\n\u200b"));
  const identity = generateEncryptedIdentity("correct horse battery staple");
  const loaded = loadEncryptedIdentity(identity.encryptedPem, "correct horse battery staple");
  assert.throws(() => signRoomMessage(loaded.privateKey, "Lobby", makeNonce(), "hi"));
});
