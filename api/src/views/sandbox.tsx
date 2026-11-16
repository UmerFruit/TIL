import type { SandboxResult, SandboxStatus } from "../services/sandbox.js";

export function Sandbox({ result, challengeId }: { result: SandboxResult; challengeId: string }) {
    switch (result.kind) {
        case "dockerUnavailable":
            return (
                <>
                    <div id="sandbox-controls" class="sandbox" hx-swap-oob="true">
                        <div class="sandbox-error">Docker is not reachable</div>
                    </div>
                    <div id="terminal-container" class="challenge-right" hx-swap-oob="true">
                        <div class="terminal-placeholder">
                            <p>Docker is not reachable</p>
                        </div>
                    </div>
                </>
            );
        case "imageMissing":
            return (
                <>
                    <div id="sandbox-controls" class="sandbox" hx-swap-oob="true">
                        <div class="sandbox-error">{result.message}</div>
                    </div>
                    <div id="terminal-container" class="challenge-right" hx-swap-oob="true">
                        <div class="terminal-placeholder">
                            <p>{result.message}</p>
                        </div>
                    </div>
                </>
            );
        case "broken":
            return (
                <>
                    <div id="sandbox-controls" class="sandbox" hx-swap-oob="true">
                        <div class="sandbox-error">{result.message}</div>
                    </div>
                    <div id="terminal-container" class="challenge-right" hx-swap-oob="true">
                        <div class="terminal-placeholder">
                            <p>{result.message}</p>
                        </div>
                    </div>
                </>
            );
        case "notFound":
            return (
                <>
                    <div id="sandbox-controls" class="sandbox" hx-swap-oob="true">
                        <div class="sandbox-error">Challenge not found</div>
                    </div>
                    <div id="terminal-container" class="challenge-right" hx-swap-oob="true">
                        <div class="terminal-placeholder">
                            <p>Challenge not found</p>
                        </div>
                    </div>
                </>
            );
        case "ok":
            return <SandboxControls status={result.status} challengeId={challengeId} />;
    }
}

function SandboxControls({ status, challengeId }: { status: SandboxStatus; challengeId: string }) {
    if (status.running && status.thisChallenge) {
        return (
            <>
                <div id="sandbox-controls" class="sandbox" hx-swap-oob="true">
                    <div class="sandbox-status">running</div>
                    <form hx-post="/sandbox/stop" hx-target="#sandbox-controls" hx-swap="innerHTML">
                        <button type="submit">Stop</button>
                    </form>
                    <form
                        hx-post="/sandbox/reset"
                        hx-target="#sandbox-controls"
                        hx-swap="innerHTML"
                        hx-confirm="Discard your changes?"
                    >
                        <input type="hidden" name="challenge" value={challengeId} />
                        <button type="submit">Reset</button>
                    </form>
                </div>
                <div id="terminal-container" class="challenge-right" hx-swap-oob="true">
                    <div data-terminal class="terminal"></div>
                </div>
            </>
        );
    }
    return (
        <>
            <div id="sandbox-controls" class="sandbox" hx-swap-oob="true">
                <div class="sandbox-status">
                    {status.running ? "another challenge is running" : "stopped"}
                </div>
                <form hx-post="/sandbox/start" hx-target="#sandbox-controls" hx-swap="innerHTML">
                    <input type="hidden" name="challenge" value={challengeId} />
                    <button type="submit">Start</button>
                </form>
            </div>
            <div id="terminal-container" class="challenge-right" hx-swap-oob="true">
                <div class="terminal-placeholder">
                    <p>Start a session to get a terminal</p>
                </div>
            </div>
        </>
    );
}