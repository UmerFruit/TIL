import { Hono, type Context } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { getConnInfo } from "@hono/node-server/conninfo";
import type Database from "better-sqlite3";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Config } from "../config.js";
import { AuthService } from "../services/auth.js";
import { ChallengesService } from "../services/challenges.js";
import { FlagsService } from "../services/flags.js";
import { SandboxService } from "../services/sandbox.js";
import { clearSession, hasSession, setSession } from "../session.js";
import { Layout } from "../views/layout.js";
import { ModuleList } from "../views/module-list.js";
import { ChallengePage, NotFound } from "../views/challenge-page.js";
import { FlagResult } from "../views/flag-result.js";
import { Answer } from "../views/answer.js";
import { Login } from "../views/login.js";
import { Sandbox } from "../views/sandbox.js";

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../public");

function clientIp(c: Context): string {
    try {
        return getConnInfo(c).remote.address ?? "unknown";
    } catch {
        return "unknown";
    }
}

export function createApp(opts: {
    db: Database.Database;
    service: ChallengesService;
    flags: FlagsService;
    auth: AuthService;
    sandbox: SandboxService;
    config: Config;
}) {
    const app = new Hono();

    // Health check (before auth middleware)
    app.get("/health", (c) => c.text("ok"));

    // Everything except the login page, static assets, and health requires a session.
    app.use("*", async (c, next) => {
        const path = c.req.path;
        if (path === "/login" || path.startsWith("/static/") || path === "/health") {
            return next();
        }
        if (await hasSession(c, opts.config.sessionSecret)) {
            return next();
        }
        // htmx would swap the login page into a fragment target; redirect it instead.
        if (c.req.header("HX-Request")) {
            c.header("HX-Redirect", "/login");
            return c.body(null, 401);
        }
        return c.redirect("/login");
    });

    app.use("/static/*", serveStatic({ root: publicDir, rewriteRequestPath: (path) => path.replace(/^\/static/, "") }));

    app.get("/login", (c) => {
        return c.html(<Layout><Login /></Layout>);
    });

    app.post("/login", async (c) => {
        const body = await c.req.parseBody();
        const password = typeof body.password === "string" ? body.password : "";
        const result = opts.auth.login(clientIp(c), password);
        if (result === "ok") {
            await setSession(c, opts.config.sessionSecret, opts.config.cookieSecure);
            return c.redirect("/");
        }
        const error = result === "throttled" ? "Too many attempts" : "Wrong password";
        return c.html(<Layout><Login error={error} /></Layout>);
    });

    app.post("/logout", (c) => {
        clearSession(c);
        return c.redirect("/login");
    });

    app.get("/api/progress", (c) => {
        return c.json(opts.db.prepare("select * from progress").all());
    });

    app.get("/", (c) => {
        const { modules, broken, earnedPoints, totalPoints } = opts.service.list();
        return c.html(
            <Layout authed>
                <ModuleList
                    modules={modules}
                    broken={broken}
                    earnedPoints={earnedPoints}
                    totalPoints={totalPoints}
                />
            </Layout>
        );
    });

    app.get("/challenges/:id", (c) => {
        const id = c.req.param("id");
        const outcome = opts.service.getChallenge(id);
        if (outcome.kind === "notFound") {
            return c.html(<Layout authed><NotFound /></Layout>, 404);
        }
        if (outcome.kind === "broken") {
            return c.html(
                <Layout authed><ChallengePage broken={outcome.broken} /></Layout>,
                200
            );
        }
        return c.html(<Layout authed><ChallengePage challenge={outcome.challenge} /></Layout>);
    });

    app.post("/challenges/:id/flag", async (c) => {
        const body = await c.req.parseBody();
        const submitted = typeof body.flag === "string" ? body.flag : "";
        const challengeId = c.req.param("id");
        const result = opts.flags.submit(challengeId, submitted);
        // Always 200: htmx does not swap 4xx responses.
        if (result.kind === "correct" || result.kind === "alreadySolved") {
            // Right flag: the sandbox is no longer needed, so shut it down and
            // refresh the sandbox controls (out-of-band) to show "stopped".
            const stopped = await opts.sandbox.stop();
            return c.html(
                <>
                    <FlagResult result={result} />
                    <Sandbox result={stopped} challengeId={challengeId} />
                </>
            );
        }
        return c.html(<FlagResult result={result} />);
    });

    app.get("/challenges/:id/answer", (c) => {
        const outcome = opts.service.getGuide(c.req.param("id"));
        return c.html(<Answer outcome={outcome} />);
    });

    app.post("/sandbox/start", async (c) => {
        const body = await c.req.parseBody();
        const challengeId = typeof body.challenge === "string" ? body.challenge : "";
        const result = await opts.sandbox.start(challengeId);
        return c.html(<Sandbox result={result} challengeId={challengeId} />);
    });

    app.post("/sandbox/stop", async (c) => {
        const result = await opts.sandbox.stop();
        return c.html(<Sandbox result={result} challengeId="" />);
    });

    app.post("/sandbox/reset", async (c) => {
        const body = await c.req.parseBody();
        const challengeId = typeof body.challenge === "string" ? body.challenge : "";
        const result = await opts.sandbox.reset(challengeId);
        return c.html(<Sandbox result={result} challengeId={challengeId} />);
    });

    app.get("/sandbox/status", async (c) => {
        const challengeId = c.req.query("challenge") ?? "";
        const result = await opts.sandbox.status(challengeId);
        return c.html(<Sandbox result={result} challengeId={challengeId} />);
    });

    return app;
}
