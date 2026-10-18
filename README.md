# chess

ランダムなチェスの途中盤面を生成し、ブラウザ内の Stockfish（WASM）で最善手を表示する Web アプリ。

**本番 URL: https://chess.opmove.workers.dev/**

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

## 検証

```bash
npm run typecheck   # tsc --noEmit
```

テストは存在しない。動作確認は `npm run dev` でブラウザを開いて行う。

## デプロイ

```bash
npx wrangler deploy   # または npm run deploy
```

## プロジェクト構造

```
src/
├── index.ts             # Hono アプリエントリーポイント
├── types.ts             # Cloudflare Workers 環境変数の型定義
├── routes/
│   └── page.tsx         # GET /  ランダム局面ページ（?fen= で指定局面も可）
├── components/
│   └── BoardPage.tsx    # Hono JSX 盤面ページ＋クライアント JS（stockfish.js 起動・UCI 通信）
└── services/
    └── position.ts      # chess.js によるランダム局面（FEN）生成
public/                  # 静的アセット（stockfish.js / stockfish.wasm / chess.js。npm install で node_modules からコピー）
```

## コーディング規約

- TypeScript（ESM、`"type": "module"`）。インデントは 2 スペース
- UI は Hono JSX（`hono/jsx`）。外部 UI ライブラリは使わない
- 盤面描画は Unicode 駒＋CSS グリッド（携帯特化、max-width 440px）
- サーバー側は無状態。状態は URL クエリ（`?fen=`）でやり取りする
- 外部 API・DB は使わない設計を維持する

## 仕様

詳細は [spec.md](./spec.md) を参照。アーキテクチャ概要は [architecture.md](./architecture.md) を参照。

## AI エージェント向け情報

- 本ファイル（README.md）は AGENTS.md のシンボリックリンク先でもある
- エージェント用スキルは `.kimi/skills/` にある
