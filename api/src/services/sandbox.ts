import type { ContentAdapter } from "../adapters/content.js";
import type { SandboxRuntime } from "../adapters/sandbox.js";
import { SandboxError } from "../adapters/sandbox.js";


export interface SandboxStatus {
    running: boolean;
    challengeId: string | null;
    thisChallenge: boolean;
}

export type SandboxResult =
    | { kind: "ok"; status: SandboxStatus }
    | { kind: "dockerUnavailable" }
    | { kind: "imageMissing"; message: string }
    | { kind: "broken"; message: string }
    | { kind: "notFound" };

const STOPPED: SandboxStatus = { running: false, challengeId: null, thisChallenge: false };

export class SandboxService {
    private lastActivity: number | null = null;
    private janitorTimer: NodeJS.Timeout | null = null;

    constructor(
        private content: ContentAdapter,
        private runtime: SandboxRuntime,
        private idleMinutes: number,
        private janitorSeconds: number
    ) {
        this.startJanitor();
    }

    async start(challengeId: string): Promise<SandboxResult> {
        const content = this.content.readSandboxFiles(challengeId);
        if (content === null) {
            return { kind: "notFound" };
        }
        if ("broken" in content) {
            return { kind: "broken", message: content.error };
        }
        try {
            // One session at a time: drop whatever is running first.
            await this.removeAll();
            await this.runtime.createSession({
                challengeId,
                image: content.image,
                files: content.files,
            });
            this.lastActivity = Date.now();
            return { kind: "ok", status: { running: true, challengeId, thisChallenge: true } };
        } catch (err) {
            return this.mapError(err);
        }
    }

    async reset(challengeId: string): Promise<SandboxResult> {
        const content = this.content.readSandboxFiles(challengeId);
        if (content === null) {
            return { kind: "notFound" };
        }
        if ("broken" in content) {
            return { kind: "broken", message: content.error };
        }
        try {
            await this.removeAll();
            await this.runtime.createSession({
                challengeId,
                image: content.image,
                files: content.files,
            });
            this.lastActivity = Date.now();
            return { kind: "ok", status: { running: true, challengeId, thisChallenge: true } };
        } catch (err) {
            return this.mapError(err);
        }
    }

    async stop(): Promise<SandboxResult> {
        try {
            await this.removeAll();
            this.lastActivity = null;
            return { kind: "ok", status: STOPPED };
        } catch (err) {
            return this.mapError(err);
        }
    }

    async status(challengeId: string): Promise<SandboxResult> {
        try {
            const sessions = await this.runtime.listSessions();
            const session = sessions[0];
            if (!session) {
                return { kind: "ok", status: STOPPED };
            }
            return {
                kind: "ok",
                status: {
                    running: true,
                    challengeId: session.challengeId,
                    thisChallenge: session.challengeId === challengeId,
                },
            };
        } catch (err) {
            return this.mapError(err);
        }
    }

    touch(): void {
        this.lastActivity = Date.now();
    }

    private async removeAll(): Promise<void> {
        const sessions = await this.runtime.listSessions();
        for (const session of sessions) {
            await this.runtime.removeSession(session.id);
        }
    }

    private startJanitor(): void {
        this.janitorTimer = setInterval(() => {
            if (this.lastActivity === null) {
                return;
            }
            const idleMs = Date.now() - this.lastActivity;
            const idleMinutes = idleMs / 60000;
            if (idleMinutes > this.idleMinutes) {
                console.log(`[sandbox] idle timeout (${idleMinutes.toFixed(1)} min > ${this.idleMinutes} min), removing session`);
                this.removeAll().catch((err) => {
                    console.error(`[sandbox] failed to remove idle session: ${err}`);
                });
                this.lastActivity = null;
            }
        }, this.janitorSeconds * 1000);
        this.janitorTimer.unref();
    }

    async cleanupLeftovers(): Promise<number> {
        try {
            const sessions = await this.runtime.listSessions();
            for (const session of sessions) {
                await this.runtime.removeSession(session.id);
            }
            if (sessions.length > 0) {
                console.log(`[sandbox] startup cleanup: removed ${sessions.length} leftover container(s)`);
            }
            return sessions.length;
        } catch (err) {
            if (err instanceof SandboxError && err.kind === "dockerUnavailable") {
                console.warn(`[sandbox] startup cleanup: Docker unavailable, skipping`);
                return 0;
            }
            console.error(`[sandbox] startup cleanup failed: ${err}`);
            return 0;
        }
    }

    private mapError(err: unknown): SandboxResult {
        if (err instanceof SandboxError) {
            if (err.kind === "dockerUnavailable") {
                return { kind: "dockerUnavailable" };
            }
            if (err.kind === "imageMissing") {
                return { kind: "imageMissing", message: err.message };
            }
            return { kind: "broken", message: err.message };
        }
        return { kind: "broken", message: (err as Error)?.message ?? String(err) };
    }
}
