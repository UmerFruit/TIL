import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DiskContentAdapter } from "../src/adapters/content.js";
import {
    SandboxError,
    type CreateSessionOptions,
    type SandboxRuntime,
    type SessionInfo,
} from "../src/adapters/sandbox.js";
import { SandboxService } from "../src/services/sandbox.js";

const contentDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../content");
const content = new DiskContentAdapter(contentDir);

let failures = 0;
function check(name: string, cond: boolean) {
    if (cond) {
        console.log(`ok   ${name}`);
    } else {
        console.log(`FAIL ${name}`);
        failures++;
    }
}

class FakeRuntime implements SandboxRuntime {
    sessions: SessionInfo[] = [];
    created: CreateSessionOptions[] = [];
    removed: string[] = [];
    failList: SandboxError | null = null;
    failCreate: SandboxError | null = null;

    async createSession(opts: CreateSessionOptions): Promise<SessionInfo> {
        if (this.failCreate) throw this.failCreate;
        this.created.push(opts);
        const info = { id: `c${this.created.length}`, challengeId: opts.challengeId, startedAt: "now" };
        this.sessions.push(info);
        return info;
    }
    async listSessions(): Promise<SessionInfo[]> {
        if (this.failList) throw this.failList;
        return this.sessions;
    }
    async removeSession(id: string): Promise<void> {
        this.removed.push(id);
        this.sessions = this.sessions.filter((s) => s.id !== id);
    }
}

async function main() {
    const runtime = new FakeRuntime();
    const service = new SandboxService(content, runtime);

    const started = await service.start("hello-fix");
    check("start hello-fix ok", started.kind === "ok");
    check(
        "start hello-fix running this challenge",
        started.kind === "ok" && started.status.running && started.status.thisChallenge
    );

    const files = runtime.created[0]?.files ?? [];
    const checkFile = files.find((f) => f.path === "check");
    const mainFile = files.find((f) => f.path === "files/main.cpp");
    check("check file present", checkFile !== undefined);
    check("check mode 0755", checkFile?.mode === 0o755);
    check("main.cpp present", mainFile !== undefined);
    check("main.cpp mode 0644", mainFile?.mode === 0o644);
    check("image is til-cpp", runtime.created[0]?.image === "til-cpp");

    const statusOther = await service.status("sum-fix");
    check(
        "status other challenge -> another running",
        statusOther.kind === "ok" && statusOther.status.running && !statusOther.status.thisChallenge
    );

    const started2 = await service.start("sum-fix");
    check("start sum-fix replaces", started2.kind === "ok" && runtime.removed.includes("c1"));
    check("only one session after replace", runtime.sessions.length === 1);
    check(
        "sum-fix now this challenge",
        started2.kind === "ok" && started2.status.thisChallenge
    );

    const stopped = await service.stop();
    check("stop -> not running", stopped.kind === "ok" && !stopped.status.running);
    check("no sessions after stop", runtime.sessions.length === 0);

    const notFound = await service.start("nope");
    check("unknown challenge -> notFound", notFound.kind === "notFound");

    const down = new FakeRuntime();
    down.failList = new SandboxError("dockerUnavailable", "Docker is not reachable");
    const downResult = await new SandboxService(content, down).status("hello-fix");
    check("docker down -> dockerUnavailable", downResult.kind === "dockerUnavailable");

    const noImage = new FakeRuntime();
    noImage.failCreate = new SandboxError("imageMissing", "image til-cpp not built, run sandbox-images/build.sh");
    const noImageResult = await new SandboxService(content, noImage).start("hello-fix");
    check(
        "image missing -> imageMissing with hint",
        noImageResult.kind === "imageMissing" &&
            noImageResult.message.includes("sandbox-images/build.sh")
    );

    console.log(failures === 0 ? "\nall checks passed" : `\n${failures} failed`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
