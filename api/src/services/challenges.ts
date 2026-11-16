import type { BrokenItem, ContentAdapter, ModuleResult } from "../adapters/content.js";
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

export class ChallengesService {
    constructor(private content: ContentAdapter) {}

    list(): ListResult {
        const modules: ListModule[] = [];
        const broken: BrokenItem[] = [];

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
}
