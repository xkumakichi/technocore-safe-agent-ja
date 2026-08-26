# XAIP × Technocore: execution evidence with self-certifying DIDs

## Why the protocols fit together

A signed Technocore write proves control of the Ed25519 public key embedded in a standard `did:key:z6Mk...` identifier. The service stores the verified DID and normalized message, but room history is ephemeral and the original client signature is not retained as a permanent artifact.

XAIP hashes a tool execution's input and output, records success, latency, failure type, and time, then signs the JCS-canonicalized receipt with Ed25519. This makes execution evidence portable outside the service where the action occurred.

This prototype treats Technocore `say-signed` as the XAIP tool `technocore.say_signed` and binds these records into one public artifact:

1. normalized Technocore input;
2. the DID, nonce, sequence, text, and timestamp returned by Technocore;
3. the original Technocore Ed25519 signature;
4. an XAIP formatVersion `1` receipt;
5. the XAIP receipt signature and SPKI public key;
6. verification that the SPKI key equals the key embedded in the claimed `did:key`.

## Attribution gap and narrow solution

At the 2026-08-26 implementation snapshot, the public XAIP aggregator verifies a receipt against a submitted public key but does not generally prove that the submitted key belongs to the claimed `agentDid`. Attribution is therefore deliberately fail-closed and receipts remain evidence rather than selection or eligibility signals.

Standard Ed25519 `did:key` identifiers are self-certifying: the identifier contains the multicodec-tagged public key. For this DID method, the missing binding can be checked without a separate registry:

```text
decode the base58btc payload after did:key:z
  → require multicodec ed25519-pub bytes 0xed 0x01
  → require exactly 32 public-key bytes
  → reconstruct or compare the Ed25519 SPKI public key
  → require equality with the receipt submission public key
  → verify the XAIP receipt signature
```

The implementation rejects altered DIDs, substituted public keys, changed receipt fields, and invalid signatures.

## Compatibility constraint

At the same snapshot, `xaip-sdk@0.6.0` generates `did:key:<raw-public-key-hex>`, which is not the standard multibase/multicodec `did:key:z6Mk...` representation used by Technocore. Changing that generator in place could break existing identities and stored receipts.

This prototype therefore leaves the XAIP SDK unchanged and implements standard `did:key` verification in an isolated adapter. A safe upstream path would add explicit DID-method handling, compatibility tests, and versioned migration behavior before changing existing identity generation.

## Why receipts are not auto-submitted

- The public aggregator's general attribution path is intentionally disabled at the observed snapshot.
- Repeated self-calls do not create real caller diversity.
- Experimental receipts should not pollute public data before the binding model is reviewed.
- Technocore does not sign its server response, so the artifact proves the agent's signed request and locally observed response, not independent server attestation.

The project generates and verifies receipts locally first. Any future aggregator submission should follow an explicit review of the binding method and threat model.

## References

- [XAIP: Emit Receipts From Anything](https://github.com/xkumakichi/xaip-protocol/blob/main/docs/emit-from-anything.md)
- [XAIP Protocol](https://github.com/xkumakichi/xaip-protocol)
- [Technocore signing implementation](https://github.com/flop-labs/technocore-chat/blob/main/src/didkey.py)
- [Technocore protocol manual](https://technocore.chat/llms.txt)
- [Technocore identity patterns](https://technocore.chat/patterns.md)
