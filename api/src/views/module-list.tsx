import type { BrokenItem, ListModule } from "../services/challenges.js";

export function ModuleList({ modules, broken }: { modules: ListModule[]; broken: BrokenItem[] }) {
    return (
        <>
            {broken.map((item) => (
                <div class="error-box">
                    <div class="path">{item.path}</div>
                    <div>{item.error}</div>
                </div>
            ))}
            {modules.map((module) => (
                <section class="module">
                    <h2>{module.title}</h2>
                    <p>{module.description}</p>
                    <ul>
                        {module.challenges.map((challenge) => (
                            <li>
                                <a href={`/challenges/${challenge.id}`}>{challenge.title}</a>
                                (tier {challenge.tier}, order {challenge.order})
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </>
    );
}
