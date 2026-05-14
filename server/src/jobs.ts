import { randomUUID } from 'node:crypto';
import { scanDirectoryTree } from './scanner.js';
import type { ScanJob } from './types.js';
import type { JobRepository } from './repositories/jobRepository.js';
import { createJobRepository } from './repositories/createJobRepository.js';
import { redisCache } from './cache/redisCache.js';

class JobStore {
  private readonly jobs = new Map<string, ScanJob>();

  constructor(private readonly repository: JobRepository = createJobRepository()) {
    this.repository.initialize();

    for (const job of this.repository.listJobs()) {
      this.jobs.set(job.id, job);
    }
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

    setImmediate(() => {
      void this.runJob(created.id);
    });

    return created;
  }

  async getJob(id: string): Promise<ScanJob | undefined> {
    const cached = this.jobs.get(id);
    if (!cached) return undefined;

    // Lazy-load the result tree from Redis/DB on first access for completed jobs
    if (cached.status === 'completed' && !cached.result) {
      // Try Redis first
      let result = await redisCache.getCached(id);
      if (result) {
        cached.result = result;
      } else {
        // Fall back to DB
        const full = this.repository.getJob(id);
        if (full?.result) {
          cached.result = full.result;
          // Cache in Redis for future access
          await redisCache.setCached(id, full.result);
        }
      }
    }

    return cached;
  }

  removeJob(id: string): boolean {
    const removed = this.repository.deleteJob(id)
    if (removed) {
      this.jobs.delete(id)
    }

    return removed
  }

  rerunJob(id: string): ScanJob | undefined {
    const source = this.jobs.get(id)
    if (!source) {
      return undefined
    }

    return this.createScanJob(source.rootPath)
  }

  listJobs(): ScanJob[] {
    return [...this.jobs.values()]
      .map(({ result: _r, ...rest }) => rest)
      .sort(
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

    try {
      job.result = await scanDirectoryTree(job.rootPath, job.progress);
      job.status = 'completed';
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown scan error';
    } finally {
      job.progress.endedAt = new Date().toISOString();
      this.repository.saveJob(job);
      // Cache completed results in Redis
      if (job.status === 'completed' && job.result) {
        await redisCache.setCached(job.id, job.result);
      }
    }
  }
}

export const jobStore = new JobStore();
