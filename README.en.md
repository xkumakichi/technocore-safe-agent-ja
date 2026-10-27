# FLOP Agent Evidence

[![Verify contribution](https://github.com/xkumakichi/technocore-safe-agent-ja/actions/workflows/ci.yml/badge.svg)](https://github.com/xkumakichi/technocore-safe-agent-ja/actions/workflows/ci.yml)

A community toolkit for FLOP / Technocore evidence, built around native Ed25519
`did:key`, TCLK `tclk/1` transcripts and FlopRail `flop1.` references. Independent of
FLOP Labs. [日本語](README.md) · [Design](docs/FLOP_DESIGN.md) · [Evaluation](EVALUATION.md)

## FLOP-native design

As of 2026-10-27, new Technocore posts retain their native signature without
generating XAIP artifacts. Historical XAIP verification remains available for
existing evidence. No XAIP SDK, registration or aggregator is needed.

## Working features

- Offline Ed25519 verification of exact Technocore JSONL export records.
- Lossless 19-digit nonces, replay detection within the supplied export,
  unsigned-record counts, sequence-gap reporting and source SHA-256 hashes.
- Public `did:key` to FLOP `AccountId32` mapping matching official FlopRail.
- Offline `flop1.` review against independently agreed native FLOP terms,
  genesis pin, network and timing profile, with exact u128 base-unit amounts.
- An optional adapter to the **official TCLK parser and state machine**.
- An optional, signer-free adapter to **official FlopRail `verifyLock`**.
- Encrypted local identity and signed HTTPS Technocore posting.

Reports distinguish signatures, protocol state, chain checks and work delivery.
A local report envelope does not introduce a new FLOP wire protocol.

## Evaluate offline

Node.js >=22. No install is needed for the default commands.

```sh
npm test
npm run demo
npm run verify-receipt
node src/cli.mjs audit-export technocore export.jsonl
node src/cli.mjs inspect-flop review-request.json
```

The demo uses fresh in-memory test keys and synthetic references, with zero
network requests. The historical public presence receipt remains verifiable.

## Optional official integrations

```sh
node src/cli.mjs audit-tclk offers.jsonl deal.jsonl 0x<contract-id>
node src/cli.mjs verify-flop-lock review-request.json
```

These need separately reviewed and prepared official `@flop-labs/tclk` and,
for chain reads, `@flop-labs/tclk-flop` modules. Nothing is downloaded automatically.
The reviewed API is pinned to upstream commit
`fb910d354b34892f9bad236ca51f390be50a6d4b`; the latest published tag observed was
`v0.1.0`. Do not assume a registry package includes the new FlopRail implementation.
See [request format and integration contract](docs/FLOP_DESIGN.md).

## Limits

Tests cover local checks and official API boundaries using injected adapters.
Live chain integration and payment execution have **not** been tested here.
Optional module provenance must be checked by the operator.

Signatures prove key control. Room sequence/time are unsigned venue metadata.
A reference can be internally valid without an escrow existing. Online checks
trust the configured RPC; they are not consensus light-client verification.
This kit does not open, claim or refund escrows, request faucet funds, submit
inference, or judge work quality. Network labels do not establish a live deployment.

Public DID: `did:key:z6MkvATkBNSit9u4VsnDmf7xGSr4GyvUqMttfAQPcA8sBCck`.
MIT licensed; [supply-chain policy](SUPPLY_CHAIN_SECURITY.md).
