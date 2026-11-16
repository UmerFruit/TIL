import { z } from "zod";
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

export interface ContentAdapter {
    readModules(): ModuleResult[];
    readChallenges(moduleId: string): ChallengeResult[];
}

const ModuleSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    order: z.coerce.number().int(),
});

const LinkSchema = z.object({
    type: z.enum(["doc", "video"]),
    url: z.string().url(),
    label: z.string(),
});

const ChallengeSchema = z.object({
    id: z.string(),
    title: z.string(),
    module: z.string(),
    tier: z.coerce.number().refine((t) => t === 1 || t === 2 || t === 3),
    flag: z.string().regex(/^TIL\{.*\}$/),
    image: z.string(),
    order: z.coerce.number().int(),
    links: LinkSchema.array().optional(),
});

function readHeader(filePath: string): { data: unknown } {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    if (lines[0]?.trim() !== "---") {
        throw new Error("missing opening --- fence");
    }
    const end = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
    if (end === -1) {
        throw new Error("missing closing --- fence");
    }
    return { data: parse(lines.slice(1, end).join("\n")) };
}

function isFile(path: string): boolean {
    try {
        return statSync(path).isFile();
    } catch {
        return false;
    }
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
                const { data } = readHeader(modulePath);
                results.push(ModuleSchema.parse(data));
            } catch (err) {
                results.push({ broken: true, path: modulePath, error: String((err as Error).message) });
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
        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }
            const challengePath = join(moduleDir, entry.name, "challenge.md");
            if (!isFile(challengePath)) {
                continue;
            }
            try {
                const { data } = readHeader(challengePath);
                results.push(ChallengeSchema.parse(data));
            } catch (err) {
                results.push({ broken: true, path: challengePath, error: String((err as Error).message) });
            }
        }
        return results;
    }
}
