import { serve } from "@hono/node-server";
import { createApp } from "./routes/index.js";
import { openDb } from "./db.js";
import { DiskContentAdapter } from "./adapters/content.js";
import { ChallengesService } from "./services/challenges.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const db = openDb();
const content = new DiskContentAdapter(process.env.CONTENT_DIR || resolve(root, "content"));
const service = new ChallengesService(content);

const app = createApp({ db, service });

const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
});
