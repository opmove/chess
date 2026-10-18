import type { FC } from "hono/jsx";

const PIECES: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

const clientScript = String.raw`
const FEN = document.getElementById("app").dataset.fen;
const resultEl = document.getElementById("result");
const btn = document.getElementById("show-best");
let worker = null;
let fenChess = null;

async function loadChessJs() {
  if (!fenChess) {
    const mod = await import("/chess.js");
    fenChess = new mod.Chess(FEN);
  }
  return fenChess;
}

function uciToSan(uci) {
  const chess = fenChess;
  chess.reset();
  chess.load(FEN);
  const move = chess.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.slice(4, 5) || undefined,
  });
  return move ? move.san : uci;
}

function highlightSquares(from, to) {
  document.querySelectorAll(".square.hl").forEach((el) => el.classList.remove("hl"));
  for (const sq of [from, to]) {
    const el = document.querySelector('.square[data-sq="' + sq + '"]');
    if (el) el.classList.add("hl");
  }
}

// PV（UCI 列）を SAN の読み筋テキストに変換する
function pvToSanText(pv) {
  const chess = fenChess;
  chess.reset();
  chess.load(FEN);
  const sans = [];
  for (const uci of pv.split(/\s+/)) {
    if (!uci || uci === "(none)") break;
    try {
      const isWhiteMove = chess.turn() === "w";
      const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4, 5) || undefined });
      if (!m) break;
      const num = Math.floor(sans.length / 2) + 1;
      sans.push((isWhiteMove ? num + ". " : "") + m.san);
    } catch (e) {
      break;
    }
  }
  return sans.join(" ");
}

// 「なぜ最善か」の簡易注釈を生成する
function buildReason(info) {
  const parts = [];
  const mateMatch = info.scoreText.match(/mate (-?\d+)/);
  if (mateMatch) {
    const n = Math.abs(Number(mateMatch[1]));
    parts.push(n + " 手で詰ませる強制手順");
  } else {
    const chess = fenChess;
    chess.reset();
    chess.load(FEN);
    let captured = null;
    try {
      const m = chess.move({ from: info.best.slice(0, 2), to: info.best.slice(2, 4), promotion: info.best.slice(4, 5) || undefined });
      if (m && m.captured) captured = m.captured;
    } catch (e) { /* ignore */ }
    if (captured) {
      const names = { p: "ポーン", n: "ナイト", b: "ビショップ", r: "ルーク", q: "クイーン" };
      parts.push(names[captured] + "を取る駒得の手");
    }
    const cpMatch = info.scoreText.match(/cp (-?\d+)/);
    if (cpMatch) {
      const cp = Number(cpMatch[1]);
      if (cp >= 200) parts.push("白が約 " + Math.round(cp / 100) + " ポーン優勢になる");
    }
  }
  if (info.pvText) parts.push("読み筋: " + info.pvText);
  return parts.length ? parts.join("。") : "探索上もっとも評価値が高い手";
}

function initWorker() {
  return new Promise((resolve, reject) => {
    try {
      const w = new Worker("/stockfish.js");
      const timer = setTimeout(() => reject(new Error("timeout")), 15000);
      w.onmessage = (e) => {
        if (e.data === "uciok" || String(e.data).startsWith("uciok")) {
          clearTimeout(timer);
          w.isready = true;
          w.onmessage = null;
          resolve(w);
        }
      };
      w.postMessage("uci");
    } catch (err) {
      reject(err);
    }
  });
}

btn.addEventListener("click", async () => {
  btn.disabled = true;
  resultEl.textContent = "思考中…";
  try {
    if (!worker) worker = await initWorker();
    await loadChessJs();

    const info = await new Promise((resolve, reject) => {
      let last = { depth: 0, scoreText: "", pv: "" };
      worker.onmessage = (e) => {
        const line = String(e.data);
        if (line.startsWith("info depth")) {
          const d = line.match(/ depth (\d+)/);
          const cp = line.match(/score cp (-?\d+)/);
          const mate = line.match(/score mate (-?\d+)/);
          const pv = line.match(/ pv (.+)$/);
          if (d) {
            last.depth = Number(d[1]);
            if (mate) last.scoreText = "mate " + mate[1];
            else if (cp) last.scoreText = "cp " + cp[1];
            if (pv) last.pv = pv[1];
          }
        } else if (line.startsWith("bestmove")) {
          resolve({ best: line.split(/\s+/)[1], ...last });
        }
      };
      worker.postMessage("position fen " + FEN);
      worker.postMessage("go depth 15");
      setTimeout(() => reject(new Error("timeout")), 120000);
    });

    const san = uciToSan(info.best);
    highlightSquares(info.best.slice(0, 2), info.best.slice(2, 4));
    info.pvText = pvToSanText(info.pv);
    const score = info.scoreText ? info.scoreText : "不明";
    const reason = buildReason(info);
    resultEl.innerHTML = "";
    const line1 = document.createElement("div");
    line1.textContent = "最善手: " + san + "（評価値 " + score + "、深さ " + info.depth + "）";
    const line2 = document.createElement("div");
    line2.className = "reason";
    line2.textContent = "理由: " + reason;
    resultEl.appendChild(line1);
    resultEl.appendChild(line2);
  } catch (err) {
    console.error(err);
    resultEl.textContent = "エンジンを初期化できませんでした";
  } finally {
    btn.disabled = false;
  }
});
`;

