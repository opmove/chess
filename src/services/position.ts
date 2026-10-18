import { Chess } from "chess.js";

const MIN_PLIES = 6;
const MAX_PLIES = 20;

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomGamePlies(): number {
  return randomInt(MIN_PLIES, MAX_PLIES);
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
    return new Chess(fen).fen();
  } catch {
    return null;
  }
}
