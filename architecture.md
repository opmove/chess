# アーキテクチャ

## 概要

Cloudflare Workers（無料枠）上で動作する無状態 Web アプリ。サーバーは Hono で局面生成のみを行い、チェスエンジンの探索はすべてブラウザ側の stockfish.js（WASM）で実行する。これにより Workers の 10ms CPU 時間制限に収まる。

## リクエストフロー

```
ブラウザ
  │ GET / （または /?fen=<FEN>）
  ▼
Hono (src/index.ts → routes/page.tsx)
  │  services/position.ts が chess.js でランダム局面（6〜20 手の自己対局）を生成
  ▼
BoardPage.tsx（Hono JSX + インライン <script>）
  │  FEN をページに埋め込み、盤面を CSS グリッド＋Unicode 駒で描画
  │  「最善手を表示」クリック時にブラウザ内 Stockfish（public/stockfish.js, WASM）へ
  │  position fen / go depth 15 を送信 → bestmove を受信
  ▼
SAN＋評価値＋深さを表示
```

## 主要モジュール

| ファイル | 責務 |
|---------|------|
| `src/index.ts` | Hono アプリの組み立て、ルート登録 |
| `src/routes/page.tsx` | `GET /`。`?fen=` のバリデーション（不正ならランダム生成へフォールバック） |
| `src/services/position.ts` | chess.js によるランダム自己対局＋FEN 生成 |
| `src/components/BoardPage.tsx` | 盤面レンダリング＋クライアント JS（Stockfish UCI 通信、評価値表示） |

## 状態管理

- サーバー側に状態なし（DB / KV 不使用）
- 局面は FEN で表現され、`?fen=` クエリとページ内テキストでやり取り
- Stockfish インスタンスはブラウザ内のみ保持

## 静的アセット

`public/` の stockfish.js / stockfish.wasm / chess.js は `npm install` 時の postinstall（`scripts/copy-assets.mjs`）で `node_modules` からコピーされる。Workers の `[assets]` 設定により静的配信される。
