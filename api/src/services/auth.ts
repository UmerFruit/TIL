import { createHash, timingSafeEqual } from "node:crypto";

const MAX_FAILURES = 5;
const WINDOW_MS = 60_000;
const LOCK_MS = 60_000;

interface Attempt {
    count: number;
    windowStart: number;
    lockedUntil: number;
}

export type LoginResult = "ok" | "wrong" | "throttled";

function hash(value: string): Buffer {
    return createHash("sha256").update(value).digest();
}

export class AuthService {
    // In-memory only: a restart clears the throttle, which is fine for v1.
    private attempts = new Map<string, Attempt>();

    constructor(private password: string) {}

    checkPassword(input: string): boolean {
        return timingSafeEqual(hash(input), hash(this.password));
    }

    login(ip: string, input: string): LoginResult {
        const now = Date.now();
        const entry = this.attempts.get(ip);
        if (entry && entry.lockedUntil > now) {
            return "throttled";
        }
        if (this.checkPassword(input)) {
            this.attempts.delete(ip);
            return "ok";
        }
        this.recordFailure(ip, now, entry);
        return "wrong";
    }

    private recordFailure(ip: string, now: number, entry: Attempt | undefined): void {
        if (!entry || now - entry.windowStart > WINDOW_MS) {
            this.attempts.set(ip, { count: 1, windowStart: now, lockedUntil: 0 });
            return;
        }
        entry.count += 1;
        if (entry.count >= MAX_FAILURES) {
            entry.lockedUntil = now + LOCK_MS;
        }
        if (this.attempts.size > 1000) {
            for (const [key, value] of this.attempts) {
                if (value.lockedUntil <= now && now - value.windowStart > WINDOW_MS) {
                    this.attempts.delete(key);
                }
            }
        }
    }
}
