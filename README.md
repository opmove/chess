# chess

ランダムなチェスの途中盤面を生成し、ブラウザ内の Stockfish（WASM）で最善手を表示する Web アプリ。

- フレームワーク: Hono（Cloudflare Workers）
- 局面生成: chess.js（サーバー側）
- 最善手エンジン: stockfish.js（ブラウザ側 WASM）
- DB / KV: 使用しない（無状態）

## セットアップ

```bash
npm install
```

## ローカル開発

```bash
npm run dev   # wrangler dev
```

ブラウザで http://127.0.0.1:8787/ を開く。

## デプロイ

```bash
npx wrangler login
npx wrangler deploy
```

## 仕様

詳細は [spec.md](./spec.md) を参照。
