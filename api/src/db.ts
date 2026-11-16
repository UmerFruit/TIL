import Database from "better-sqlite3";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function openDb(): Database.Database {
    const path = process.env.DB_PATH || resolve(root, "data/til.db");
    mkdirSync(dirname(path), { recursive: true });
    const db = new Database(path);
    // Migrations are idempotent (create table if not exists), applied in name order.
    const dir = resolve(root, "database");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
        db.exec(readFileSync(resolve(dir, file), "utf8"));
    }
    return db;
}
