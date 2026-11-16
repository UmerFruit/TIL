import type { GuideOutcome } from "../services/challenges.js";
import { Markdown } from "./markdown.js";

export function Answer({ outcome }: { outcome: GuideOutcome }) {
    switch (outcome.kind) {
        case "ok":
            return (
                <div class="answer">
                    <Markdown source={outcome.guide} />
                </div>
            );
        case "noGuide":
            return <div class="answer">No guide for this challenge</div>;
        case "broken":
        case "notFound":
            return <div class="answer">This challenge can't be checked</div>;
    }
}
