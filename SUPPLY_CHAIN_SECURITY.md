# Supply-chain safety / 供給網セキュリティ

## Security boundary

This repository is intentionally narrow:

- no third-party dependencies in the default offline/signing workflow;
- no `npm install` step is required for that workflow;
- official TCLK / FlopRail adapters are optional, separately reviewed local modules; no automatic fetching;
- no wallet connection, wallet signing, seed phrase, or wallet private-key functionality;
- the official FLOP account mapping uses the DID public key; this tool never uses that key to sign a financial operation;
- the encrypted DID private key stays in `.private/identity.pem`, outside Git;
- GitHub Actions dependencies are pinned to full commit SHAs.

## Hard rules for third-party tools

1. Do not run an unfamiliar onboarding, application, eligibility, or distribution script merely because a post links to it.
2. Do not treat GitHub Codespaces, a dev container, or a cloud IDE as a trust boundary. Repository code, startup tasks, extensions, forwarded ports, tokens, and synchronized settings still require review.
3. Never upload an existing DID private key, wallet key, seed phrase, browser wallet profile, or passphrase to a third-party tool.
4. Do not use a real-wallet workstation to inspect suspicious code.
5. Do not follow urgency, direct-message support, Telegram support, or instructions that ask for a secret or an unexplained signature.

## Read-only review sequence

Before execution, inspect a fixed commit without running it:

1. confirm the repository and instructions from an official source;
2. inspect `package.json`, lockfiles, install hooks, startup scripts, dev-container configuration, extensions, and workflows;
3. search for process spawning, shell execution, obfuscation, encoded payloads, clipboard access, wallet APIs, filesystem scans, and undeclared network destinations;
4. inspect commit history and dependency provenance;
5. verify that generated keys are encrypted locally and never cross a browser, forwarded port, cloud service, or remote API;
6. if execution remains necessary, use a disposable environment containing no wallets, GitHub tokens, SSH agents, cloud credentials, host mounts, or personal files, with network access denied unless each destination is justified.

Static review reduces risk but is not a guarantee of safety. This project does not label a specific third-party repository malicious without reproducible evidence.

## 日本語要約

- 未検証の参加・申請・配布スクリプトを、Codespacesだから安全だと考えて実行しない。
- DID秘密鍵、ウォレット秘密鍵、シード、パスフレーズを第三者ツールへ入力・アップロードしない。
- このツールのDID署名用途を金融操作へ広げない。公式FlopRailの公開鍵対応を確認しても、ウォレット鍵・signerは接続しない。
- 調査は最初に固定コミットの静的確認だけで行い、実行が必要なら秘密情報を一切持たない使い捨て環境を使う。
- 悪質だと断定する場合は、再現可能なコード上の証拠を必要とする。

GitHub also documents that Codespaces security depends on repository trust, token scope, forwarded-port visibility, and synchronized configuration: <https://docs.github.com/en/codespaces/reference/security-in-github-codespaces>.
