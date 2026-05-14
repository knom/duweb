import type { JobStatus, ScanJob, ScanProgress, StoredDirectoryNode } from '../types.js';

export interface JobRow {
  id: string;
  status: string;
  root_path: string;
  directories_visited: number;
  files_visited: number;
  started_at: string;
  ended_at?: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobNodeRow {
  node_id: number;
  job_id: string;
  parent_node_id?: number | null;
  depth: number;
  name: string;
  path: string;
  size_bytes: number;
  percent_of_root: number;
  inaccessible: number;
  has_children: number;
}

export interface PersistedJobRecord {
  id: string;
  status: JobStatus;
  rootPath: string;
  progress: ScanProgress;
  error?: string;
}

export function mapRowToJob(row: JobRow): ScanJob {
  const progress: ScanProgress = {
    directoriesVisited: row.directories_visited,
    filesVisited: row.files_visited,
    startedAt: row.started_at,
  };

  if (row.ended_at) {
    progress.endedAt = row.ended_at;
  }

  const job: ScanJob = {
    id: row.id,
    status: row.status as ScanJob['status'],
    rootPath: row.root_path,
    progress,
  };

  if (row.error) {
    job.error = row.error;
  }

  return job;
}

export function mapJobToRecord(job: ScanJob): PersistedJobRecord {
  const record: PersistedJobRecord = {
    id: job.id,
    status: job.status,
    rootPath: job.rootPath,
    progress: job.progress,
  };

  if (job.error) {
    record.error = job.error;
  }

  return record;
}

export function mapRowToStoredNode(row: JobNodeRow): StoredDirectoryNode {
  return {
    id: row.node_id,
    parentId: row.parent_node_id ?? null,
    jobId: row.job_id,
    depth: row.depth,
    name: row.name,
    path: row.path,
    sizeBytes: row.size_bytes,
    percentOfRoot: row.percent_of_root,
    inaccessible: row.inaccessible === 1,
    hasChildren: row.has_children === 1,
  };
}
