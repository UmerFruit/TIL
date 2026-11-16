import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { openDb } from "./db.js";

const app = new Hono();
const db = openDb();

app.get("/", (c) => c.text("TIL"));

app.get("/api/progress", (c) => {
    return c.json(db.prepare("select * from progress").all());
});

const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
});
