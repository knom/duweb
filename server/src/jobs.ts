import { randomUUID } from 'node:crypto';
import { scanDirectoryTree } from './scanner.js';
import type { ScanJob, StoredDirectoryNode } from './types.js';
import type { JobRepository } from './repositories/jobRepository.js';
import { createJobRepository } from './repositories/createJobRepository.js';

class JobStore {
  private readonly jobs = new Map<string, ScanJob>();

  constructor(private readonly repository: JobRepository = createJobRepository()) {
    this.repository.initialize();

    const persistedJobs = this.repository.listJobs();
    for (const job of persistedJobs) {
      this.jobs.set(job.id, job);
    }
    console.log(`[JobStore] Initialized with ${persistedJobs.length} persisted job(s)`);
  }

  createScanJob(rootPath: string): ScanJob {
    const created: ScanJob = {
      id: randomUUID(),
      status: 'queued',
      rootPath,
      progress: {
        directoriesVisited: 0,
        filesVisited: 0,
        startedAt: new Date().toISOString(),
      },
    };

    this.jobs.set(created.id, created);
    this.repository.saveJob(created);
    console.log(`[JobStore] Created job ${created.id}: ${rootPath}`);

    setImmediate(() => {
      void this.runJob(created.id);
    });

    return created;
  }

  async getJob(id: string): Promise<ScanJob | undefined> {
    const cached = this.jobs.get(id);
    if (!cached) {
      console.debug(`[JobStore] Job not found: ${id}`);
      return undefined;
    }

    return cached;
  }

  getRootNode(jobId: string): StoredDirectoryNode | undefined {
    return this.repository.getJobRootNode(jobId);
  }

  getNodeChildrenBatch(jobId: string, parentNodeIds: number[]): Record<number, StoredDirectoryNode[]> {
    return this.repository.getJobNodeChildrenBatch(jobId, parentNodeIds);
  }

  removeJob(id: string): boolean {
    const removed = this.repository.deleteJob(id);
    if (removed) {
      this.jobs.delete(id);
      console.log(`[JobStore] Deleted job: ${id}`);
    } else {
      console.debug(`[JobStore] Could not delete job (not found): ${id}`);
    }
    return removed;
  }

  rerunJob(id: string): ScanJob | undefined {
    const source = this.jobs.get(id);
    if (!source) {
      console.debug(`[JobStore] Cannot rerun: job not found: ${id}`);
      return undefined;
    }

    console.log(`[JobStore] Rerunning job ${id}: ${source.rootPath}`);
    return this.createScanJob(source.rootPath);
  }

  listJobs(): ScanJob[] {
    return [...this.jobs.values()].sort(
      (a, b) => new Date(b.progress.startedAt).getTime() - new Date(a.progress.startedAt).getTime(),
    );
  }

  private async runJob(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) {
      return;
    }

    job.status = 'running';
    this.repository.saveJob(job);
    console.log(`[JobStore] Job running: ${id} (${job.rootPath})`);

    try {
      const scannedTree = await scanDirectoryTree(job.rootPath, job.progress);
      this.repository.saveJobTree(job.id, scannedTree);
      job.status = 'completed';
      const duration = job.progress.endedAt
        ? new Date(job.progress.endedAt).getTime() - new Date(job.progress.startedAt).getTime()
        : 0;
      console.log(
        `[JobStore] Job completed: ${id} (${job.progress.directoriesVisited} dirs, ${job.progress.filesVisited} files, ${duration}ms)`,
      );
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown scan error';
      console.error(`[JobStore] Job failed: ${id}`, error);
    } finally {
      job.progress.endedAt = new Date().toISOString();
      this.repository.saveJob(job);
    }
  }
}

export const jobStore = new JobStore();
