import { createHash, timingSafeEqual } from "node:crypto";
import type { ContentAdapter } from "../adapters/content.js";
import type { ProgressAdapter } from "../adapters/progress.js";

export type SubmitResult =
    | { kind: "correct"; points: number }
    | { kind: "alreadySolved" }
    | { kind: "wrong" }
    | { kind: "notFound" }
    | { kind: "broken" };

const MAX_LENGTH = 200;

function hash(value: string): Buffer {
    return createHash("sha256").update(value).digest();
}

function sameFlag(a: string, b: string): boolean {
    return timingSafeEqual(hash(a), hash(b));
}

export class FlagsService {
    constructor(
        private content: ContentAdapter,
        private progress: ProgressAdapter
    ) {}

    submit(challengeId: string, submitted: string): SubmitResult {
        const found = this.content.findChallenge(challengeId);
        if (found === null) {
            return { kind: "notFound" };
        }
        if ("broken" in found) {
            return { kind: "broken" };
        }

        const trimmed = submitted.trim();
        if (trimmed.length > MAX_LENGTH || !sameFlag(trimmed, found.challenge.flag)) {
            return { kind: "wrong" };
        }

        if (this.progress.isSolved(challengeId)) {
            return { kind: "alreadySolved" };
        }

        const points = found.challenge.tier;
        const solvedAt = new Date().toISOString();
        if (!this.progress.markSolved(challengeId, points, solvedAt)) {
            return { kind: "alreadySolved" };
        }
        return { kind: "correct", points };
    }
}
