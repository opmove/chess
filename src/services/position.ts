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

export function generateRandomFen(): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    const chess = new Chess();
    const plies = randomGamePlies();
    let completed = true;

    for (let i = 0; i < plies; i++) {
      if (chess.isGameOver()) {
        completed = false;
        break;
      }
      const moves = chess.moves();
      if (moves.length === 0) {
        completed = false;
        break;
      }
      chess.move(moves[randomInt(0, moves.length - 1)]);
    }

    if (completed && !chess.isGameOver()) {
      return chess.fen();
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
