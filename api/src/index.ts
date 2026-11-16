import { serve } from "@hono/node-server";
import { createApp } from "./routes/index.js";
import { openDb } from "./db.js";
import { loadConfig } from "./config.js";
import { DiskContentAdapter } from "./adapters/content.js";
import { SqliteProgressAdapter } from "./adapters/progress.js";
import { DockerSandboxRuntime } from "./adapters/sandbox.js";
import { ChallengesService } from "./services/challenges.js";
import { FlagsService } from "./services/flags.js";
import { AuthService } from "./services/auth.js";
import { SandboxService } from "./services/sandbox.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let config;
try {
    config = loadConfig();
} catch (err) {
    console.error(`Cannot start: ${(err as Error).message}`);
    process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const db = openDb();
const content = new DiskContentAdapter(process.env.CONTENT_DIR || resolve(root, "content"));
const progress = new SqliteProgressAdapter(db);
const service = new ChallengesService(content, progress);
const flags = new FlagsService(content, progress);
const auth = new AuthService(config.appPassword);
const sandboxRuntime = new DockerSandboxRuntime({
    socketPath: config.dockerSocket,
    memoryMb: config.sandboxMemoryMb,
    cpus: config.sandboxCpus,
    pids: config.sandboxPids,
});
const sandbox = new SandboxService(content, sandboxRuntime);

const app = createApp({ db, service, flags, auth, sandbox, config });

const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
});
