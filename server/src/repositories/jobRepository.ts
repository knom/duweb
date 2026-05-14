import type { ScanJob } from '../types.js';

export interface JobRepository {
  initialize(): void;
  listJobs(): ScanJob[];
  getJob(id: string): ScanJob | undefined;
  saveJob(job: ScanJob): void;
}
