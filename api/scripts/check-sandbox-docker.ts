// Integration test for the Docker sandbox adapter. Needs a reachable Docker
// daemon and the `til-cpp` image built (sh sandbox-images/build.sh).
//
// Run:  npx tsx scripts/check-sandbox-docker.ts
// Env:  DOCKER_SOCKET (default /var/run/docker.sock),
//       SANDBOX_MEMORY_MB, SANDBOX_CPUS, SANDBOX_PIDS
//
// Note: this stops any running TIL session (one session at a time).

import Docker from "dockerode";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DiskContentAdapter } from "../src/adapters/content.js";
import { DockerSandboxRuntime, SandboxError } from "../src/adapters/sandbox.js";
import { SandboxService } from "../src/services/sandbox.js";

const socketPath = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
const memoryMb = Number(process.env.SANDBOX_MEMORY_MB) || 1024;
const cpus = Number(process.env.SANDBOX_CPUS) || 1;
const pids = Number(process.env.SANDBOX_PIDS) || 256;
const image = "til-cpp";

const contentDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../content");
const content = new DiskContentAdapter(contentDir);
const docker = new Docker({ socketPath });

let failures = 0;
let skipped = 0;
function check(name: string, cond: boolean, detail?: string) {
    if (cond) {
        console.log(`ok   ${name}`);
    } else {
        console.log(`FAIL ${name}${detail ? ` (${detail})` : ""}`);
        failures++;
    }
}
function skip(name: string, reason: string) {
    console.log(`SKIP ${name}: ${reason}`);
    skipped++;
}

function exec(container: Docker.Container, cmd: string[]): Promise<string> {
    return new Promise((resolvePromise, reject) => {
        container
            .exec({ Cmd: cmd, AttachStdout: true, AttachStderr: true })
            .then((exec) => exec.start({}))
            .then((stream) => {
                const chunks: Buffer[] = [];
                stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
                stream.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
                stream.on("error", reject);
            })
            .catch(reject);
    });
}

async function imageExists(): Promise<boolean> {
    try {
        await docker.getImage(image).inspect();
        return true;
    } catch {
        return false;
    }
}

async function main() {
    // Docker unreachable: the adapter must report dockerUnavailable, not crash.
    const down = new DockerSandboxRuntime({
        socketPath: "/tmp/til-no-such-docker.sock",
        memoryMb,
        cpus,
        pids,
    });
    try {
        await down.listSessions();
        check("unreachable docker throws", false);
    } catch (err) {
        check(
            "unreachable docker -> dockerUnavailable",
            err instanceof SandboxError && err.kind === "dockerUnavailable"
        );
    }

    try {
        await docker.ping();
    } catch {
        skip("docker integration", `Docker not reachable at ${socketPath}`);
        return;
    }

    if (!(await imageExists())) {
        skip("docker integration", `image ${image} not built, run sandbox-images/build.sh`);
        return;
    }

    const runtime = new DockerSandboxRuntime({ socketPath, memoryMb, cpus, pids });
    const service = new SandboxService(content, runtime);

    // Image missing: a bogus image must yield the build hint.
    try {
        await runtime.createSession({ challengeId: "x", image: "til-does-not-exist", files: [] });
        check("missing image throws", false);
    } catch (err) {
        check(
            "missing image -> imageMissing",
            err instanceof SandboxError && err.kind === "imageMissing"
        );
        check(
            "missing image hint",
            err instanceof Error && err.message.includes("sandbox-images/build.sh")
        );
    }

    try {
        // Start hello-fix.
        const started = await service.start("hello-fix");
        check("start hello-fix ok", started.kind === "ok", started.kind);

        const sessions = await runtime.listSessions();
        check("exactly one session", sessions.length === 1, `got ${sessions.length}`);
        const session = sessions[0];
        check("session label challenge", session.challengeId === "hello-fix");

        const container = docker.getContainer(session.id);
        const inspect = await container.inspect();
        const labels = inspect.Config.Labels ?? {};
        check("label til.session=1", labels["til.session"] === "1");
        check("label til.challenge", labels["til.challenge"] === "hello-fix");
        check("label til.started is ISO", typeof labels["til.started"] === "string" && labels["til.started"].endsWith("Z"));

        const host = inspect.HostConfig;
        check("memory 1 GiB", host.Memory === memoryMb * 1024 * 1024, String(host.Memory));
        check("nano cpus", host.NanoCpus === Math.round(cpus * 1e9), String(host.NanoCpus));
        check("pids limit", host.PidsLimit === pids, String(host.PidsLimit));
        check("cap drop ALL", (host.CapDrop ?? []).includes("ALL"));
        check(
            "no-new-privileges",
            (host.SecurityOpt ?? []).some((opt: string) => opt.includes("no-new-privileges"))
        );
        check(
            "no published ports",
            !host.PortBindings || Object.keys(host.PortBindings).length === 0
        );
        check(
            "default bridge network",
            host.NetworkMode === "bridge" || host.NetworkMode === "default",
            host.NetworkMode
        );

        // Files copied with the right modes and owner.
        const ls = await exec(container, ["ls", "-l", "/workspace", "/workspace/files"]);
        check("check is executable", /-rwxr-xr-x\s+\d+\s+learner\s+learner\s+\d+\s+\S+\s+\d+\s+\d+:\d+\s+check/.test(ls), ls);
        check("main.cpp present", /main\.cpp/.test(ls));
        check(
            "main.cpp mode 0644",
            /-rw-r--r--\s+\d+\s+learner\s+learner\s+\d+\s+\S+\s+\d+\s+\d+:\d+\s+main\.cpp/.test(ls),
            ls
        );
        check("files owned by learner", /learner\s+learner/.test(ls));

        // Broken starter must fail to compile.
        const broken = await exec(container, ["./check"]);
        check("broken starter -> Compile failed.", broken.includes("Compile failed."), broken);

        // Fix main.cpp inside the container, then the check prints the flag.
        await exec(container, ["sed", "-i", "s/std::endl$/std::endl;/", "files/main.cpp"]);
        const fixed = await exec(container, ["./check"]);
        check("fixed starter prints flag", fixed.includes("TIL{h3llo_c0mpiler}"), fixed);

        // Starting another challenge replaces the first.
        const started2 = await service.start("sum-fix");
        check("start sum-fix ok", started2.kind === "ok", started2.kind);
        const sessions2 = await runtime.listSessions();
        check("still one session", sessions2.length === 1, `got ${sessions2.length}`);
        check("now sum-fix", sessions2[0]?.challengeId === "sum-fix");
        check("old container gone", !sessions2.some((s) => s.id === session.id));

        // Status reflects the running challenge.
        const statusOther = await service.status("hello-fix");
        check(
            "status other challenge -> another running",
            statusOther.kind === "ok" && statusOther.status.running && !statusOther.status.thisChallenge
        );

        // Stop removes it.
        const stopped = await service.stop();
        check("stop ok", stopped.kind === "ok");
        check("no sessions after stop", (await runtime.listSessions()).length === 0);
    } finally {
        // Best-effort cleanup so a failed assertion does not leave a container.
        try {
            await service.stop();
        } catch {
            // ignore
        }
    }
}

main()
    .then(() => {
        console.log(
            `\n${failures === 0 ? "all checks passed" : `${failures} failed`}` +
                (skipped > 0 ? `, ${skipped} skipped` : "")
        );
        process.exit(failures === 0 ? 0 : 1);
    })
    .catch((err) => {
        console.error("test crashed:", err);
        process.exit(1);
    });
