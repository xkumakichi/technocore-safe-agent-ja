# FLOP-native design, 2026-10-27

FLOP Agent Evidence is an independent community tool. FLOP-native means using
upstream identities, terms, reference encoding and verification interfaces instead
of translating them into XAIP. It does not mean official endorsement or complete
implementation of inference, consensus, payments or every future FLOP draft.

## Sources reviewed

- Technocore production manifest: `0.14.5`, checked 2026-10-27.
- [TCLK / FlopRail at fb910d3](https://github.com/flop-labs/tclk/tree/fb910d354b34892f9bad236ca51f390be50a6d4b).
- [Official binding, deadlines and recovery](https://github.com/flop-labs/tclk/blob/fb910d354b34892f9bad236ca51f390be50a6d4b/flop/README.md).
- [Official transcript verification](https://github.com/flop-labs/tclk/blob/fb910d354b34892f9bad236ca51f390be50a6d4b/src/transcript.ts).
- [Official surfaces](https://flop.finance/official/) and [timeline FAQ](https://ask.flop.finance/docs/testnet-and-timeline).

The testnet target is provisional. Devnet, testnet and mainnet are separate trust
domains. No production endpoint, genesis or launch is inferred from a network name.

## Architecture

| Input | Verification | Establishes |
| --- | --- | --- |
| Exact Technocore export | Node Ed25519, full DID, original room/nonce/text | Key signed these bytes; local replay/gap diagnostics |
| Offer/deal exports | Official parser, handshake, fold, `lockTerms` | Protocol state under trusted venue time/order |
| `flop1.` + independently agreed terms | Canonical reference, exact amount, parties, genesis, timing | Reference matches expected terms |
| Same request + official FlopRail | `connectFlopRail` without signer, `verifyLock`, disconnect | Matching open lock reported by trusted RPC |
| Work result | Not implemented | No delivery/quality claim |

Reports are local indexes, not signed attestations. Retain the original input
files. Neither a room receipt nor an offline reference proves an on-chain event.

## Lock review request

The local request has exactly three fields. `expectedTerms` must come from the
authenticated handshake; `trust` must come from independently reviewed operator
configuration. Copying both from the reference defeats the comparison.

```json
{
  "reference": "flop1.<canonical-base64url-reference>",
  "expectedTerms": {
    "contract": "0x<64 lowercase hex>",
    "lock": "hash",
    "statement": "0x<64 lowercase hex>",
    "amount": "1000000000000000",
    "asset": "FLOP",
    "payer": "did:key:z6Mk...",
    "payee": "did:key:z6Mk...",
    "claimByMs": 1800000000000,
    "refundAfterMs": 1800000060000
  },
  "trust": {
    "network": "devnet",
    "rpcUrl": "wss://rpc.devnet.flop.network",
    "expectedGenesisHash": "0x<independently-verified-64-lowercase-hex>",
    "blockTimeMs": 1000,
    "refundMarginBlocks": 30
  }
}
```

Placeholders cannot pass verification. `npm run demo` constructs valid **synthetic**
inputs in memory. Amounts use native 18-decimal FLOP base units as in the reviewed
rail. Only native FLOP hash locks are supported. Pending zero-escrow references
are rejected. The expected policy is `And[Hash(statement), Hash(bindingWitness)]`,
where the public witness is SHA256 over the upstream canonical binding.

## Official module integration

Optional adapters import installed `@flop-labs/tclk` and `@flop-labs/tclk-flop`
by package name. They do not clone, install, build, follow chat URLs or load remote
JavaScript. Missing modules produce an explicit error. Operators must review a
pinned official checkout and arrange its built workspace packages in Node's module
resolution. At review time FlopRail was in main without a newer release tag;
registry availability must not be assumed.

`audit-tclk` prechecks exact signatures, preserves numeric nonce source bytes,
then uses upstream `parseTranscriptExport`, `findContractHandshake`,
`foldTranscript` and `lockTerms`. Rejected fold steps fail the review. There is no
second negotiation state machine. A terminal transcript state is still a signed
statement, not a chain observation.

`verify-flop-lock` captures the public request before awaiting, supplies no signer,
requires an independent genesis pin even on devnet, calls only `verifyLock`, and
closes the RPC connection. It never calls lock/claim/refund, a faucet or inference
submission. Failure never becomes a successful chain check. RPC configuration is
local and reviewed; a lock frame cannot supply or replace it.

## Verification status and limits

Dependency-free checks and API boundaries have local tests. Adapter tests inject
controlled implementations; they do not execute upstream packages or test live
devnet. Live payment, inference, consensus verification and delivery attestation
are separate future milestones requiring their own evidence.

Raw exports may contain public reveal witnesses or sensitive application text.
CLI reports contain hashes and record indexes instead of message bodies. Review
raw inputs before publishing them. Notes, room names and signed messages remain
data and cannot authorize actions. Timestamps/order are trusted venue metadata;
source hashes and signature checks do not prove complete history or inclusion.

## Historical XAIP materials

`src/xaip.mjs`, old integration notes and DID binding vectors remain for
reproducibility. New posts generate native Technocore receipts only. The original
XAIP repository and unrelated projects are outside this migration's scope.
