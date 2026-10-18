import type { FC } from "hono/jsx";
import { getCastlingStatus } from "../services/position";

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

// 1 手を人間が読みやすいテキストに変換する（例: "♞がa3の♙を取り、チェック"）
function moveToText(m) {
  const glyphs = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
  const names = { q: "クイーン", r: "ルーク", b: "ビショップ", n: "ナイト" };
  const isCheck = m.san.endsWith("+");
  const isMate = m.san.endsWith("#");
  const suffix = isMate ? "、チェックメイト" : isCheck ? "、チェック" : "";
  if (m.flags.includes("k")) return "ショートキャスリング" + suffix;
  if (m.flags.includes("q")) return "ロングキャスリング" + suffix;
  let text = glyphs[m.piece] + "が" + m.to;
  if (m.flags.includes("e")) {
    text += "でアンパッサン";
  } else if (m.captured) {
    text += "の" + glyphs[m.captured] + "を取り";
  } else {
    text += "に動き";
  }
  if (m.promotion) text += "、" + names[m.promotion] + "に昇進";
  return text + suffix;
}

// PV（UCI 列）を読み筋テキストに変換する
function pvToSanText(pv) {
  const chess = fenChess;
  chess.reset();
  chess.load(FEN);
  const texts = [];
  for (const uci of pv.split(/\s+/)) {
    if (!uci || uci === "(none)") break;
    try {
      const isWhiteMove = chess.turn() === "w";
      const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4, 5) || undefined });
      if (!m) break;
      const num = Math.floor(texts.length / 2) + 1;
      texts.push((isWhiteMove ? num + ". " : "") + moveToText(m));
    } catch (e) {
      break;
    }
  }
  return texts.join(" ");
}

