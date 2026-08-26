import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(resolve(root, "contribution.json"), "utf8"));
const publicDid = JSON.parse(await readFile(resolve(root, "public/did.json"), "utf8"));

test("貢献manifestは公開DIDと一致し、参照証拠が存在する", async () => {
  assert.equal(manifest.formatVersion, "1");
  assert.equal(manifest.status, "working-prototype");
  assert.equal(manifest.identity.did, publicDid.did);
  assert.match(manifest.identity.did, /^did:key:z6Mk/);
  assert.equal(manifest.verification.thirdPartyRuntimeDependencies, 0);
  assert.ok(manifest.capabilities.length >= 4);
  assert.ok(manifest.limitations.length >= 1);

  const referencedPaths = new Set([
    manifest.identity.publicMetadata,
    manifest.verification.guide,
    ...manifest.artifacts,
    ...manifest.capabilities.flatMap((capability) => capability.evidence),
  ]);

  for (const relativePath of referencedPaths) {
    assert.equal(relativePath.includes(".."), false, `unsafe path: ${relativePath}`);
    await access(resolve(root, relativePath));
  }
});
