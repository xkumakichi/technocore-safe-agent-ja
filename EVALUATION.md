# Evaluate FLOP Agent Evidence

```sh
npm test
npm run demo
npm run verify-receipt
```

Node.js >=22. No install, production key or network call is needed for these checks.

| Claim | Evidence | Scope |
| --- | --- | --- |
| Native Technocore signatures | `src/technocore.mjs`, `test/technocore.test.mjs` | Exact bytes, full DID, canonical signature, no HTTP redirects |
| Native FLOP account binding | `src/flop.mjs`, `test/flop.test.mjs` | Ed25519 public key equals AccountId32 |
| Native reference review | `src/flop.mjs`, `examples/flop-demo.mjs` | Terms, u128 amount, chain pin, timing, two-hash policy |
| Export integrity checks | `src/flop.mjs`, `test/flop.test.mjs` | 19-digit nonces, tampering, invisible characters, replay and gaps |
| Official TCLK boundary | `auditTclk` in `src/flop.mjs` | Delegates semantics upstream; optional module not bundled |
| Official FlopRail read-only boundary | `verifyFlopLock` in `src/flop.mjs` | No signer; failure and cleanup tested with injected adapters |
| Historical signed record still verifies | `evidence/receipts/lobby-1064742.json` | Key-control proof; server metadata is unsigned |

The synthetic demo reports `chainLockVerified: false` and
`workDeliveryVerified: false`. The optional network adapter marks a lock verified
only after official `verifyLock` returns true. Supplied tests do not establish live
devnet interoperability, payment execution, complete room history, consensus
verification or useful work delivery. See [design and source pins](docs/FLOP_DESIGN.md).

Legacy XAIP tests preserve old artifact reproducibility. They are not dependencies
of the active FLOP workflow. `contribution.json` describes the active scope.
