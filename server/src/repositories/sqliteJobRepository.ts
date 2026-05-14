import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ScanJob } from '../types.js';
import type { JobRepository } from './jobRepository.js';
import { mapJobToRecord, mapRowToJob, type JobRow } from './jobMapper.js';

const dataDirectoryPath = resolve(process.cwd(), 'data');
const databaseFilePath = resolve(dataDirectoryPath, 'jobs.sqlite');

export class SQLiteJobRepository implements JobRepository {
  private readonly db: DatabaseSync;

  constructor() {
    mkdirSync(dataDirectoryPath, { recursive: true });
    this.db = new DatabaseSync(databaseFilePath);
  }

  initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        root_path TEXT NOT NULL,
        progress_json TEXT NOT NULL,
        result_json TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    this.recoverInterruptedJobs('Job was interrupted by a server restart.');
  }

  listJobs(): ScanJob[] {
    const rows = this.db
      .prepare(
        `SELECT id, status, root_path, progress_json, result_json, error, created_at, updated_at
         FROM jobs
         ORDER BY datetime(created_at) DESC`,
      )
      .all() as unknown as JobRow[];

    return rows.map((row) => mapRowToJob(row));
  }

  getJob(id: string): ScanJob | undefined {
    const row = this.db
      .prepare(
        `SELECT id, status, root_path, progress_json, result_json, error, created_at, updated_at
         FROM jobs
         WHERE id = ?`,
      )
      .get(id) as unknown as JobRow | undefined;

    return row ? mapRowToJob(row) : undefined;
  }

  saveJob(job: ScanJob): void {
    const record = mapJobToRecord(job);
    const createdAt = record.progress.startedAt;
    const updatedAt = new Date().toISOString();

    this.db.prepare(
      `INSERT INTO jobs (id, status, root_path, progress_json, result_json, error, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         root_path = excluded.root_path,
         progress_json = excluded.progress_json,
         result_json = excluded.result_json,
         error = excluded.error,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at`,
    ).run(
      record.id,
      record.status,
      record.rootPath,
      JSON.stringify(record.progress),
      record.result ? JSON.stringify(record.result) : null,
      record.error ?? null,
      createdAt,
      updatedAt,
    );
  }

  deleteJob(id: string): boolean {
    const result = this.db.prepare('DELETE FROM jobs WHERE id = ?').run(id)
    return result.changes > 0
  }

  private recoverInterruptedJobs(message: string): void {
    const rows = this.db
      .prepare(
        `SELECT id, status, root_path, progress_json, result_json, error, created_at, updated_at
         FROM jobs
         WHERE status IN ('queued', 'running')`,
      )
      .all() as unknown as JobRow[];

    for (const row of rows) {
      const job = mapRowToJob(row);
      job.status = 'failed';
      job.error = message;
      job.progress.endedAt = new Date().toISOString();

      const record = mapJobToRecord(job);
      const updatedAt = new Date().toISOString();

      this.db.prepare(
        `INSERT INTO jobs (id, status, root_path, progress_json, result_json, error, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           root_path = excluded.root_path,
           progress_json = excluded.progress_json,
           result_json = excluded.result_json,
           error = excluded.error,
           created_at = excluded.created_at,
           updated_at = excluded.updated_at`,
      ).run(
        record.id,
        record.status,
        record.rootPath,
        JSON.stringify(record.progress),
        record.result ? JSON.stringify(record.result) : null,
        record.error ?? null,
        record.progress.startedAt,
        updatedAt,
      );
    }
  }

}
