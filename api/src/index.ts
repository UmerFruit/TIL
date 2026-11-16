import { serve } from "@hono/node-server";
import { WebSocketServer, WebSocket } from "ws";
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
import { verifySessionCookie } from "./session.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";

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
const sandbox = new SandboxService(content, sandboxRuntime, config.sandboxIdleMinutes, config.sandboxJanitorSeconds);

// Startup cleanup: remove leftover containers labeled til.session=1
await sandbox.cleanupLeftovers();

const app = createApp({ db, service, flags, auth, sandbox, config });

const port = Number(process.env.PORT) || 3000;
const server = serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
});

// WebSocket server for terminal
const wss = new WebSocketServer({ noServer: true });

interface ExecHandle {
    socket: Duplex;
    resize: (cols: number, rows: number) => Promise<void>;
    close: () => Promise<void>;
}

server.on("upgrade", async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    if (url.pathname !== "/ws") {
        socket.destroy();
        return;
    }

    // (a) Valid session cookie
    const cookieHeader = req.headers.cookie;
    const hasValidSession = await verifySessionCookie(cookieHeader, config.sessionSecret);
    if (!hasValidSession) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
    }

    // (b) Origin header must match Host header (CSRF protection for WS)
    const origin = req.headers.origin;
    const host = req.headers.host;
    if (!origin || !host) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
    }
    const originHost = new URL(origin).host;
    if (originHost !== host) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
    }

    // (c) Attach to the single current session
    const execResult = await sandbox.exec();
    if (execResult.kind === "noSession") {
        socket.write("HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\n\r\nno session");
        socket.destroy();
        return;
    }
    if (execResult.kind === "broken") {
        socket.write(`HTTP/1.1 500 Internal Server Error\r\nContent-Type: text/plain\r\n\r\n${execResult.message}`);
        socket.destroy();
        return;
    }

    // Upgrade to WebSocket
    wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        wss.emit("connection", ws, req, execResult.exec);
    });
});

wss.on("connection", (ws: WebSocket, req: IncomingMessage, exec: ExecHandle) => {
    const { socket, resize, close } = exec;

    // Pipe WebSocket messages to container exec
    ws.on("message", (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
        if (isBinary) {
            // Binary data from client (shouldn't happen for input, but handle it)
            const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
            socket.write(buf);
        } else {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === "input" && typeof msg.data === "string") {
                    sandbox.touch(); // Push back idle timeout
                    socket.write(msg.data);
                } else if (msg.type === "resize" && typeof msg.cols === "number" && typeof msg.rows === "number") {
                    resize(msg.cols, msg.rows).catch((err: Error) => {
                        console.error(`[terminal] resize failed: ${err}`);
                    });
                }
            } catch {
                // Ignore invalid JSON
            }
        }
    });

    // Pipe container output to WebSocket
    socket.on("data", (data: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        }
    });

    socket.on("end", () => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.close(1000, "exec ended");
        }
    });

    socket.on("error", (err: Error) => {
        console.error(`[terminal] exec stream error: ${err}`);
        if (ws.readyState === WebSocket.OPEN) {
            ws.close(1011, "exec error");
        }
    });

    ws.on("close", async () => {
        // Clean up: close the exec process, but NOT the container
        await close().catch((err: Error) => {
            console.error(`[terminal] exec close failed: ${err}`);
        });
        socket.destroy();
    });

    ws.on("error", (err: Error) => {
        console.error(`[terminal] WebSocket error: ${err}`);
    });
});