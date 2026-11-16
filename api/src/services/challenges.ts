import type {
    BrokenItem,
    ContentAdapter,
    FoundChallenge,
    ModuleResult,
} from "../adapters/content.js";

export type { BrokenItem };

export interface ListChallenge {
    id: string;
    title: string;
    tier: number;
    order: number;
}

export interface ListModule {
    id: string;
    title: string;
    description: string;
    order: number;
    challenges: ListChallenge[];
}

export interface ListResult {
    modules: ListModule[];
    broken: BrokenItem[];
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
}

export type ChallengeOutcome =
    | { kind: "ok"; challenge: ChallengeDTO }
    | { kind: "broken"; broken: BrokenItem }
    | { kind: "notFound" };

export class ChallengesService {
    constructor(private content: ContentAdapter) {}

    list(): ListResult {
        const modules: ListModule[] = [];
        const broken: BrokenItem[] = [];
        const duplicateIds = this.duplicateIds();

        for (const result of this.content.readModules()) {
            if ("broken" in result) {
                broken.push(result);
                continue;
            }
            const challengeResults = this.content.readChallenges(result.id);
            const challenges: ListChallenge[] = [];
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
                challenges.push({
                    id: cr.id,
                    title: cr.title,
                    tier: cr.tier,
                    order: cr.order,
                });
            }
            challenges.sort((a, b) => a.order - b.order);
            modules.push({
                id: result.id,
                title: result.title,
                description: result.description,
                order: result.order,
                challenges,
            });
        }

        modules.sort((a, b) => a.order - b.order);
        return { modules, broken };
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
        const briefing = splitBriefing(body);

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
            },
        };
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

function splitBriefing(body: string): string {
    const lines = body.split("\n");
    const guideIndex = lines.findIndex((line) => line.trimEnd() === GUIDE_MARKER);
    if (guideIndex === -1) {
        return body.trimEnd();
    }
    return lines.slice(0, guideIndex).join("\n").trimEnd();
}
