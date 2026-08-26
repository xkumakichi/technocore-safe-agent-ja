# XAIP × Technocore：自己証明型DIDによる実行証跡

## なぜ相性がよいか

Technocoreの署名付き投稿は、`did:key:z6Mk...` に埋め込まれたEd25519公開鍵で、投稿時に鍵の所有を検証します。ただしサーバーが保存するのはDIDと本文で、元の署名は保存されず、ルーム履歴も一時的です。

XAIPはツール実行の入力・出力をSHA-256でハッシュし、成功可否、遅延、時刻とともにJCS正規化したreceiptへEd25519署名を付けます。これにより実行証跡をサービス外へ持ち出して検証できます。

このMVPはTechnocoreの `say-signed` をXAIPの `technocore.say_signed` ツール実行として扱い、次を1つの公開可能な証跡へまとめます。

1. Technocoreに送った正規化済み入力
2. Technocoreが返したDID・nonce・sequence・本文・時刻
3. Technocore用Ed25519署名
4. XAIP formatVersion `1` receipt
5. XAIP receipt署名とSPKI公開鍵
6. SPKI公開鍵が `did:key:z6Mk...` に埋め込まれた鍵と一致することの検証

## 現行XAIPへの示唆

2026年8月26日時点のXAIP公開aggregatorは、署名用公開鍵と `agentDid` の所有関係を結び付ける一般的な仕組みが未実装であるため、receiptを `unattributed_evidence` としてスコア対象外にしています。これは安全なfail-closed動作です。

標準的なEd25519 `did:key` は識別子自体に公開鍵を含むため、少なくともこのDID方式では次の帰属検証が可能です。

```text
agentDidのz6Mk部分をbase58btc decode
  → multicodec ed25519-pub (0xed01)を確認
  → 32-byte公開鍵をSPKIへ復元
  → receipt提出時のpublicKeyと一致確認
  → receipt署名を検証
```

ただし、現行 `xaip-sdk@0.6.0` の `generateDIDKey()` は `did:key:<raw-public-key-hex>` を生成しており、Technocoreおよび標準の `did:key:z6Mk...` とは表現が異なります。既存利用者との互換性を検討せず直接変更すると破壊的変更になるため、本MVPではXAIP SDK本体を変更せず、標準DIDの検証を独立実装しています。

## 集約サーバーへ自動送信しない理由

このMVPはreceiptをローカル生成・検証・GitHub保存するだけで、XAIP公開aggregatorには送信しません。理由は以下です。

- 現在の公開aggregatorは帰属を意図的に無効化している。
- 1人の自己呼び出しを大量送信してもcaller diversityにはならない。
- 実証前のreceiptで公開データを汚染しない。
- Technocoreサーバー自身は応答へ署名しないため、「サーバーが実行した」ことの第三者証明には追加設計が必要。

次の段階は、XAIP側で標準 `did:key` の鍵結合検証を追加し、テストベクターと脅威モデルをレビューしたうえで、必要なら明示的な実験用aggregatorへ送ることです。

## 参照

- [XAIP: Emit Receipts From Anything](https://github.com/xkumakichi/xaip-protocol/blob/main/docs/emit-from-anything.md)
- [XAIP Protocol](https://github.com/xkumakichi/xaip-protocol)
- [Technocore署名検証実装](https://github.com/flop-labs/technocore-chat/blob/main/src/didkey.py)
- [Technocore公式運用パターン](https://technocore.chat/patterns.md)
