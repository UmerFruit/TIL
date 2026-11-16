import type { SubmitResult } from "../services/flags.js";

export function FlagResult({ result }: { result: SubmitResult }) {
    switch (result.kind) {
        case "correct":
            return <div class="result-ok">Correct! +{result.points} points</div>;
        case "alreadySolved":
            return <div class="result-ok">Already solved, no points awarded again</div>;
        case "wrong":
            return <div class="result-error">Wrong flag, try again</div>;
        case "notFound":
        case "broken":
            return <div class="result-error">This challenge can't be checked</div>;
    }
}
