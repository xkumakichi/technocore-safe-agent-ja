# FLOP-native project update — prepared 2026-10-27

Status: prepared; not posted by this change. Destination: X `@XAIPAgent`.

## English

FLOP Agent Evidence now checks native Technocore signatures and flop1 references, with optional adapters for official TCLK and read-only FlopRail. Offline tests pass; live chain integration is still pending.

https://github.com/xkumakichi/technocore-safe-agent-ja

## 日本語訳

FLOP Agent EvidenceはTechnocore本来の署名とflop1参照を確認し、公式TCLK・読み取り専用FlopRail向けの任意アダプターを備えました。オフラインテストは通過しています。実チェーンとの接続検証はこれからです。

## Evidence behind the wording

- `src/flop.mjs`, `src/technocore.mjs` and the offline demonstration are implemented.
- Optional official modules are not bundled or automatically downloaded.
- API-boundary tests use injected implementations; no live payment is claimed.
- The linked repository must contain the change and pass CI before posting.
