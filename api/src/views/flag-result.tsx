import type { SubmitResult } from "../services/flags.js";

export function FlagResult({ result }: { result: SubmitResult }) {
    switch (result.kind) {
        case "correct":
            return (
                <>
                    <div class="result-ok">
                        Correct! +{result.points} {result.points === 1 ? "point" : "points"}
                    </div>
                    <span id="solved-badge" class="solved-badge" hx-swap-oob="true">
                        ✓ Solved (+{result.points} pts)
                    </span>
                </>
            );
        case "alreadySolved":
            return (
                <>
                    <div class="result-ok">Already solved, no points awarded again</div>
                    <span id="solved-badge" class="solved-badge" hx-swap-oob="true">
                        ✓ Solved
                    </span>
                </>
            );
        case "wrong":
            return <div class="result-error">Wrong flag, try again</div>;
        case "notFound":
        case "broken":
            return <div class="result-error">This challenge can't be checked</div>;
    }
}