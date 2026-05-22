import { describe, expect, it } from 'vitest';
import type { ScanJob, ScanProgress } from '../types.js';
import { JobMapper, type JobNodeRow, type JobRow } from '../repositories/jobMapper.js';

describe('JobMapper', () => {
  describe('mapRowToJob', () => {
    it('maps a job row to a ScanJob with required fields', () => {
      const row: JobRow = {
        id: 'job-123',
        status: 'completed',
        root_path: '/home/user',
        directories_visited: 5,
        files_visited: 20,
        started_at: '2026-05-14T10:00:00.000Z',
        ended_at: '2026-05-14T10:05:00.000Z',
        error: null,
        created_at: '2026-05-14T10:00:00.000Z',
        updated_at: '2026-05-14T10:05:00.000Z',
      };

      const job = JobMapper.mapRowToJob(row);

      expect(job.id).toBe('job-123');
      expect(job.status).toBe('completed');
      expect(job.rootPath).toBe('/home/user');
      expect(job.progress.directoriesVisited).toBe(5);
      expect(job.progress.filesVisited).toBe(20);
      expect(job.progress.startedAt).toBe('2026-05-14T10:00:00.000Z');
      expect(job.progress.endedAt).toBe('2026-05-14T10:05:00.000Z');
      expect(job.error).toBeUndefined();
    });

    it('includes error if present in row', () => {
      const row: JobRow = {
        id: 'job-fail',
        status: 'failed',
        root_path: '/bad/path',
        directories_visited: 0,
        files_visited: 0,
        started_at: '2026-05-14T10:00:00.000Z',
        ended_at: null,
        error: 'Permission denied',
        created_at: '2026-05-14T10:00:00.000Z',
        updated_at: '2026-05-14T10:00:01.000Z',
      };

      const job = JobMapper.mapRowToJob(row);

      expect(job.error).toBe('Permission denied');
    });

    it('omits endedAt from progress if not in row', () => {
      const row: JobRow = {
        id: 'job-running',
        status: 'running',
        root_path: '/home/user',
        directories_visited: 2,
        files_visited: 8,
        started_at: '2026-05-14T10:00:00.000Z',
        ended_at: null,
        error: null,
        created_at: '2026-05-14T10:00:00.000Z',
        updated_at: '2026-05-14T10:00:10.000Z',
      };

      const job = JobMapper.mapRowToJob(row);

      expect(job.progress.endedAt).toBeUndefined();
    });
  });

  describe('mapJobToRecord', () => {
    it('maps a completed ScanJob to a persisted record', () => {
      const job: ScanJob = {
        id: 'job-456',
        status: 'completed',
        rootPath: '/var/www',
        progress: {
          directoriesVisited: 10,
          filesVisited: 50,
          startedAt: '2026-05-14T11:00:00.000Z',
          endedAt: '2026-05-14T11:05:00.000Z',
        },
      };

      const record = JobMapper.mapJobToRecord(job);

      expect(record.id).toBe('job-456');
      expect(record.status).toBe('completed');
      expect(record.rootPath).toBe('/var/www');
      expect(record.progress.directoriesVisited).toBe(10);
      expect(record.progress.filesVisited).toBe(50);
      expect(record.progress.startedAt).toBe('2026-05-14T11:00:00.000Z');
      expect(record.progress.endedAt).toBe('2026-05-14T11:05:00.000Z');
      expect(record.error).toBeUndefined();
    });

    it('includes error if present in job', () => {
      const job: ScanJob = {
        id: 'job-error',
        status: 'failed',
        rootPath: '/inaccessible',
        progress: {
          directoriesVisited: 0,
          filesVisited: 0,
          startedAt: '2026-05-14T12:00:00.000Z',
        },
        error: 'Access denied',
      };

      const record = JobMapper.mapJobToRecord(job);

      expect(record.error).toBe('Access denied');
    });
  });

  describe('mapRowToStoredNode', () => {
    it('maps a job node row to a StoredDirectoryNode', () => {
      const row: JobNodeRow = {
        node_id: 100,
        job_id: 'job-789',
        parent_node_id: null,
        depth: 0,
        name: 'root',
        path: '/home/user',
        size_bytes: 1024000,
        percent_of_root: 100,
        inaccessible: 0,
        has_children: 1,
      };

      const node = JobMapper.mapRowToStoredNode(row);

      expect(node.id).toBe(100);
      expect(node.jobId).toBe('job-789');
      expect(node.parentId).toBeNull();
      expect(node.depth).toBe(0);
      expect(node.name).toBe('root');
      expect(node.path).toBe('/home/user');
      expect(node.sizeBytes).toBe(1024000);
      expect(node.percentOfRoot).toBe(100);
      expect(node.inaccessible).toBe(false);
      expect(node.hasChildren).toBe(true);
    });

    it('converts inaccessible and hasChildren from integers to booleans', () => {
      const row: JobNodeRow = {
        node_id: 101,
        job_id: 'job-789',
        parent_node_id: 100,
        depth: 1,
        name: 'inaccessible-dir',
        path: '/home/user/restricted',
        size_bytes: 0,
        percent_of_root: 0,
        inaccessible: 1,
        has_children: 0,
      };

      const node = JobMapper.mapRowToStoredNode(row);

      expect(node.inaccessible).toBe(true);
      expect(node.hasChildren).toBe(false);
    });

    it('handles null parent_node_id as null', () => {
      const row: JobNodeRow = {
        node_id: 102,
        job_id: 'job-789',
        parent_node_id: null,
        depth: 0,
        name: 'root',
        path: '/data',
        size_bytes: 5000,
        percent_of_root: 100,
        inaccessible: 0,
        has_children: 0,
      };

      const node = JobMapper.mapRowToStoredNode(row);

      expect(node.parentId).toBeNull();
    });
  });
});
