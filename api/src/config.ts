export interface Config {
    appPassword: string;
    sessionSecret: string;
    cookieSecure: boolean;
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
    };
}
