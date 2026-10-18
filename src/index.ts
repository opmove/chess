import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { Bindings } from "./types";
import { page } from "./routes/page";

const app = new Hono<{ Bindings: Bindings }>();

app.route("/", page);

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.html(
    "<html><head><title>chess</title></head><body><h1>エラー</h1><p>サーバーエラーが発生しました。</p></body></html>",
    500,
  );
});

export default app;
