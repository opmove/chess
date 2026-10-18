---
name: dev
description: ローカル開発サーバー（wrangler dev）の起動と動作確認
---

# ローカル開発

`npm run dev` で wrangler dev を起動し、http://127.0.0.1:8787/ をブラウザで確認する。

変更後は `npm run typecheck` を必ず実行する。

確認ポイント：
- `GET /` でランダム局面ページが返ること
- 「最善手を表示」をクリックすると Stockfish が depth 15 で探索し、最善手（SAN）・評価値・深さが表示されること
- `GET /?fen=<FEN>` で指定局面が再現できること（不正な FEN ならランダム局面にフォールバック）
