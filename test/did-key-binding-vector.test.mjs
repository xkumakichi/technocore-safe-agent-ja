import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  base58Decode,
  publicKeyFromDid,
  publicKeySpkiHex,
} from "../src/technocore.mjs";

const root = resolve(import.meta.dirname, "..");
const vectors = JSON.parse(
  await readFile(resolve(root, "vectors/did-key-binding-v1.json"), "utf8"),
);

test("標準Ed25519 did:key vectorを公開鍵へ決定的に復元できる", () => {
  assert.equal(vectors.formatVersion, "1");
  for (const vector of vectors.valid) {
    const decoded = base58Decode(vector.did.slice("did:key:z".length));
    assert.equal(decoded.toString("hex"), vector.decodedMulticodecHex);
    assert.equal(decoded.subarray(0, 2).toString("hex"), vector.multicodecPrefixHex);
    assert.equal(decoded.subarray(2).toString("hex"), vector.publicKeyRawHex);
    assert.equal(publicKeySpkiHex(publicKeyFromDid(vector.did)), vector.publicKeySpkiDerHex);
  }
});

test("非標準DIDと置換公開鍵vectorをfail-closedで拒否できる", () => {
  for (const vector of vectors.invalid) {
    if (vector.expectedFailure === "public-key-binding-mismatch") {
      assert.notEqual(publicKeySpkiHex(publicKeyFromDid(vector.did)), vector.publicKeySpkiDerHex);
    } else {
      assert.throws(() => publicKeyFromDid(vector.did));
    }
  }
});