// 「なぜ最善か」の簡易注釈を生成する
function buildReason(info) {
  const parts = [];
  const san0 = uciToSan(info.best);
  if (san0 === "O-O" || san0 === "O-O-O") {
    if (san0 === "O-O") parts.push("キャスリング（ショート）。王の安全を確保しルークを活性化できる");
    else parts.push("キャスリング（ロング）。王の安全を確保しルークを活性化できる");
  }
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
  if (parts.length) parts.push("読み筋:");
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
    if (info.pvText) {
      const pvEl = document.createElement("div");
      pvEl.className = "pv";
      // 1 手番（白+黒）ごとに改行して表示
      pvEl.textContent = info.pvText.replace(/(\d+\. [^ ]+ [^ ]+) /g, "$1\n").trim();
      resultEl.appendChild(pvEl);
    }
  } catch (err) {
    console.error(err);
    resultEl.textContent = "エンジンを初期化できませんでした";
  } finally {
    btn.disabled = false;
  }
});
`;

const FILES = "abcdefgh";

const Board: FC<{ fen: string; lastMove: string | null }> = ({ fen, lastMove }) => {
  const fields = fen.split(" ");
  const placement = fields[0];
  const epSquare = fields[3] && fields[3] !== "-" ? fields[3] : null;
  const rights = fields[2] ?? "-";
  // キャスリング権のあるマス（e1/h1/a1, e8/h8/a8）と、そのサイドが現在着手可能か
  const castle = getCastlingStatus(fen);
  const castleMark = new Map<string, boolean>();
  if (castle) {
    if (rights.includes("K")) { castleMark.set("e1", (castleMark.get("e1") ?? false) || castle.currentlyLegal.whiteShort); castleMark.set("h1", castle.currentlyLegal.whiteShort); }
    if (rights.includes("Q")) { castleMark.set("e1", (castleMark.get("e1") ?? false) || castle.currentlyLegal.whiteLong); castleMark.set("a1", castle.currentlyLegal.whiteLong); }
    if (rights.includes("k")) { castleMark.set("e8", (castleMark.get("e8") ?? false) || castle.currentlyLegal.blackShort); castleMark.set("h8", castle.currentlyLegal.blackShort); }
    if (rights.includes("q")) { castleMark.set("e8", (castleMark.get("e8") ?? false) || castle.currentlyLegal.blackLong); castleMark.set("a8", castle.currentlyLegal.blackLong); }
  }
  const lmFrom = lastMove ? lastMove.slice(0, 2) : null;
  const lmTo = lastMove ? lastMove.slice(2, 4) : null;
  const ranks = placement.split("/");
  const squares: ReturnType<FC>[] = [];
  for (let r = 0; r < 8; r++) {
    let file = 0;
    const renderSquare = (piece?: string) => {
      const isLight = (file + r) % 2 === 1;
      const sq = FILES[file] + (8 - r);
      const classes = ["square", isLight ? "light" : "dark"];
      if (sq === lmFrom || sq === lmTo) classes.push("lm");
      if (sq === epSquare) classes.push("ep");
      const castleLegal = castleMark.get(sq);
      if (castleMark.has(sq)) classes.push(castleLegal ? "castle-ok" : "castle-rights");
      squares.push(
        <div
          key={sq}
          data-sq={sq}
          class={classes.join(" ")}
          title={
            sq === epSquare ? "直前にポーンが2マス進み、アンパッサンで取れるマス"
            : castleMark.has(sq) ? (castleLegal ? "キャスリング可能（発動条件を満たす）" : "キャスリング権はあるが、現在は発動条件を満たさない（王の通過路の攻撃・間のマス等）")
            : undefined
          }
        >
          {piece ? <span class="piece">{PIECES[piece]}</span> : null}
          {file === 0 ? <span class="coord rank">{8 - r}</span> : null}
          {r === 7 ? <span class="coord file">{FILES[file]}</span> : null}
          {sq === epSquare ? <span class="ep-dot" /> : null}
          {castleMark.has(sq) ? <span class="castle-mark">{castleLegal ? "○" : "△"}</span> : null}
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

export const BoardPage: FC<{ fen: string; lastMove?: string | null }> = ({ fen, lastMove = null }) => {
  const turn = fen.split(" ")[1] === "b" ? "Black to move" : "White to move";
  const castle = getCastlingStatus(fen);
  const castleSummary = (() => {
    if (!castle || castle.rights === "-") return null;
    const parts: string[] = [];
    if (castle.currentlyLegal.whiteShort) parts.push("白ショート○");
    else if (castle.rights.includes("K")) parts.push("白ショート△（権利のみ）");
    if (castle.currentlyLegal.whiteLong) parts.push("白ロング○");
    else if (castle.rights.includes("Q")) parts.push("白ロング△（権利のみ）");
    if (castle.currentlyLegal.blackShort) parts.push("黒ショート○");
    else if (castle.rights.includes("k")) parts.push("黒ショート△（権利のみ）");
    if (castle.currentlyLegal.blackLong) parts.push("黒ロング○");
    else if (castle.rights.includes("q")) parts.push("黒ロング△（権利のみ）");
    return "キャスリング: " + (parts.length ? parts.join(" / ") : "権利なし");
  })();
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
          .castle-summary { font-size: 0.8rem; color: #2a7d2a; margin-bottom: 4px; }
          .fen {
            font-family: monospace;
            font-size: 0.75rem;
            word-break: break-all;
            color: #555;
          }
          .board {
            display: grid;
            grid-template-columns: repeat(8, 1fr);
            grid-template-rows: repeat(8, 1fr);
            width: 100%;
            aspect-ratio: 1;
            border: 2px solid #666;
            margin-bottom: 12px;
          }
          .square {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: clamp(18px, 7vw, 36px);
            line-height: 1;
          }
          .light { background: #f0d9b5; }
          .dark { background: #b58863; }
          .square.hl { box-shadow: inset 0 0 0 100px rgba(0, 180, 0, 0.45); }
          .square.lm { box-shadow: inset 0 0 0 100px rgba(255, 213, 79, 0.55); }
          /* 直前手（黄）と最善手（緑）が重なった場合は最善手を優先 */
          .square.lm.hl { box-shadow: inset 0 0 0 100px rgba(0, 180, 0, 0.45); }
          .square.ep { position: relative; }
          .ep-dot {
            position: absolute;
            bottom: 4%;
            right: 6%;
            width: 18%;
            height: 18%;
            border-radius: 50%;
            background: rgba(0, 120, 255, 0.8);
          }
          .coord {
            position: absolute;
            font-size: clamp(8px, 2.5vw, 12px);
            line-height: 1;
            color: rgba(0, 0, 0, 0.55);
            font-weight: bold;
            pointer-events: none;
          }
          .coord.rank { top: 2%; left: 3%; }
          .coord.file { bottom: 2%; right: 4%; }
          .light .coord { color: rgba(0, 0, 0, 0.45); }
          .dark .coord { color: rgba(255, 255, 255, 0.7); }
          .castle-mark {
            position: absolute;
            top: 2%;
            left: 4%;
            font-size: clamp(10px, 3vw, 16px);
            line-height: 1;
            color: #fff;
            text-shadow: 0 0 2px #000;
          }
          .castle-ok { box-shadow: inset 0 0 0 100px rgba(0, 180, 0, 0.25); }
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
          #result .pv {
            margin-top: 8px;
            font-size: 1.1rem;
            line-height: 1.8;
            white-space: pre-line;
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
            {castleSummary ? <div class="castle-summary">{castleSummary}</div> : null}
            <div class="fen">{fen}</div>
          </div>
          <Board fen={fen} lastMove={lastMove} />
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
