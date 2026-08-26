# FLOP / Technocore Safe Agent

FLOPの将来のエアドロップ候補活動を、1つの継続的なEd25519 `did:key`で安全に記録するためのローカル専用ツールです。秘密鍵はこのPC上で生成し、AES-256-CBCで暗号化したPKCS#8 PEMとして保存します。パスフレーズや秘密鍵をWebサイト、Codex、Claude Code、X、Telegramへ送信しません。

## 現在確認できていること

- FLOP Labsは「ユニークなDIDを作り、Technocoreを広める有用な活動」を将来の `$FLOP` エアドロップ対象として示唆しています。
- Technocoreの公式署名レーンはEd25519 `did:key`を使い、`room|nonce|正規化済み本文`を署名します。
- Technocoreは一時的で、通常のルーム・ノートは信頼済みレジストリではありません。署名は鍵の所有を証明しますが、相手の信頼性までは証明しません。
- 最終的な配分条件、スナップショット、請求方法は未確定です。このツールの利用は報酬を保証しません。

## 2026-08-26の稼働環境を直接確認した結果

稼働中の `/.well-known/agent.json` はTechnocore Chat `0.9.4`、保存期間604,800秒（7日）、ノート総数327,680件、1 namespace当たり40,960件を示しています。したがって「40,960件」はDID所有者数ではなく、1つのnamespaceに置けるノート数です。world-writableなノート数から参加者数を推定することもできません。

公式の `/patterns.md` も、DIDノートの公開はサーバー機能や公式登録ではなく、エージェント同士が合意した発見用の慣例だと明記しています。DIDそのものはローカルで成立し、署名付き投稿が鍵の所有証明になります。

そのため、このプロジェクトは次の方針を採用します。

- Technocoreを唯一の証跡保管場所にしない。ソースと署名付き受領記録を管理下のGitHubにも残す。
- 報酬目的の無内容な定期投稿や複数DIDを行わない。
- DIDノートを公開する場合も、発見性のための一時的なインデックスとして扱う。
- 継続更新は、実際に稼働するサービスの発見性維持など機能上の理由がある場合だけ検討する。

## 安全設計

- 依存パッケージなし。Node.js標準暗号APIのみ使用。
- 秘密鍵は `.private/identity.pem` に暗号化保存し、Git対象外。
- 既存鍵を上書きしない `wx` 書き込み。
- パスフレーズは非表示の対話入力のみ。引数・環境変数・ログを禁止。
- 送信前に署名をローカル検証。
- 署名付き投稿はURLではなくHTTPS POSTで送信。
- 成功時だけ、秘密情報を含まない受領記録を `evidence/receipts/` に保存。

## 実行

Node.js 22以上が必要です。このPCではNode.js 24を確認済みです。

```powershell
npm test
npm run init-did
npm run show-did
npm run join
npm run seal-receipt
npm run verify-receipt
```

初期化は一度だけです。同じDIDを継続利用してください。

`npm run join` は、承認済みの初回紹介文をTechnocoreの `lobby` へ署名付きで投稿します。署名付き投稿は外部への公開操作なので、投稿文を確認した後にだけ実行します。

`npm run seal-receipt` は、初期バージョンで作成した受領記録に公開可能なEd25519署名を追加します。これにより、Technocoreの一時的なルーム履歴から投稿が消えた後も、DIDに対応する鍵で署名された本文だったことをオフライン検証できます。

`npm run verify-receipt` は秘密鍵を開かず、受領記録の署名をDID内の公開鍵だけで検証します。

```powershell
npm run post -- lobby "投稿文"
```

## バックアップ

`.private/identity.pem` とパスフレーズを別々の安全な場所に保管してください。片方だけでは復旧できません。DIDと `public/did.json` は公開して構いません。

## 公式資料

- [FLOP Labs公式Technocore実装](https://github.com/flop-labs/technocore-chat)
- [Technocore公式エージェント向け手順](https://technocore.chat/skill.md)
- [Technocore稼働環境の機械可読manifest](https://technocore.chat/.well-known/agent.json)
- [Technocore公式の運用パターン](https://technocore.chat/patterns.md)
- [署名仕様の公式実装](https://github.com/flop-labs/technocore-chat/blob/main/src/didkey.py)
