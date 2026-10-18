import { Chess } from "chess.js";

const MIN_PLIES = 6;
const MAX_PLIES = 20;

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomGamePlies(): number {
  // 偶数手にすると手番が White に戻る
  return randomInt(MIN_PLIES / 2, MAX_PLIES / 2) * 2;
}

export type Position = {
  fen: string;
  /** 直前の手（UCI: e2e4 など）。不明なら null */
  lastMove: string | null;
};

export function generateRandomPosition(): Position {
  for (let attempt = 0; attempt < 100; attempt++) {
    const chess = new Chess();
    const plies = randomGamePlies();
    let completed = true;
    let lastMove: string | null = null;

    for (let i = 0; i < plies; i++) {
      if (chess.isGameOver()) {
        completed = false;
        break;
      }
      const moves = chess.moves({ verbose: true });
      if (moves.length === 0) {
        completed = false;
        break;
      }
      const move = moves[randomInt(0, moves.length - 1)];
      chess.move(move);
      lastMove = move.from + move.to;
    }

    if (completed && !chess.isGameOver()) {
      return { fen: chess.fen(), lastMove };
    }
  }
  throw new Error("failed to generate a random position");
}

export function validateFen(fen: string): string | null {
  try {
    const chess = new Chess(fen);
    // White to move の局面のみ受け付ける
    if (chess.turn() !== "w") return null;
    return chess.fen();
  } catch {
    return null;
  }
}

// "e2e4" 形式の直前手指し手を検証する（表示用のため形式チェックのみ）
export function validateLastMove(_fen: string, lastMove: string): string | null {
  if (!/^[a-h][1-8][a-h][1-8]$/.test(lastMove)) return null;
  if (lastMove.slice(0, 2) === lastMove.slice(2, 4)) return null;
  return lastMove;
}

export type CastlingStatus = {
  /** FEN のキャスリング権フィールド（"-" の場合は権利なし） */
  rights: string;
  /** 現在の局面で合法手として指せるか（王の安全・通過路・間のマスを含む実際の判定） */
  currentlyLegal: { whiteShort: boolean; whiteLong: boolean; blackShort: boolean; blackLong: boolean };
};

export function getCastlingStatus(fen: string): CastlingStatus | null {
  try {
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    const rights = fen.split(" ")[2] ?? "-";
    return {
      rights,
      currentlyLegal: {
        whiteShort: moves.some((m) => m.color === "w" && m.flags === "k"),
        whiteLong: moves.some((m) => m.color === "w" && m.flags === "q"),
        blackShort: moves.some((m) => m.color === "b" && m.flags === "k"),
        blackLong: moves.some((m) => m.color === "b" && m.flags === "q"),
      },
    };
  } catch {
    return null;
  }
}