const FILES = "abcdefgh";

const Board: FC<{ fen: string }> = ({ fen }) => {
  const placement = fen.split(" ")[0];
  const ranks = placement.split("/");
  const squares: ReturnType<FC>[] = [];
  for (let r = 0; r < 8; r++) {
    let file = 0;
    const renderSquare = (piece?: string) => {
      const isLight = (file + r) % 2 === 1;
      const sq = FILES[file] + (8 - r);
      squares.push(
        <div key={sq} data-sq={sq} class={"square " + (isLight ? "light" : "dark")}>
          {piece ? <span class="piece">{PIECES[piece]}</span> : null}
        </div>,
      );
      file++;
    };
    for (const ch of ranks[r]) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < Number(ch); i++) renderSquare();
      } else {
        renderSquare(ch);
      }
    }
  }
  return <div class="board">{squares}</div>;
};

export const BoardPage: FC<{ fen: string }> = ({ fen }) => {
  const turn = fen.split(" ")[1] === "b" ? "Black to move" : "White to move";
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>chess</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: system-ui, sans-serif;
            background: #fafafa;
            color: #222;
            max-width: 440px;
            margin: 0 auto;
            padding: 12px;
          }
          header h1 { font-size: 1.4rem; margin-bottom: 8px; }
          .status { margin-bottom: 10px; }
          .turn { font-weight: bold; margin-bottom: 4px; }
          .fen {
            font-family: monospace;
            font-size: 0.75rem;
            word-break: break-all;
            color: #555;
          }
          .board {
            display: grid;
            grid-template-columns: repeat(8, 1fr);
            width: 100%;
            aspect-ratio: 1;
            border: 2px solid #666;
            margin-bottom: 12px;
          }
          .square {
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: clamp(18px, 7vw, 36px);
            line-height: 1;
          }
          .light { background: #f0d9b5; }
          .dark { background: #b58863; }
          .square.hl { box-shadow: inset 0 0 0 100px rgba(0, 180, 0, 0.45); }
          .best-area { margin-bottom: 16px; }
          button {
            font-size: 1rem;
            padding: 8px 16px;
            border: 1px solid #888;
            border-radius: 6px;
            background: #fff;
            cursor: pointer;
          }
          button:disabled { opacity: 0.5; cursor: default; }
          #result { margin-top: 8px; font-weight: bold; }
          #result .reason {
            margin-top: 4px;
            font-weight: normal;
            font-size: 0.85rem;
            color: #444;
            line-height: 1.5;
          }
          footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; }
        `}</style>
      </head>
      <body>
        <div id="app" data-fen={fen}>
          <header>
            <h1>chess</h1>
          </header>
          <div class="status">
            <div class="turn">{turn}</div>
            <div class="fen">{fen}</div>
          </div>
          <Board fen={fen} />
          <div class="best-area">
            <button id="show-best" type="button">最善手を表示</button>
            <div id="result"></div>
          </div>
          <footer>
            <a href="/"><button type="button">次のランダム局面</button></a>
          </footer>
        </div>
        <script dangerouslySetInnerHTML={{ __html: clientScript }} />
      </body>
    </html>
  );
};
