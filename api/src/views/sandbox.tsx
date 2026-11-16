import type { SandboxResult, SandboxStatus } from "../services/sandbox.js";

export function Sandbox({ result, challengeId }: { result: SandboxResult; challengeId: string }) {
    switch (result.kind) {
        case "dockerUnavailable":
            return <div class="sandbox-error">Docker is not reachable</div>;
        case "imageMissing":
            return <div class="sandbox-error">{result.message}</div>;
        case "broken":
            return <div class="sandbox-error">{result.message}</div>;
        case "notFound":
            return <div class="sandbox-error">Challenge not found</div>;
        case "ok":
            return <SandboxControls status={result.status} challengeId={challengeId} />;
    }
}

function SandboxControls({ status, challengeId }: { status: SandboxStatus; challengeId: string }) {
    if (status.running && status.thisChallenge) {
        return (
            <div class="sandbox">
                <div class="sandbox-status">running</div>
                <form hx-post="/sandbox/stop" hx-target="#sandbox" hx-swap="innerHTML">
                    <button type="submit">Stop</button>
                </form>
            </div>
        );
    }
    return (
        <div class="sandbox">
            <div class="sandbox-status">
                {status.running ? "another challenge is running" : "stopped"}
            </div>
            <form hx-post="/sandbox/start" hx-target="#sandbox" hx-swap="innerHTML">
                <input type="hidden" name="challenge" value={challengeId} />
                <button type="submit">Start</button>
            </form>
        </div>
    );
}
