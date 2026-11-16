import type { BrokenItem, ListModule } from "../services/challenges.js";

export function ModuleList({
    modules,
    broken,
    earnedPoints,
    totalPoints,
}: {
    modules: ListModule[];
    broken: BrokenItem[];
    earnedPoints: number;
    totalPoints: number;
}) {
    return (
        <>
            <div class="points">Points: {earnedPoints} / {totalPoints}</div>
            {broken.map((item) => (
                <div class="error-box">
                    <div class="path">{item.path}</div>
                    <div>{item.error}</div>
                </div>
            ))}
            {modules.map((module) => (
                <section class="module">
                    <h2>
                        {module.title}{" "}
                        <span class="points">
                            {module.earnedPoints} / {module.totalPoints} pts
                        </span>
                    </h2>
                    <p>{module.description}</p>
                    <ul>
                        {module.challenges.map((challenge) => (
                            <li>
                                <a href={`/challenges/${challenge.id}`}>{challenge.title}</a>
                                (tier {challenge.tier}, order {challenge.order}){" "}
                                {challenge.solved ? (
                                    <span class="solved">✓ Solved</span>
                                ) : (
                                    <span class="unsolved">Not solved</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </>
    );
}
