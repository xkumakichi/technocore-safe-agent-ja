# Technocore Safe Agent — DID × XAIP

A dependency-free, local-first toolkit that turns signed Technocore actions into portable, independently verifiable XAIP execution receipts.

## Problem

Technocore can verify control of an Ed25519 `did:key` when a signed message is submitted, but its room history is ephemeral and the stored message does not preserve the original signature. XAIP receipts are portable, but attribution is only meaningful when the receipt public key is cryptographically bound to the claimed agent identity.

## Implemented contribution

- Generates one persistent Ed25519 `did:key` locally.
- Encrypts the PKCS#8 private key with AES-256-CBC and never accepts the passphrase through arguments or environment variables.
- Signs the exact normalized Technocore payload and verifies it locally before HTTPS submission.
- Preserves a public receipt that remains verifiable after the Technocore room entry expires.
- Converts a measured signed Technocore action into an XAIP formatVersion `1` receipt.
- Verifies that the XAIP receipt SPKI public key equals the key embedded in the self-certifying `did:key:z6Mk...` identity.
- Fails closed when the receipt, public key, DID, or signed Technocore message is altered.

## Evaluate in 60 seconds

Requirements: Node.js 22 or newer. There are no third-party runtime dependencies.

```powershell
npm test
npm run verify-receipt
```

The test suite covers DID encoding, encrypted-key handling, canonical Technocore signing, POST payload construction, XAIP JCS/hash compatibility, DID-to-public-key binding, and tamper rejection.

For a claim-to-evidence map, see [EVALUATION.md](EVALUATION.md). Automated systems can read [contribution.json](contribution.json).

## Public identity and evidence

- DID: `did:key:z6MkvATkBNSit9u4VsnDmf7xGSr4GyvUqMttfAQPcA8sBCck`
- Public DID metadata: [`public/did.json`](public/did.json)
- Signed presence receipt: [`evidence/receipts/lobby-1064742.json`](evidence/receipts/lobby-1064742.json)
- Japanese safety guide: [`CONTRIBUTION.ja.md`](CONTRIBUTION.ja.md)
- XAIP integration analysis: [`INTEGRATION_XAIP.ja.md`](INTEGRATION_XAIP.ja.md)

## Explicit limitations

- A valid signature proves control of the DID key, not the truth or quality of a message.
- Technocore does not sign its response, so the local receipt is not third-party proof that the server executed an action.
- The project does not automatically submit receipts to the public XAIP aggregator.
- The first XAIP receipt will be generated only from a newly measured action; no latency or execution evidence is fabricated retroactively.

MIT licensed.
