import { randomUUID } from 'node:crypto';
import { scanDirectoryTree } from './scanner.js';
import type { ScanJob } from './types.js';

class JobStore {
  private readonly jobs = new Map<string, ScanJob>();

  createScanJob(rootPath: string): ScanJob {
    const id = randomUUID();
    const created: ScanJob = {
      id,
      status: 'queued',
      rootPath,
      progress: {
        directoriesVisited: 0,
        filesVisited: 0,
        startedAt: new Date().toISOString(),
      },
    };

    this.jobs.set(id, created);

    setImmediate(() => {
      void this.runJob(id);
    });

    return created;
  }

  getJob(id: string): ScanJob | undefined {
    return this.jobs.get(id);
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

    try {
      job.result = await scanDirectoryTree(job.rootPath, job.progress);
      job.status = 'completed';
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown scan error';
    } finally {
      job.progress.endedAt = new Date().toISOString();
    }
  }
}

export const jobStore = new JobStore();
