import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public");
mkdirSync(out, { recursive: true });

const files = [
  ["node_modules/stockfish.js/stockfish.js", "stockfish.js"],
  ["node_modules/stockfish.js/stockfish.wasm", "stockfish.wasm"],
  ["node_modules/chess.js/dist/esm/chess.js", "chess.js"],
];

for (const [src, dest] of files) {
  copyFileSync(join(root, src), join(out, dest));
  console.log(`copied ${src} -> public/${dest}`);
}
