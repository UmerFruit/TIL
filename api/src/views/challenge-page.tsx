import type { BrokenItem } from "../adapters/content.js";
import type { ChallengeDTO } from "../services/challenges.js";
import { Markdown } from "./markdown.js";

export function NotFound() {
    return <div>Challenge not found.</div>;
}

export function ChallengePage({
    challenge,
    broken,
}: {
    challenge?: ChallengeDTO;
    broken?: BrokenItem;
}) {
    if (broken) {
        return (
            <div class="error-box">
                <div class="path">{broken.path}</div>
                <div>{broken.error}</div>
            </div>
        );
    }
    if (!challenge) {
        return <NotFound />;
    }
    return (
        <div class="challenge-page">
            <div class="challenge-left">
                <nav class="breadcrumb" aria-label="Breadcrumb">
                    <a href="/">Modules</a>
                    <span aria-hidden="true">/</span>
                    <span>{challenge.module.title}</span>
                    <span aria-hidden="true">/</span>
                    <span aria-current="page">{challenge.title}</span>
                </nav>
                <header class="challenge-header">
                    <h1>{challenge.title}</h1>
                    <div class="challenge-meta">
                        <span class="tier">Tier {challenge.tier}</span>
                        <span id="solved-badge" class={challenge.solved ? "solved-badge" : "unsolved-badge"}>
                            {challenge.solved ? `✓ Solved (+${challenge.points} pts)` : "Not solved"}
                        </span>
                    </div>
                </header>
                <div class="briefing"><Markdown source={challenge.briefing} /></div>
                {challenge.links.length > 0 && (
                    <>
                        <h3>Links</h3>
                        <ul class="links">
                            {challenge.links.map((link) => (
                                <li key={link.url}>
                                    <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {link.label}
                                    </a>
                                    <span class="link-type"> [{link.type}]</span>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
                <section class="answer-section">
                    <button
                        hx-get={`/challenges/${challenge.id}/answer`}
                        hx-target="#answer"
                        hx-swap="innerHTML"
                        class="answer-btn"
                    >
                        View answer
                    </button>
                    <div id="answer" class="answer"></div>
                </section>
                <section class="flag-section">
                    <form
                        hx-post={`/challenges/${challenge.id}/flag`}
                        hx-target="#flag-result"
                        hx-swap="innerHTML"
                    >
                        <input
                            type="text"
                            name="flag"
                            placeholder="TIL{...}"
                            autocomplete="off"
                            required
                            maxlength={200}
                        />
                        <button type="submit">Submit flag</button>
                    </form>
                    <div id="flag-result"></div>
                </section>
                <section class="sandbox-section">
                    <h3>Sandbox</h3>
                    <div
                        id="sandbox-controls"
                        hx-get={`/sandbox/status?challenge=${challenge.id}`}
                        hx-trigger="load"
                    ></div>
                </section>
            </div>
            <aside class="challenge-right" id="terminal-container">
                <div class="terminal-placeholder">
                    <p>Start a session to get a terminal</p>
                </div>
            </aside>
        </div>
    );
}