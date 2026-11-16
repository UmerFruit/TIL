export interface Config {
    appPassword: string;
    sessionSecret: string;
    cookieSecure: boolean;
    dockerSocket: string;
    sandboxMemoryMb: number;
    sandboxCpus: number;
    sandboxPids: number;
    sandboxIdleMinutes: number;
    sandboxJanitorSeconds: number;
}

function positiveInt(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
    const raw = env[name];
    if (raw === undefined || raw === "") {
        return fallback;
    }
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function positiveFloat(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
    const raw = env[name];
    if (raw === undefined || raw === "") {
        return fallback;
    }
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

// Refuse to start on missing secrets rather than running with an empty password.
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
    const appPassword = env.APP_PASSWORD ?? "";
    if (appPassword === "") {
        throw new Error("APP_PASSWORD is required (set it in .env)");
    }
    const sessionSecret = env.SESSION_SECRET ?? "";
    if (sessionSecret.length < 32) {
        throw new Error("SESSION_SECRET is required and must be at least 32 characters (set it in .env)");
    }
    return {
        appPassword,
        sessionSecret,
        cookieSecure: env.COOKIE_SECURE === "true",
        dockerSocket: env.DOCKER_SOCKET || "/var/run/docker.sock",
        sandboxMemoryMb: positiveInt(env, "SANDBOX_MEMORY_MB", 1024),
        sandboxCpus: positiveInt(env, "SANDBOX_CPUS", 1),
        sandboxPids: positiveInt(env, "SANDBOX_PIDS", 256),
        sandboxIdleMinutes: positiveFloat(env, "SANDBOX_IDLE_MINUTES", 120),
        sandboxJanitorSeconds: positiveInt(env, "SANDBOX_JANITOR_SECONDS", 60),
    };
}
