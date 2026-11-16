import type {
    BrokenItem,
    ContentAdapter,
    FoundChallenge,
    ModuleResult,
} from "../adapters/content.js";
import type { ProgressAdapter } from "../adapters/progress.js";

export type { BrokenItem };

export interface ListChallenge {
    id: string;
    title: string;
    tier: number;
    order: number;
    solved: boolean;
}

export interface ListModule {
    id: string;
    title: string;
    description: string;
    order: number;
    challenges: ListChallenge[];
    earnedPoints: number;
    totalPoints: number;
}

export interface ListResult {
    modules: ListModule[];
    broken: BrokenItem[];
    earnedPoints: number;
    totalPoints: number;
}

export interface ChallengeModule {
    id: string;
    title: string;
}

export interface ChallengeDTO {
    id: string;
    title: string;
    module: ChallengeModule;
    tier: number;
    briefing: string;
    links: { type: "doc" | "video"; url: string; label: string }[];
    solved: boolean;
    points: number;
}

export type ChallengeOutcome =
    | { kind: "ok"; challenge: ChallengeDTO }
    | { kind: "broken"; broken: BrokenItem }
    | { kind: "notFound" };

export type GuideOutcome =
    | { kind: "ok"; guide: string }
    | { kind: "noGuide" }
    | { kind: "broken" }
    | { kind: "notFound" };

export class ChallengesService {
    constructor(
        private content: ContentAdapter,
        private progress: ProgressAdapter
    ) {}

    list(): ListResult {
        const modules: ListModule[] = [];
        const broken: BrokenItem[] = [];
        const duplicateIds = this.duplicateIds();
        // One query for all progress; orphan rows simply never match a valid
        // challenge below, so they are ignored.
        const solvedPoints = new Map(
            this.progress.listSolved().map((row) => [row.challengeId, row.points])
        );
        let earnedPoints = 0;
        let totalPoints = 0;

        for (const result of this.content.readModules()) {
            if ("broken" in result) {
                broken.push(result);
                continue;
            }
            const challengeResults = this.content.readChallenges(result.id);
            const challenges: ListChallenge[] = [];
            let moduleEarned = 0;
            let moduleTotal = 0;
            for (const cr of challengeResults) {
                if ("broken" in cr) {
                    broken.push(cr);
                    continue;
                }
                if (duplicateIds.has(cr.id)) {
                    broken.push({
                        broken: true,
                        path: `challenge ${cr.id}`,
                        error: `duplicate id: "${cr.id}"`,
                    });
                    continue;
                }
                const solved = solvedPoints.has(cr.id);
                if (solved) {
                    moduleEarned += solvedPoints.get(cr.id) ?? 0;
                }
                moduleTotal += cr.tier;
                challenges.push({
                    id: cr.id,
                    title: cr.title,
                    tier: cr.tier,
                    order: cr.order,
                    solved,
                });
            }
            challenges.sort((a, b) => a.order - b.order);
            earnedPoints += moduleEarned;
            totalPoints += moduleTotal;
            modules.push({
                id: result.id,
                title: result.title,
                description: result.description,
                order: result.order,
                challenges,
                earnedPoints: moduleEarned,
                totalPoints: moduleTotal,
            });
        }

        modules.sort((a, b) => a.order - b.order);
        return { modules, broken, earnedPoints, totalPoints };
    }

    getChallenge(id: string): ChallengeOutcome {
        if (this.duplicateIds().has(id)) {
            return {
                kind: "broken",
                broken: {
                    broken: true,
                    path: `challenge ${id}`,
                    error: `duplicate id: "${id}"`,
                },
            };
        }

        const found = this.content.findChallenge(id);
        if (found === null) {
            return { kind: "notFound" };
        }
        if ("broken" in found) {
            return { kind: "broken", broken: found };
        }

        const { challenge, body } = found;
        const { briefing } = splitBody(body);
        const solvedRow = this.progress.listSolved().find((row) => row.challengeId === id);

        let moduleTitle = challenge.module;
        for (const result of this.content.readModules()) {
            if (!("broken" in result) && result.id === challenge.module) {
                moduleTitle = result.title;
                break;
            }
        }

        return {
            kind: "ok",
            challenge: {
                id: challenge.id,
                title: challenge.title,
                module: { id: challenge.module, title: moduleTitle },
                tier: challenge.tier,
                briefing,
                links: challenge.links ?? [],
                solved: solvedRow !== undefined,
                points: solvedRow?.points ?? 0,
            },
        };
    }

    getGuide(id: string): GuideOutcome {
        if (this.duplicateIds().has(id)) {
            return { kind: "broken" };
        }
        const found = this.content.findChallenge(id);
        if (found === null) {
            return { kind: "notFound" };
        }
        if ("broken" in found) {
            return { kind: "broken" };
        }
        const { guide } = splitBody(found.body);
        return guide === null ? { kind: "noGuide" } : { kind: "ok", guide };
    }

    // Challenge ids that appear in more than one module. Both list() and
    // getChallenge() use this so they agree on what is broken.
    private duplicateIds(): Set<string> {
        const seen = new Map<string, number>();
        for (const result of this.content.readModules()) {
            if ("broken" in result) continue;
            for (const cr of this.content.readChallenges(result.id)) {
                if ("broken" in cr) continue;
                seen.set(cr.id, (seen.get(cr.id) ?? 0) + 1);
            }
        }
        return new Set([...seen.entries()].filter(([, c]) => c > 1).map(([id]) => id));
    }
}

const GUIDE_MARKER = "## Guide";

function splitBody(body: string): { briefing: string; guide: string | null } {
    const lines = body.split("\n");
    const guideIndex = lines.findIndex((line) => line.trimEnd() === GUIDE_MARKER);
    if (guideIndex === -1) {
        return { briefing: body.trimEnd(), guide: null };
    }
    return {
        briefing: lines.slice(0, guideIndex).join("\n").trimEnd(),
        guide: lines.slice(guideIndex + 1).join("\n").trim(),
    };
}
