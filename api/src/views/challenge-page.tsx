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
        <>
            <p style="margin-bottom: 1rem">
                <a href="/">← Modules</a>
            </p>
            <h1>{challenge.title}</h1>
            <div class="tier">Tier {challenge.tier}</div>
            <div class="briefing"><Markdown source={challenge.briefing} /></div>
            {challenge.links.length > 0 && (
                <>
                    <h3>Links</h3>
                    <ul>
                        {challenge.links.map((link) => (
                            <li>
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
        </>
    );
}
