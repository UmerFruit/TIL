import { z, ZodError } from "zod";
import { parse } from "yaml";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface Module {
    id: string;
    title: string;
    description: string;
    order: number;
}

export interface Challenge {
    id: string;
    title: string;
    module: string;
    tier: 1 | 2 | 3;
    flag: string;
    image: string;
    order: number;
    links?: { type: "doc" | "video"; url: string; label: string }[];
}

export interface BrokenItem {
    broken: true;
    path: string;
    error: string;
}

export type ModuleResult = Module | BrokenItem;
export type ChallengeResult = Challenge | BrokenItem;

export interface FoundChallenge {
    challenge: Challenge;
    body: string;
}

export type FindChallengeResult = FoundChallenge | BrokenItem | null;

export interface ContentAdapter {
    readModules(): ModuleResult[];
    readChallenges(moduleId: string): ChallengeResult[];
    findChallenge(id: string): FindChallengeResult;
}

const ModuleSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    order: z.number().int(),
});

const LinkSchema = z.object({
    type: z.enum(["doc", "video"]),
    url: z
        .string()
        .url()
        .refine(
            (u) => u.startsWith("http://") || u.startsWith("https://"),
            { message: "url: must be http: or https:" }
        ),
    label: z.string(),
});

const ChallengeSchema = z.object({
    id: z.string(),
    title: z.string(),
    module: z.string(),
    tier: z
        .number()
        .int()
        .refine((t) => t === 1 || t === 2 || t === 3, {
            message: "must be 1, 2 or 3",
        }),
    flag: z.string().regex(/^TIL\{.*\}$/),
    image: z.string(),
    order: z.number().int(),
    links: LinkSchema.array().optional(),
});

function formatZodError(err: unknown): string {
    if (!(err instanceof ZodError)) {
        return String((err as Error)?.message ?? err);
    }
    return err.issues
        .map((issue) => {
            const path = issue.path.length > 0 ? issue.path.join(".") : "root";
            return `${path}: ${issue.message}`;
        })
        .join("; ");
}

function readChallengeFile(filePath: string): { data: unknown; body: string } {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    if (lines[0]?.trim() !== "---") {
        throw new Error("missing opening --- fence");
    }
    const end = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
    if (end === -1) {
        throw new Error("missing closing --- fence");
    }
    const data = parse(lines.slice(1, end).join("\n"));
    const body = lines.slice(end + 1).join("\n");
    return { data, body };
}

function isFile(path: string): boolean {
    try {
        return statSync(path).isFile();
    } catch {
        return false;
    }
}

function folderName(path: string): string {
    return path.split(/\/|\\/).pop() ?? "";
}

export class DiskContentAdapter implements ContentAdapter {
    constructor(private contentDir: string) {}

    readModules(): ModuleResult[] {
        const results: ModuleResult[] = [];
        let entries;
        try {
            entries = readdirSync(this.contentDir, { withFileTypes: true });
        } catch {
            return results;
        }
        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }
            const modulePath = join(this.contentDir, entry.name, "module.md");
            if (!isFile(modulePath)) {
                continue;
            }
            try {
                const { data } = readChallengeFile(modulePath);
                results.push(ModuleSchema.parse(data));
            } catch (err) {
                results.push({
                    broken: true,
                    path: modulePath,
                    error: formatZodError(err),
                });
            }
        }
        return results;
    }

    readChallenges(moduleId: string): ChallengeResult[] {
        const results: ChallengeResult[] = [];
        const moduleDir = join(this.contentDir, moduleId);
        let entries;
        try {
            entries = readdirSync(moduleDir, { withFileTypes: true });
        } catch {
            return results;
        }
        const expectedModule = folderName(moduleDir);
        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }
            const challengePath = join(moduleDir, entry.name, "challenge.md");
            if (!isFile(challengePath)) {
                continue;
            }
            try {
                const { data } = readChallengeFile(challengePath);
                const challenge = ChallengeSchema.parse(data);
                if (challenge.id !== entry.name) {
                    results.push({
                        broken: true,
                        path: challengePath,
                        error: `id: challenge id "${challenge.id}" does not match folder name "${entry.name}"`,
                    });
                    continue;
                }
                if (challenge.module !== expectedModule) {
                    results.push({
                        broken: true,
                        path: challengePath,
                        error: `module: challenge module "${challenge.module}" does not match parent folder "${expectedModule}"`,
                    });
                    continue;
                }
                results.push(challenge);
            } catch (err) {
                results.push({
                    broken: true,
                    path: challengePath,
                    error: formatZodError(err),
                });
            }
        }
        return results;
    }

    findChallenge(id: string): FindChallengeResult {
        let entries;
        try {
            entries = readdirSync(this.contentDir, { withFileTypes: true });
        } catch {
            return null;
        }
        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }
            const moduleDir = join(this.contentDir, entry.name);
            let challengeEntries;
            try {
                challengeEntries = readdirSync(moduleDir, { withFileTypes: true });
            } catch {
                continue;
            }
            for (const challengeEntry of challengeEntries) {
                if (!challengeEntry.isDirectory()) {
                    continue;
                }
                if (challengeEntry.name !== id) {
                    continue;
                }
                const challengePath = join(moduleDir, id, "challenge.md");
                if (!isFile(challengePath)) {
                    continue;
                }
                try {
                    const { data, body } = readChallengeFile(challengePath);
                    return { challenge: ChallengeSchema.parse(data), body };
                } catch (err) {
                    return {
                        broken: true,
                        path: challengePath,
                        error: formatZodError(err),
                    };
                }
            }
        }
        return null;
    }
}
