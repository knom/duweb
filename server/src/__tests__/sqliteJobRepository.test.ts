import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DirectoryNode, ScanJob } from '../types.js';
import { SQLiteJobRepository } from '../repositories/sqliteJobRepository.js';

describe('SQLiteJobRepository', () => {
  let tempDir = '';
  let repo: SQLiteJobRepository;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'duweb-repo-'));
    vi.stubEnv('HOME', tempDir);

    repo = new SQLiteJobRepository(path.join(tempDir, 'jobs.sqlite'));
    repo.initialize();
  });

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('saveJob and getJob', () => {
    it('saves and retrieves a job', () => {
      const job: ScanJob = {
        id: 'job-1',
        status: 'queued',
        rootPath: '/tmp/scan',
        progress: {
          directoriesVisited: 0,
          filesVisited: 0,
          startedAt: new Date().toISOString(),
        },
      };

      repo.saveJob(job);
      const retrieved = repo.getJob('job-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('job-1');
      expect(retrieved?.status).toBe('queued');
      expect(retrieved?.rootPath).toBe('/tmp/scan');
      expect(retrieved?.progress.directoriesVisited).toBe(0);
    });

    it('updates an existing job', () => {
      const job: ScanJob = {
        id: 'job-2',
        status: 'running',
        rootPath: '/data',
        progress: {
          directoriesVisited: 5,
          filesVisited: 10,
          startedAt: new Date().toISOString(),
        },
      };

      repo.saveJob(job);

      const updated: ScanJob = {
        ...job,
        status: 'completed',
        progress: {
          ...job.progress,
          directoriesVisited: 20,
          filesVisited: 100,
          endedAt: new Date().toISOString(),
        },
      };

      repo.saveJob(updated);
      const retrieved = repo.getJob('job-2');

      expect(retrieved?.status).toBe('completed');
      expect(retrieved?.progress.directoriesVisited).toBe(20);
      expect(retrieved?.progress.filesVisited).toBe(100);
      expect(retrieved?.progress.endedAt).toBeDefined();
    });

    it('includes error when present in job', () => {
      const job: ScanJob = {
        id: 'job-error',
        status: 'failed',
        rootPath: '/bad',
        progress: {
          directoriesVisited: 0,
          filesVisited: 0,
          startedAt: new Date().toISOString(),
        },
        error: 'Permission denied',
      };

      repo.saveJob(job);
      const retrieved = repo.getJob('job-error');

      expect(retrieved?.error).toBe('Permission denied');
    });

    it('returns undefined for non-existent job', () => {
      const retrieved = repo.getJob('missing-job');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('listJobs', () => {
    it('returns all jobs sorted by creation time descending', () => {
      const job1: ScanJob = {
        id: 'job-a',
        status: 'completed',
        rootPath: '/path-a',
        progress: {
          directoriesVisited: 1,
          filesVisited: 1,
          startedAt: new Date('2026-05-14T10:00:00Z').toISOString(),
        },
      };

      const job2: ScanJob = {
        id: 'job-b',
        status: 'completed',
        rootPath: '/path-b',
        progress: {
          directoriesVisited: 2,
          filesVisited: 2,
          startedAt: new Date('2026-05-14T10:01:00Z').toISOString(),
        },
      };

      repo.saveJob(job1);
      repo.saveJob(job2);

      const jobs = repo.listJobs();

      expect(jobs).toHaveLength(2);
      expect(jobs[0]?.id).toBe('job-b');
      expect(jobs[1]?.id).toBe('job-a');
    });

    it('returns empty list when no jobs exist', () => {
      const jobs = repo.listJobs();
      expect(jobs).toEqual([]);
    });
  });

  describe('deleteJob', () => {
    it('removes a job and returns true', () => {
      const job: ScanJob = {
        id: 'job-del',
        status: 'completed',
        rootPath: '/tmp',
        progress: {
          directoriesVisited: 0,
          filesVisited: 0,
          startedAt: new Date().toISOString(),
        },
      };

      repo.saveJob(job);
      const result = repo.deleteJob('job-del');
      const retrieved = repo.getJob('job-del');

      expect(result).toBe(true);
      expect(retrieved).toBeUndefined();
    });

    it('returns false when job does not exist', () => {
      const result = repo.deleteJob('missing-job');
      expect(result).toBe(false);
    });
  });

  describe('saveJobTree and getRootNode', () => {
    it('saves a directory tree and retrieves the root node', () => {
      const job: ScanJob = {
        id: 'job-tree-1',
        status: 'completed',
        rootPath: '/home/user',
        progress: {
          directoriesVisited: 1,
          filesVisited: 0,
          startedAt: new Date().toISOString(),
        },
      };

      const tree: DirectoryNode = {
        name: 'user',
        path: '/home/user',
        sizeBytes: 1000,
        percentOfRoot: 100,
        children: [],
      };

      repo.saveJob(job);
      repo.saveJobTree('job-tree-1', tree);

      const rootNode = repo.getJobRootNode('job-tree-1');

      expect(rootNode).toBeDefined();
      expect(rootNode?.name).toBe('user');
      expect(rootNode?.path).toBe('/home/user');
      expect(rootNode?.sizeBytes).toBe(1000);
      expect(rootNode?.percentOfRoot).toBe(100);
      expect(rootNode?.parentId).toBeNull();
      expect(rootNode?.depth).toBe(0);
    });

    it('returns undefined when tree not found for job', () => {
      const rootNode = repo.getJobRootNode('missing-job');
      expect(rootNode).toBeUndefined();
    });
  });

  describe('getJobNodeChildrenBatch', () => {
    it('retrieves children for multiple parent nodes', () => {
      const job: ScanJob = {
        id: 'job-batch',
        status: 'completed',
        rootPath: '/data',
        progress: {
          directoriesVisited: 3,
          filesVisited: 0,
          startedAt: new Date().toISOString(),
        },
      };

      const tree: DirectoryNode = {
        name: 'data',
        path: '/data',
        sizeBytes: 300,
        percentOfRoot: 100,
        children: [
          {
            name: 'sub1',
            path: '/data/sub1',
            sizeBytes: 100,
            percentOfRoot: 33,
            children: [],
          },
          {
            name: 'sub2',
            path: '/data/sub2',
            sizeBytes: 200,
            percentOfRoot: 67,
            children: [],
          },
        ],
      };

      repo.saveJob(job);
      repo.saveJobTree('job-batch', tree);

      const rootNode = repo.getJobRootNode('job-batch');
      const rootId = rootNode?.id;

      expect(rootId).toBeDefined();

      const byParent = repo.getJobNodeChildrenBatch('job-batch', [rootId!]);

      expect(byParent[rootId!]).toBeDefined();
      expect(byParent[rootId!]?.length).toBe(2);
      // Results are sorted by size_bytes DESC, so sub2 (200 bytes) comes first, then sub1 (100 bytes)
      expect(byParent[rootId!]?.[0]?.name).toBe('sub2');
      expect(byParent[rootId!]?.[1]?.name).toBe('sub1');
    });

    it('returns empty object when parent IDs array is empty', () => {
      const byParent = repo.getJobNodeChildrenBatch('job-batch', []);
      expect(byParent).toEqual({});
    });

    it('returns data for valid parent IDs and empty arrays for non-existent parents', () => {
      const job: ScanJob = {
        id: 'job-sparse',
        status: 'completed',
        rootPath: '/tmp',
        progress: {
          directoriesVisited: 1,
          filesVisited: 0,
          startedAt: new Date().toISOString(),
        },
      };

      const tree: DirectoryNode = {
        name: 'tmp',
        path: '/tmp',
        sizeBytes: 100,
        percentOfRoot: 100,
        children: [],
      };

      repo.saveJob(job);
      repo.saveJobTree('job-sparse', tree);

      const byParent = repo.getJobNodeChildrenBatch('job-sparse', [999, 1000]);

      expect(byParent[999]).toEqual([]);
      expect(byParent[1000]).toEqual([]);
    });
  });
});
