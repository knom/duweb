import type { DirectoryNode, ScanJob, StoredDirectoryNode } from '../types.js';

export interface JobRepository {
  initialize(): void;
  listJobs(): ScanJob[];
  getJob(id: string): ScanJob | undefined;
  saveJob(job: ScanJob): void;
  saveJobTree(jobId: string, root: DirectoryNode): void;
  getJobRootNode(jobId: string): StoredDirectoryNode | undefined;
  getJobNodeChildren(jobId: string, parentNodeId: number): StoredDirectoryNode[];
  deleteJob(id: string): boolean;
}
