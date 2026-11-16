import type { Context } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";

const COOKIE_NAME = "til_session";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

// The cookie value is the expiry timestamp, so sessions are stateless and
// survive restarts.
export async function setSession(c: Context, secret: string, secure: boolean): Promise<void> {
    const expires = String(Date.now() + SESSION_MS);
    await setSignedCookie(c, COOKIE_NAME, expires, secret, {
        httpOnly: true,
        sameSite: "Lax",
        secure,
        path: "/",
        maxAge: SESSION_MS / 1000,
    });
}

export async function hasSession(c: Context, secret: string): Promise<boolean> {
    const value = await getSignedCookie(c, secret, COOKIE_NAME);
    if (!value) {
        return false;
    }
    const expires = Number(value);
    return Number.isFinite(expires) && expires > Date.now();
}

export function clearSession(c: Context): void {
    deleteCookie(c, COOKIE_NAME, { path: "/" });
}
