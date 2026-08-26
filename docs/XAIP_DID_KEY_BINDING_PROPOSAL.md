# Proposal: backward-compatible standard `did:key` binding for XAIP

Status: implementation proposal with executable public test vectors.

## Problem

Verifying a receipt signature against a submitted public key is not enough to attribute the receipt to its claimed `agentDid`. The verifier must also establish that the submitted public key belongs to that identifier.

Standard Ed25519 `did:key` identities solve this narrow binding problem because the multibase/multicodec identifier contains the public key. Existing XAIP identities using `did:key:<raw-public-key-hex>` must still be handled deliberately because changing their interpretation in place would break stored identities and receipts.

## Proposed verifier behavior

1. Parse the claimed `agentDid` before receipt signature verification.
2. If it is a standard Ed25519 `did:key:z...`:
   - base58btc-decode the payload;
   - require the `ed25519-pub` multicodec prefix `0xed 0x01`;
   - require exactly 32 remaining key bytes;
   - compare those bytes, or the reconstructed SPKI key, with the submitted receipt public key;
   - reject on any mismatch;
   - verify the receipt signature only with the bound key.
3. If it is an existing XAIP raw-hex identity, route it through an explicitly named legacy parser. Do not silently interpret arbitrary `did:key:` strings as either representation.
4. Treat unknown methods, ambiguous encodings, malformed keys, and binding failures as unattributed evidence.

## Compatibility rollout

### Phase 1: additive verifier support

- Accept standard Ed25519 `did:key:z...` identities in the aggregator.
- Preserve the existing raw-hex path under an explicit legacy identity format.
- Add the vectors in `vectors/did-key-binding-v1.json` to verifier tests.
- Keep both paths fail-closed.

### Phase 2: opt-in SDK generation

- Add a separately named standard generator such as `generateStandardDIDKey()`.
- Keep the existing generator unchanged for the current major version.
- Mark the returned identity format in generated metadata.

### Phase 3: versioned default migration

- Change the default only in a version that permits an identity-format migration.
- Publish a migration guide that makes clear that the same Ed25519 key has different textual identifiers under the legacy and standard encodings.
- Never rewrite historical `agentDid` values inside signed receipts.

## Caller attribution

Binding `agentDid` does not automatically establish an independent `callerDid`. For non-delegated local execution, `callerDid === agentDid` can use the same bound key. A distinct caller requires its own authenticated key material and signature or a separately verified delegation chain. Repeated self-calls must not be counted as caller diversity.

## Threat model checks

- public-key substitution;
- unsupported multicodec interpreted as Ed25519;
- truncated or oversized key payload;
- legacy/standard parser confusion;
- changed receipt after signature;
- claimed caller diversity without independent authentication.

## Executable evidence

Run:

```powershell
npm test
```

The public vectors contain one valid binding and invalid cases for legacy-format confusion, wrong multicodec, wrong key length, and public-key substitution. They contain no private key material.
