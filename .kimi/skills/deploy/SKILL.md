---
name: deploy
description: Cloudflare Workers へのデプロイ手順
---

# デプロイ

1. `npm run typecheck` が通ることを確認
2. `npx wrangler deploy`（または `npm run deploy`）を実行
3. デプロイ後、https://chess.opmove.workers.dev/ で動作確認

注意：
- 無料枠運用のため、サーバー側に重い処理を追加しないこと
- wrangler login が済んでいない場合は先に `npx wrangler login`
