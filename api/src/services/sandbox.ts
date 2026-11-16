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
    constructor(
        private content: ContentAdapter,
        private runtime: SandboxRuntime
    ) {}

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
            return { kind: "ok", status: { running: true, challengeId, thisChallenge: true } };
        } catch (err) {
            return this.mapError(err);
        }
    }

    async stop(): Promise<SandboxResult> {
        try {
            await this.removeAll();
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

    private async removeAll(): Promise<void> {
        const sessions = await this.runtime.listSessions();
        for (const session of sessions) {
            await this.runtime.removeSession(session.id);
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
