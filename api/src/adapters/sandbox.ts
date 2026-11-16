import Docker from "dockerode";
import { pack } from "tar-stream";
import type { SandboxFile } from "./content.js";

export interface SessionInfo {
    id: string;
    challengeId: string;
    startedAt: string;
}

export interface CreateSessionOptions {
    challengeId: string;
    image: string;
    files: SandboxFile[];
}

export interface SandboxRuntime {
    createSession(opts: CreateSessionOptions): Promise<SessionInfo>;
    listSessions(): Promise<SessionInfo[]>;
    removeSession(id: string): Promise<void>;
}

export type SandboxErrorKind = "dockerUnavailable" | "imageMissing" | "failed";

export class SandboxError extends Error {
    constructor(public kind: SandboxErrorKind, message: string) {
        super(message);
        this.name = "SandboxError";
    }
}

const SESSION_LABEL = "til.session";

function isNotFound(err: unknown): boolean {
    return (
        typeof err === "object" &&
        err !== null &&
        (err as { statusCode?: number }).statusCode === 404
    );
}

function isConnectionError(err: unknown): boolean {
    const code = (err as { code?: string } | null)?.code;
    return code === "ECONNREFUSED" || code === "ENOENT" || code === "EACCES" || code === "EPIPE";
}

export interface DockerSandboxOptions {
    socketPath: string;
    memoryMb: number;
    cpus: number;
    pids: number;
}

export class DockerSandboxRuntime implements SandboxRuntime {
    private docker: Docker;

    constructor(private opts: DockerSandboxOptions) {
        this.docker = new Docker({ socketPath: opts.socketPath });
    }

    async createSession(opts: CreateSessionOptions): Promise<SessionInfo> {
        try {
            await this.ensureImage(opts.image);
            const startedAt = new Date().toISOString();
            const container = await this.docker.createContainer({
                Image: opts.image,
                Cmd: ["sleep", "infinity"],
                WorkingDir: "/workspace",
                Labels: {
                    [SESSION_LABEL]: "1",
                    "til.challenge": opts.challengeId,
                    "til.started": startedAt,
                },
                HostConfig: {
                    Memory: this.opts.memoryMb * 1024 * 1024,
                    NanoCpus: Math.round(this.opts.cpus * 1e9),
                    PidsLimit: this.opts.pids,
                    CapDrop: ["ALL"],
                    SecurityOpt: ["no-new-privileges"],
                },
            });
            await container.start();
            await this.copyFiles(container, opts.files);
            return { id: container.id, challengeId: opts.challengeId, startedAt };
        } catch (err) {
            throw this.wrap(err);
        }
    }

    async listSessions(): Promise<SessionInfo[]> {
        try {
            const containers = await this.docker.listContainers({
                all: true,
                filters: { label: [`${SESSION_LABEL}=1`] },
            });
            return containers.map((c) => ({
                id: c.Id,
                challengeId: c.Labels["til.challenge"] ?? "",
                startedAt: c.Labels["til.started"] ?? "",
            }));
        } catch (err) {
            throw this.wrap(err);
        }
    }

    async removeSession(id: string): Promise<void> {
        try {
            await this.docker.getContainer(id).remove({ force: true });
        } catch (err) {
            if (isNotFound(err)) {
                return;
            }
            throw this.wrap(err);
        }
    }

    private async ensureImage(image: string): Promise<void> {
        try {
            await this.docker.getImage(image).inspect();
        } catch (err) {
            if (isNotFound(err)) {
                throw new SandboxError(
                    "imageMissing",
                    `image ${image} not built, run sandbox-images/build.sh`
                );
            }
            throw err;
        }
    }

    // In-memory tar: /workspace/check (0755) and /workspace/files/** (0644),
    // owned by uid/gid 1000. No bind mounts.
    private async copyFiles(container: Docker.Container, files: SandboxFile[]): Promise<void> {
        const archive = pack();
        const dirs = new Set<string>();
        for (const file of files) {
            const parts = file.path.split("/");
            for (let i = 1; i < parts.length; i++) {
                dirs.add(parts.slice(0, i).join("/"));
            }
        }
        for (const dir of dirs) {
            archive.entry({ name: `${dir}/`, type: "directory", mode: 0o755, uid: 1000, gid: 1000 });
        }
        for (const file of files) {
            archive.entry(
                {
                    name: file.path,
                    type: "file",
                    mode: file.mode,
                    uid: 1000,
                    gid: 1000,
                    size: file.content.length,
                },
                file.content
            );
        }
        archive.finalize();
        const chunks: Buffer[] = [];
        for await (const chunk of archive as AsyncIterable<Buffer>) {
            chunks.push(chunk);
        }
        await container.putArchive(Buffer.concat(chunks), { path: "/workspace" });
    }

    private wrap(err: unknown): SandboxError {
        if (err instanceof SandboxError) {
            return err;
        }
        if (isConnectionError(err)) {
            return new SandboxError("dockerUnavailable", "Docker is not reachable");
        }
        return new SandboxError("failed", (err as Error)?.message ?? String(err));
    }
}
