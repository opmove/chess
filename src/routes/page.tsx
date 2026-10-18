import { Hono } from "hono";
import { Bindings } from "../types";
import { generateRandomFen, validateFen } from "../services/position";
import { BoardPage } from "../components/BoardPage";

export const page = new Hono<{ Bindings: Bindings }>();

page.get("/", (c) => {
  const requested = c.req.query("fen");
  const fen = requested ? validateFen(requested) ?? generateRandomFen() : generateRandomFen();
  return c.html(<BoardPage fen={fen} />);
});
