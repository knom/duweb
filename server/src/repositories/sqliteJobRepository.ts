import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { DirectoryNode, ScanJob, StoredDirectoryNode } from '../types.js';
import type { JobRepository } from './jobRepository.js';
import { mapJobToRecord, mapRowToJob, mapRowToStoredNode, type JobNodeRow, type JobRow } from './jobMapper.js';

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
        directories_visited INTEGER NOT NULL DEFAULT 0,
        files_visited INTEGER NOT NULL DEFAULT 0,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS job_nodes (
        node_id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
        parent_node_id INTEGER,
        depth INTEGER NOT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        percent_of_root REAL NOT NULL,
        inaccessible INTEGER NOT NULL DEFAULT 0,
        has_children INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE,
        FOREIGN KEY(parent_node_id) REFERENCES job_nodes(node_id) ON DELETE CASCADE,
        UNIQUE(job_id, path)
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_job_nodes_job_parent
      ON job_nodes(job_id, parent_node_id)
    `);

    this.ensureNormalizedJobColumns();

    this.recoverInterruptedJobs('Job was interrupted by a server restart.');
  }

  private ensureNormalizedJobColumns(): void {
    const tableInfo = this.db.prepare('PRAGMA table_info(jobs)').all() as Array<{ name: string }>;
    const names = new Set(tableInfo.map((column) => column.name));

    if (!names.has('directories_visited')) {
      this.db.exec('ALTER TABLE jobs ADD COLUMN directories_visited INTEGER NOT NULL DEFAULT 0');
    }

    if (!names.has('files_visited')) {
      this.db.exec('ALTER TABLE jobs ADD COLUMN files_visited INTEGER NOT NULL DEFAULT 0');
    }

    if (!names.has('started_at')) {
      this.db.exec("ALTER TABLE jobs ADD COLUMN started_at TEXT NOT NULL DEFAULT ''");
    }

    if (!names.has('ended_at')) {
      this.db.exec('ALTER TABLE jobs ADD COLUMN ended_at TEXT');
    }

    this.db.exec("UPDATE jobs SET started_at = created_at WHERE started_at = '' OR started_at IS NULL");
  }

  listJobs(): ScanJob[] {
    const rows = this.db
      .prepare(
        `SELECT id, status, root_path, directories_visited, files_visited, started_at, ended_at, error, created_at, updated_at
         FROM jobs
         ORDER BY datetime(created_at) DESC`,
      )
      .all() as unknown as JobRow[];

    return rows.map((row) => mapRowToJob(row));
  }

  getJob(id: string): ScanJob | undefined {
    const row = this.db
      .prepare(
        `SELECT id, status, root_path, directories_visited, files_visited, started_at, ended_at, error, created_at, updated_at
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
    const endedAt = record.progress.endedAt ?? null;

    this.db.prepare(
      `INSERT INTO jobs (id, status, root_path, directories_visited, files_visited, started_at, ended_at, error, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         root_path = excluded.root_path,
         directories_visited = excluded.directories_visited,
         files_visited = excluded.files_visited,
         started_at = excluded.started_at,
         ended_at = excluded.ended_at,
         error = excluded.error,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at`,
    ).run(
      record.id,
      record.status,
      record.rootPath,
      record.progress.directoriesVisited,
      record.progress.filesVisited,
      record.progress.startedAt,
      endedAt,
      record.error ?? null,
      createdAt,
      updatedAt,
    );
  }

  saveJobTree(jobId: string, root: DirectoryNode): void {
    const deleteStmt = this.db.prepare('DELETE FROM job_nodes WHERE job_id = ?');
    const insertStmt = this.db.prepare(
      `INSERT INTO job_nodes (job_id, parent_node_id, depth, name, path, size_bytes, percent_of_root, inaccessible, has_children)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    this.db.exec('BEGIN');
    try {
      deleteStmt.run(jobId);

      const stack: Array<{ node: DirectoryNode; parentId: number | null; depth: number }> = [
        { node: root, parentId: null, depth: 0 },
      ];

      while (stack.length > 0) {
        const current = stack.pop();
        if (!current) {
          continue;
        }

        const insertResult = insertStmt.run(
          jobId,
          current.parentId,
          current.depth,
          current.node.name,
          current.node.path,
          current.node.sizeBytes,
          current.node.percentOfRoot,
          current.node.inaccessible ? 1 : 0,
          current.node.children.length > 0 ? 1 : 0,
        );

        const nodeId = Number(insertResult.lastInsertRowid);

        for (let index = current.node.children.length - 1; index >= 0; index -= 1) {
          const child = current.node.children[index];
          if (!child) {
            continue;
          }

          stack.push({ node: child, parentId: nodeId, depth: current.depth + 1 });
        }
      }

      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  getJobRootNode(jobId: string): StoredDirectoryNode | undefined {
    const row = this.db
      .prepare(
        `SELECT node_id, job_id, parent_node_id, depth, name, path, size_bytes, percent_of_root, inaccessible, has_children
         FROM job_nodes
         WHERE job_id = ? AND parent_node_id IS NULL
         LIMIT 1`,
      )
      .get(jobId) as unknown as JobNodeRow | undefined;

    return row ? mapRowToStoredNode(row) : undefined;
  }

  getJobNodeChildren(jobId: string, parentNodeId: number): StoredDirectoryNode[] {
    const rows = this.db
      .prepare(
        `SELECT node_id, job_id, parent_node_id, depth, name, path, size_bytes, percent_of_root, inaccessible, has_children
         FROM job_nodes
         WHERE job_id = ? AND parent_node_id = ?
         ORDER BY size_bytes DESC, name ASC`,
      )
      .all(jobId, parentNodeId) as unknown as JobNodeRow[];

    return rows.map((row) => mapRowToStoredNode(row));
  }

  getJobNodeChildrenBatch(jobId: string, parentNodeIds: number[]): Record<number, StoredDirectoryNode[]> {
    if (parentNodeIds.length === 0) {
      return {};
    }

    const uniqueParentIds = [...new Set(parentNodeIds)];
    const placeholders = uniqueParentIds.map(() => '?').join(', ');

    const rows = this.db
      .prepare(
        `SELECT node_id, job_id, parent_node_id, depth, name, path, size_bytes, percent_of_root, inaccessible, has_children
         FROM job_nodes
         WHERE job_id = ? AND parent_node_id IN (${placeholders})
         ORDER BY parent_node_id ASC, size_bytes DESC, name ASC`,
      )
      .all(jobId, ...uniqueParentIds) as unknown as JobNodeRow[];

    const byParentId = Object.fromEntries(uniqueParentIds.map((id) => [id, [] as StoredDirectoryNode[]])) as Record<
      number,
      StoredDirectoryNode[]
    >;

    for (const row of rows) {
      const node = mapRowToStoredNode(row);
      const parentId = node.parentId;

      if (parentId === null) {
        continue;
      }

      const existing = byParentId[parentId] ?? [];
      existing.push(node);
      byParentId[parentId] = existing;
    }

    return byParentId;
  }

  deleteJob(id: string): boolean {
    const result = this.db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private recoverInterruptedJobs(message: string): void {
    const rows = this.db
      .prepare(
        `SELECT id, status, root_path, directories_visited, files_visited, started_at, ended_at, error, created_at, updated_at
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
        `INSERT INTO jobs (id, status, root_path, directories_visited, files_visited, started_at, ended_at, error, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           root_path = excluded.root_path,
           directories_visited = excluded.directories_visited,
           files_visited = excluded.files_visited,
           started_at = excluded.started_at,
           ended_at = excluded.ended_at,
           error = excluded.error,
           created_at = excluded.created_at,
           updated_at = excluded.updated_at`,
      ).run(
        record.id,
        record.status,
        record.rootPath,
        record.progress.directoriesVisited,
        record.progress.filesVisited,
        record.progress.startedAt,
        record.progress.endedAt ?? null,
        record.error ?? null,
        record.progress.startedAt,
        updatedAt,
      );
    }
  }
}
