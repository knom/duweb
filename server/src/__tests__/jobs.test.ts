import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JobRepository } from '../repositories/jobRepository.js';
import { JobStore } from '../jobs.js';
import { DirectoryScanner } from '../scanner.js';

const { singletonRepositoryMock, scanDirectoryTreeMock } = vi.hoisted(() => ({
  singletonRepositoryMock: {
    initialize: vi.fn(),
    listJobs: vi.fn(() => []),
    saveJob: vi.fn(),
    saveJobTree: vi.fn(),
    getJobRootNode: vi.fn(),
    getJobNodeChildrenBatch: vi.fn(() => ({})),
    deleteJob: vi.fn(() => false),
  },
  scanDirectoryTreeMock: vi.fn(async (path: string, progress: { directoriesVisited: number; filesVisited: number; endedAt?: string }) => {
    progress.directoriesVisited = 10;
    progress.filesVisited = 100;
    progress.endedAt = new Date().toISOString();
    return {
      name: 'root',
      path,
      sizeBytes: 1000000,
      percentOfRoot: 100,
      children: [],
    };
  }),
}));

vi.mock('../scanner.js', () => ({
  DirectoryScanner: {
    scanDirectoryTree: scanDirectoryTreeMock,
  },
}));

vi.mock('../repositories/createJobRepository.js', () => ({
  createJobRepository: () => singletonRepositoryMock,
}));

type RepositoryMock = JobRepository & {
  initialize: ReturnType<typeof vi.fn>;
  listJobs: ReturnType<typeof vi.fn>;
  saveJob: ReturnType<typeof vi.fn>;
  saveJobTree: ReturnType<typeof vi.fn>;
  getJobRootNode: ReturnType<typeof vi.fn>;
  getJobNodeChildrenBatch: ReturnType<typeof vi.fn>;
  deleteJob: ReturnType<typeof vi.fn>;
};

function createRepositoryMock(): RepositoryMock {
  return {
    initialize: vi.fn(),
    listJobs: vi.fn(() => []),
    saveJob: vi.fn(),
    saveJobTree: vi.fn(),
    getJobRootNode: vi.fn(),
    getJobNodeChildrenBatch: vi.fn(() => ({})),
    deleteJob: vi.fn(() => false),
  };
}

async function waitForCondition(assertion: () => void | Promise<void>, timeoutMs = 2000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await assertion();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  await assertion();
}

