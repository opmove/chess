# Cloudflare アカウント作成後の手順

このドキュメントは、Cloudflare アカウントを作成したあとに chess を公開するまでの手順をまとめたものです。  
アプリ本体の説明は [`README.md`](./README.md)、仕様は [`spec.md`](./spec.md) を参照してください。

| | |
|--|--|
| **Worker 名** | `chess`（`wrangler.toml` の `name`） |
| **本番 URL** | [https://chess.opmove.workers.dev/](https://chess.opmove.workers.dev/) |
| **workers.dev サブドメイン** | `opmove.workers.dev`（アカウント単位） |

前提:

- Node.js / npm が使えること
- Cloudflare アカウントがあること（無料プランで可。100,000 requests/日・10ms CPU 時間/リクエスト程度）

> **このアプリの特徴**
> D1 / KV / 外部 API を**一切使いません**。サーバーは局面生成（chess.js）のみで、Stockfish（WASM）はブラウザ側で実行されます。
> したがって Cloudflare 側で必要なのは **Workers へのデプロイだけ**です。Secret・マイグレーション・seed は不要です。
> 静的アセット（`stockfish.js` / `stockfish.wasm` / `chess.js`）は `public/` に配置され、`wrangler.toml` の `[assets]` 設定で一緒に配信されます（`npm install` 時の postinstall で `node_modules` からコピーされます）。

---

## 現状（設置済み）

次の構成で公開済みです。

| 項目 | 値 |
|------|-----|
| Cloudflare Worker | `chess` |
| 公開 URL | [https://chess.opmove.workers.dev/](https://chess.opmove.workers.dev/) |

以降の手順は、**別アカウントでゼロから再現するとき**、または **手元から再デプロイするとき** 用です。

---

## チェックリスト（全体像）

1. [ ] 依存関係のインストール（`npm install`）
2. [ ] Wrangler ログイン（`npx wrangler login`）
3. [ ] workers.dev サブドメインの有効化（初回のみ）
4. [ ] ローカル動作確認（`npm run dev`）
5. [ ] 本番デプロイ（`npx wrangler deploy`）
6. [ ] 本番 URL で動作確認

---

## 1. 依存関係のインストール

プロジェクトルートで:

```bash
npm install
```

postinstall スクリプト（`scripts/copy-assets.mjs`）が `public/` にクライアント資産をコピーします。
`public/` は git 管理外（`.gitignore` に含まれている）のため、clone 後は必ず `npm install` を実行してください。

## 2. Wrangler ログイン

```bash
npx wrangler login
```

ブラウザが開くので Cloudflare アカウントで承認します。

> **メモ**: 環境によっては `UND_ERR_CONNECT_TIMEOUT` で失敗することがあります（Node.js が実際には通らない IPv6 経路を選ぶため）。
> その場合は `NODE_OPTIONS=--dns-result-order=ipv4first npx wrangler login` で再試行してください。

## 3. workers.dev サブドメインの有効化（初回のみ）

アカウント作成直後で workers.dev サブドメインが未設定の場合は有効化します。

```bash
npx wrangler deploy
# 対話式でサブドメインを入力して登録
```

または Cloudflare ダッシュボード（Workers & Pages → Overview）から設定します。

## 4. ローカル動作確認

```bash
npm run dev
```

ブラウザで `http://127.0.0.1:8787/` を開き、以下を確認します。

- ランダムな局面（White to move）が表示される
- 「最善手を表示」を押すと、ブラウザ内の Stockfish（WASM）が depth 15 で探索し、最善手（SAN）＋評価値＋深さ＋理由が表示される
- `public/` 配下のアセット（`/stockfish.js` `/stockfish.wasm` `/chess.js`）が配信されている（DevTools の Network タブ）

## 5. 本番デプロイ

```bash
npx wrangler deploy
```

`https://chess.opmove.workers.dev/` で公開されます（`<account>` が `opmove`）。

## 6. 本番 URL で動作確認

1. `https://chess.opmove.workers.dev/` を開く（ランダム局面が表示される）
2. 「最善手を表示」を押して、最善手が表示されること、思考中の表示 → 結果表示になることを確認
3. 任意局面の再現: `https://chess.opmove.workers.dev/?fen=<FEN>`（白番の FEN）を開く

## トラブルシューティング

| 事象 | 確認事項 |
|------|----------|
| デプロイ後に「最善手を表示」が動かない | `https://chess.opmove.workers.dev/stockfish.wasm` が 200 で返るか。返らない場合は `npm install` 未実行で `public/` が無い可能性 |
| 盤面が表示されない | Workers のエラーログ: `npx wrangler tail` |
| `?fen=` で局面が再現されない | FEN が白番（手番フィールド `w`）か、URL エンコードされているか |

## カスタムドメインを使う場合（任意）

`wrangler.toml` にルートを追加する方法:

```toml
routes = [
  { pattern = "chess.example.com", custom_domain = true }
]
```

その後 `npx wrangler deploy` を再実行します。Cloudflare ダッシュボードの Workers → Settings → Domains & Routes からも設定できます。
