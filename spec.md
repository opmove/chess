# chess — ランダム局面 最善手表示 Web アプリ 仕様書

> 本ドキュメントは grill-me プロセスで合意した Single Source of Truth とする。  
> 参考構成: `/home/masasikatano/project/play`

## 1. 目的

Cloudflare Workers の無料枠 + Hono で動作する、**ランダムなチェスのゲーム途中盤面を生成し、最善手を表示する** Web アプリを作成する。
ユーザーは盤面で指さない。**表示のみ**の最小構成とする。

## 2. 技術スタック

| レイヤー | サービス / ライブラリ |
|---------|---------------------|
| フレームワーク | Hono (Cloudflare Workers アダプタ) |
| UI | Hono JSX (`hono/jsx`) |
| 盤面生成 | chess.js（サーバー側で FEN を生成） |
| 最善手エンジン | stockfish.js（ブラウザ側 WASM で実行） |
| 実行基盤 | Cloudflare Workers（無料枠のみ） |
| DB / KV | 使用しない（無状態。FEN は URL クエリでやり取り） |
| 外部 API | 使用しない |
| 言語 | TypeScript |

## 3. 無料枠制限（設計の前提条件）

- Cloudflare Workers Free: 100,000 requests/日、10ms CPU 時間/リクエスト程度。
- **Stockfish WASM はブラウザ側で実行する**。サーバーは chess.js による局面生成のみ（CPU 負荷は無視できる）ため、無料枠内に収まる。

## 4. ディレクトリ構造

```
chess/
├── wrangler.toml
├── package.json
├── tsconfig.json
├── .dev.vars.example
├── README.md
├── spec.md
└── src/
    ├── index.ts             # Hono アプリエントリーポイント
    ├── types.ts             # Cloudflare Workers 環境変数の型定義
    ├── routes/
    │   └── page.ts          # GET /  ランダム局面ページ（?fen= で指定局面も可）
    ├── components/
    │   └── BoardPage.tsx    # Hono JSX 盤面ページ＋クライアント JS（stockfish.js 起動・UCI 通信）
    └── services/
        └── position.ts      # chess.js によるランダム局面（FEN）生成
```

クライアント側アセット（stockfish.js / stockfish.wasm）は静的配信し、BoardPage のスクリプトから読み込む。

## 5. grill-me 決定事項

| 項目 | 決定内容 |
|------|----------|
| プロジェクト名 | `chess` |
| Stockfish 実行場所 | ブラウザ側（stockfish.js WASM）。サーバーは局面生成のみ |
| 局面生成 | サーバーで chess.js による自前生成（初期局面からランダム自己対局） |
| 局面フィルタ | なし（最小構成。即詰み・一方的局面も含まれうる） |
| 画面構成 | 表示のみ。ユーザーは指さない |
| 盤面描画 | Unicode 駒＋CSS グリッド（外部 UI ライブラリなし） |
| 最善手表示 | SAN＋評価値＋深さ |
| 探索設定 | 深度固定 depth 15（再現性優先。端末性能で処理時間は変わる） |
| デプロイ | Cloudflare Workers（`chess.<account>.workers.dev`） |
| テスト | なし（play 準拠、wrangler dev で手動確認） |
| ランダム手数 | 6〜20 手（全手を進めた局面） |
| キャスリング権・アンパッサン | chess.js が FEN に自動反映 |
| 重複局面管理 | しない。`GET /?fen=<FEN>` で任意局面を再現可能 |
| テーマ | play 準拠のライトモード、携帯特化（max-width 440px 想定） |
| 併記情報 | 手番表示、FEN テキスト表示 |

## 6. UI / 画面仕様

### 6.1 ページ構成

`GET /` で返す Hono JSX 単一ページ。

### 6.2 レイアウト

- ヘッダー: 製品名（`chess`）
- ステータスエリア: 手番（White to move / Black to move）＋ FEN テキスト
- 盤面: 8×8 グリッド。Unicode 駒（♔♕♖♗♘♙ / ♚♛♜♝♞♟）をマス中央に配置
  - マス色: 白 `#f0d9b5` / 黒 `#b58863`（チェス定番配色）
- 最善手エリア: 「最善手を表示」ボタン
  - クリック後、ブラウザ内 stockfish.js に `position fen <FEN>` + `go depth 15` を送信
  - 計算中は「思考中…」表示
  - 完了後: `最善手: <SAN>（評価値 <cp or mate>、深さ <depth>）` を表示
- フッター: 「次のランダム局面」ボタン（`GET /` へ遷移）

### 6.3 操作方法

1. ページを開くとランダムな途中盤面（6〜20 手経過）が表示される
2. 「最善手を表示」をクリック
3. ブラウザ内で Stockfish が depth 15 で探索
4. 最善手（SAN）＋評価値＋深さが表示される
5. 「次のランダム局面」で新しい局面へ

## 7. API 仕様

### 7.1 エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/` | 新規ランダム局面ページ（6〜20 手のランダム自己対局結果） |
| GET | `/?fen=<FEN>` | 指定 FEN の局面ページ（再現・共有用。FEN の妥当性は chess.js で検証し、不正なら新規ランダム局面にフォールバック） |

### 7.2 局面生成アルゴリズム

1. chess.js で初期局面を用意
2. ランダムに 6〜20 手の整数 N を選ぶ
3. 各手番で合法手一覧から均等ランダムに 1 手選んで進める
4. ゲーム終了（チェックメイト・ステイルメイト・ドロー）に達したら即リセットしてやり直す
5. N 手進んだ時点の FEN を取得してページに埋め込む

### 7.3 クライアント側 Stockfish 連携

1. ページ読み込み時に stockfish.js（WASM）を初期化
2. 「最善手を表示」クリック時:
   - `uci` / `isready` で初期化完了を確認（初回のみ）
   - `position fen <FEN>`
   - `go depth 15`
3. `info depth ... score cp|mate ...` を逐次受信し、最終的に `bestmove <UCI>` を受信
4. UCI 指し手を SAN に変換して表示（変換は chess.js で行う。クライアントにも chess.js を配布する）
5. 評価値は最後に受信した `score cp`（or `mate N`）を表示。先手視点の符号は chess.js の標準に従う

## 8. データモデル / 状態

- サーバー側に状態を保持しない
- 局面は URL クエリ（`?fen=`）とページ内埋め込みの FEN テキストで表現
- Stockfish のインスタンスはブラウザ内に保持（ページ遷移で再初期化）

## 9. エラーハンドリング

| 事象 | 動作 |
|------|------|
| `?fen=` が不正な FEN | 新規ランダム局面ページを返す |
| 局面生成中にゲーム終了 | 生成をやり直す |
| Stockfish WASM 初期化失敗 | 「エンジンを初期化できませんでした」と表示 |
| その他サーバーエラー | 500 + シンプルなエラーページ |

## 10. ローカル開発・デプロイ

### 10.1 セットアップ

```bash
npm install
```

### 10.2 ローカル開発

DB を使わないため local モードで動作する。

```bash
npm run dev   # wrangler dev
```

ブラウザで `http://127.0.0.1:8787/` を開く。

### 10.3 デプロイ

```bash
npx wrangler login
npx wrangler deploy
```

## 11. 今後の拡張

- 局面フィルタ（互角局面のみ採用など）
- クイズ形式（ユーザーが指して答え合わせ）
- 候補手一覧・PV 表示
- 最善手を指して盤面を進める機能
