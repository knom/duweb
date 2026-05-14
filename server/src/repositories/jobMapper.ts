import type { DirectoryNode, JobStatus, ScanJob, ScanProgress } from '../types.js';

export interface JobRow {
  id: string;
  status: string;
  root_path: string;
  progress_json: string;
  result_json?: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersistedJobRecord {
  id: string;
  status: JobStatus;
  rootPath: string;
  progress: ScanProgress;
  result?: DirectoryNode;
  error?: string;
}

export function mapRowToJob(row: JobRow): ScanJob {
  const progress = JSON.parse(row.progress_json) as ScanProgress;
  const result = row.result_json ? (JSON.parse(row.result_json) as DirectoryNode) : undefined;

  const job: ScanJob = {
    id: row.id,
    status: row.status as ScanJob['status'],
    rootPath: row.root_path,
    progress,
  };

  if (result) {
    job.result = result;
  }

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

  if (job.result) {
    record.result = job.result;
  }

  if (job.error) {
    record.error = job.error;
  }

  return record;
}
