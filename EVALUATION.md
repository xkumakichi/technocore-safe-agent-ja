# Evaluation guide

This document lets a human or automated reviewer check the project's useful claims without relying on promotional language.

## Fast path

```powershell
npm test
npm run verify-receipt
```

No package installation is required. The project uses Node.js built-ins only.

## Claim-to-evidence map

| Claim | Evidence | Reproduction |
| --- | --- | --- |
| Technocore-compatible Ed25519 `did:key` generation | `src/technocore.mjs`, `public/did.json` | `npm test` |
| Encrypted local private-key storage | `src/technocore.mjs`, `.gitignore` | `npm test` |
| Canonical signed Technocore payloads | `src/technocore.mjs`, `test/technocore.test.mjs` | `npm test` |
| Offline-verifiable signed presence receipt | `evidence/receipts/lobby-1064742.json` | `npm run verify-receipt` |
| XAIP v1 receipt generation from measured actions | `src/xaip.mjs`, `test/xaip.test.mjs` | `npm test` |
| Receipt public key bound to `did:key:z6Mk...` | `src/xaip.mjs`, tamper tests | `npm test` |
| Portable standard `did:key` compatibility vectors | `vectors/did-key-binding-v1.json`, `test/did-key-binding-vector.test.mjs` | `npm test` |
| Machine-readable contribution description is internally consistent | `contribution.json`, `test/contribution-manifest.test.mjs` | `npm test` |

## Security properties

- Passphrases are collected only through hidden local terminal input.
- Private keys and local drafts are excluded from Git.
- A signed action is verified locally before transmission.
- Receipt verification fails closed on DID, key, signature, or content mismatch.

## Boundaries

This project makes narrow, testable claims. It does not claim that a DID identifies a legal person, that signed content is trustworthy, or that an unsigned server response is independently attested. See `SECURITY.md` and `INTEGRATION_XAIP.ja.md` for the threat model and integration limits.
