import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import type Database from "better-sqlite3";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ChallengesService } from "../services/challenges.js";
import { FlagsService } from "../services/flags.js";
import { Layout } from "../views/layout.js";
import { ModuleList } from "../views/module-list.js";
import { ChallengePage, NotFound } from "../views/challenge-page.js";
import { FlagResult } from "../views/flag-result.js";

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../public");

export function createApp(opts: {
    db: Database.Database;
    service: ChallengesService;
    flags: FlagsService;
}) {
    const app = new Hono();

    app.use("/static/*", serveStatic({ root: publicDir, rewriteRequestPath: (path) => path.replace(/^\/static/, "") }));

    app.get("/api/progress", (c) => {
        return c.json(opts.db.prepare("select * from progress").all());
    });

    app.get("/", (c) => {
        const { modules, broken } = opts.service.list();
        return c.html(<Layout><ModuleList modules={modules} broken={broken} /></Layout>);
    });

    app.get("/challenges/:id", (c) => {
        const id = c.req.param("id");
        const outcome = opts.service.getChallenge(id);
        if (outcome.kind === "notFound") {
            return c.html(<Layout><NotFound /></Layout>, 404);
        }
        if (outcome.kind === "broken") {
            return c.html(
                <Layout><ChallengePage broken={outcome.broken} /></Layout>,
                200
            );
        }
        return c.html(<Layout><ChallengePage challenge={outcome.challenge} /></Layout>);
    });

    app.post("/challenges/:id/flag", async (c) => {
        const body = await c.req.parseBody();
        const submitted = typeof body.flag === "string" ? body.flag : "";
        const result = opts.flags.submit(c.req.param("id"), submitted);
        // Always 200: htmx does not swap 4xx responses.
        return c.html(<FlagResult result={result} />);
    });

    return app;
}
