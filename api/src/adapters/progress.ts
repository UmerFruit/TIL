import type Database from "better-sqlite3";

export interface SolvedRow {
    challengeId: string;
    points: number;
}

export interface ProgressAdapter {
    isSolved(challengeId: string): boolean;
    // Returns true only when a row was actually inserted, so a double submit
    // cannot award points twice.
    markSolved(challengeId: string, points: number, solvedAt: string): boolean;
    listSolved(): SolvedRow[];
}

export class SqliteProgressAdapter implements ProgressAdapter {
    private readonly selectStmt;
    private readonly insertStmt;
    private readonly listStmt;

    constructor(db: Database.Database) {
        this.selectStmt = db.prepare("select 1 from progress where challenge_id = ?");
        this.insertStmt = db.prepare(
            "insert or ignore into progress (challenge_id, points, solved_at) values (?, ?, ?)"
        );
        this.listStmt = db.prepare("select challenge_id, points from progress");
    }

    isSolved(challengeId: string): boolean {
        return this.selectStmt.get(challengeId) !== undefined;
    }

    markSolved(challengeId: string, points: number, solvedAt: string): boolean {
        return this.insertStmt.run(challengeId, points, solvedAt).changes === 1;
    }

    listSolved(): SolvedRow[] {
        const rows = this.listStmt.all() as { challenge_id: string; points: number }[];
        return rows.map((row) => ({ challengeId: row.challenge_id, points: row.points }));
    }
}
