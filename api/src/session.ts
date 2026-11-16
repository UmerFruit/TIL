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

// Verify a raw cookie string (for WebSocket upgrade where we don't have a Hono Context)
export async function verifySessionCookie(cookieHeader: string | undefined, secret: string): Promise<boolean> {
    if (!cookieHeader) {
        return false;
    }
    // Parse cookies manually
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    const sessionCookie = cookies.find((c) => c.startsWith(`${COOKIE_NAME}=`));
    if (!sessionCookie) {
        return false;
    }
    let value = sessionCookie.slice(COOKIE_NAME.length + 1);
    // URL decode the value (hono encodes it)
    try {
        value = decodeURIComponent(value);
    } catch {
        return false;
    }
    // The cookie is signed: value.signature (base64, 44 chars ending with =)
    const signatureStartPos = value.lastIndexOf(".");
    if (signatureStartPos < 0) {
        return false;
    }
    const signedValue = value.substring(0, signatureStartPos);
    const signature = value.substring(signatureStartPos + 1);
    if (signature.length !== 44 || !signature.endsWith("=")) {
        return false;
    }
    // Verify signature using the same algorithm as hono (HMAC-SHA256, base64)
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
    );
    const signatureBinStr = atob(signature);
    const signatureBytes = new Uint8Array(signatureBinStr.length);
    for (let i = 0, len = signatureBinStr.length; i < len; i++) {
        signatureBytes[i] = signatureBinStr.charCodeAt(i);
    }
    const valid = await crypto.subtle.verify(
        { name: "HMAC", hash: "SHA-256" },
        key,
        signatureBytes,
        encoder.encode(signedValue)
    );
    if (!valid) {
        return false;
    }
    const expires = Number(signedValue);
    return Number.isFinite(expires) && expires > Date.now();
}

export function clearSession(c: Context): void {
    deleteCookie(c, COOKIE_NAME, { path: "/" });
}