describe('JobStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates scan jobs with runtime and required fields', () => {
    const repository = createRepositoryMock();
    const store = new JobStore(repository);

    const job = store.createScanJob('/home/user');

    expect(job.id).toBeDefined();
    expect(job.status).toBe('queued');
    expect(job.rootPath).toBe('/home/user');
    expect(job.progress.startedAt).toBeDefined();
    expect(typeof job.runtimeMs).toBe('number');
    expect(job.runtimeMs).toBeGreaterThanOrEqual(0);
  });

  it('lists jobs sorted by start time descending', () => {
    const repository = createRepositoryMock();
    const store = new JobStore(repository);

    store.createScanJob('/home/user1');
    store.createScanJob('/home/user2');

    const jobs = store.listJobs();
    expect(jobs.length).toBeGreaterThanOrEqual(2);
    expect(new Date(jobs[0]?.progress.startedAt ?? '').getTime()).toBeGreaterThanOrEqual(
      new Date(jobs[1]?.progress.startedAt ?? '').getTime(),
    );
  });

  it('returns created jobs with runtime and returns undefined for unknown ids', async () => {
    const repository = createRepositoryMock();
    const store = new JobStore(repository);

    const created = store.createScanJob('/home/user');
    const retrieved = await store.getJob(created.id);
    const missing = await store.getJob('non-existent-id');

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.runtimeMs).toBeGreaterThanOrEqual(0);
    expect(missing).toBeUndefined();
  });

  it('returns a new queued job when rerunning an existing job', () => {
    const repository = createRepositoryMock();
    const store = new JobStore(repository);

    const original = store.createScanJob('/home/user');
    const rerun = store.rerunJob(original.id);

    expect(rerun).toBeDefined();
    expect(rerun?.id).not.toBe(original.id);
    expect(rerun?.rootPath).toBe(original.rootPath);
    expect(rerun?.status).toBe('queued');
  });

  it('returns undefined when rerunning a non-existent job', () => {
    const repository = createRepositoryMock();
    const store = new JobStore(repository);

    const rerun = store.rerunJob('missing-id');
    expect(rerun).toBeUndefined();
  });

  it('removes existing jobs when repository delete succeeds', async () => {
    const repository = createRepositoryMock();
    const store = new JobStore(repository);

    const job = store.createScanJob('/home/user');
    repository.deleteJob.mockImplementation((id: string) => id === job.id);

    const removed = store.removeJob(job.id);
    const fetchedAfterDelete = await store.getJob(job.id);

    expect(removed).toBe(true);
    expect(fetchedAfterDelete).toBeUndefined();
  });

  it('keeps jobs when repository delete fails', async () => {
    const repository = createRepositoryMock();
    const store = new JobStore(repository);

    const job = store.createScanJob('/home/user');
    repository.deleteJob.mockReturnValue(false);

    const removed = store.removeJob(job.id);
    const fetchedAfterDelete = await store.getJob(job.id);

    expect(removed).toBe(false);
    expect(fetchedAfterDelete).toBeDefined();
  });

  it('keeps completed runtime stable between reads', async () => {
    const repository = createRepositoryMock();
    const store = new JobStore(repository);

    const created = store.createScanJob('/home/stable-runtime');

    await waitForCondition(async () => {
      const completed = await store.getJob(created.id);
      expect(completed?.status).toBe('completed');
    });

    const firstRead = await store.getJob(created.id);
    await new Promise((resolve) => setTimeout(resolve, 25));
    const secondRead = await store.getJob(created.id);

    expect(firstRead?.runtimeMs).toBeDefined();
    expect(firstRead?.runtimeMs).toBe(secondRead?.runtimeMs);
  });

  it('prunes older completed jobs with the same root path once a newer job completes', async () => {
    const repository = createRepositoryMock();
    const store = new JobStore(repository);
    repository.deleteJob.mockReturnValue(true);

    const rootPath = '/home/shared-root';
    const older = store.createScanJob(rootPath);

    await waitForCondition(async () => {
      const olderJob = await store.getJob(older.id);
      expect(olderJob?.status).toBe('completed');
    });

    const newer = store.createScanJob(rootPath);

    await waitForCondition(async () => {
      const newerJob = await store.getJob(newer.id);
      expect(newerJob?.status).toBe('completed');
    });

    const sameRootJobs = store.listJobs().filter((job) => job.rootPath === rootPath);
    expect(sameRootJobs).toHaveLength(1);
    expect(sameRootJobs[0]?.id).toBe(newer.id);
  });

  it('computes increasing runtime for active jobs', async () => {
    const repository = createRepositoryMock();
    const store = new JobStore(repository);

    const scannerMock = vi.mocked(DirectoryScanner.scanDirectoryTree);
    scannerMock.mockImplementationOnce(
      async (_path, progress: { directoriesVisited: number; filesVisited: number; endedAt?: string }) => {
        await new Promise((resolve) => setTimeout(resolve, 80));
        progress.directoriesVisited = 1;
        progress.filesVisited = 1;
        return {
          name: 'root',
          path: '/home/slow',
          sizeBytes: 1,
          percentOfRoot: 100,
          children: [],
        };
      },
    );

    const created = store.createScanJob('/home/slow');

    const first = await store.getJob(created.id);
    await new Promise((resolve) => setTimeout(resolve, 30));
    const second = await store.getJob(created.id);

    expect(first?.runtimeMs).toBeDefined();
    expect(second?.runtimeMs).toBeDefined();
    expect((second?.runtimeMs ?? 0) - (first?.runtimeMs ?? 0)).toBeGreaterThanOrEqual(0);
  });
});
