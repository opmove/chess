import { Hono } from "hono";
import { Bindings } from "../types";
import { generateRandomPosition, validateFen, validateLastMove } from "../services/position";
import { BoardPage } from "../components/BoardPage";

export const page = new Hono<{ Bindings: Bindings }>();

page.get("/", (c) => {
  const requested = c.req.query("fen");
  let position = generateRandomPosition();
  if (requested) {
    const fen = validateFen(requested);
    if (fen) {
      const lastMoveQuery = c.req.query("lastmove");
      const lastMove = lastMoveQuery ? validateLastMove(fen, lastMoveQuery) : null;
      position = { fen, lastMove };
    }
  }
  return c.html(<BoardPage fen={position.fen} lastMove={position.lastMove} />);
});
