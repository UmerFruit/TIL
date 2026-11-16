import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import type Database from "better-sqlite3";
import { ChallengesService } from "../services/challenges.js";
import { Layout } from "../views/layout.js";
import { ModuleList } from "../views/module-list.js";

export function createApp(opts: { db: Database.Database; service: ChallengesService }) {
    const app = new Hono();

    app.use("/static/*", serveStatic({ root: "./public", rewriteRequestPath: (path) => path.replace(/^\/static/, "") }));

    app.get("/api/progress", (c) => {
        return c.json(opts.db.prepare("select * from progress").all());
    });

    app.get("/", (c) => {
        const { modules, broken } = opts.service.list();
        return c.html(<Layout><ModuleList modules={modules} broken={broken} /></Layout>);
    });

    return app;
}
