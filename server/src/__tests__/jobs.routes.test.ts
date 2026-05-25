import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerJobRoutes } from '../routes/jobs.js';
import type { ScanJob, StoredDirectoryNode } from '../types.js';

const { mockJobStore } = vi.hoisted(() => ({
  mockJobStore: {
    createScanJob: vi.fn(),
    listJobs: vi.fn(),
    getJob: vi.fn(),
    getRootNode: vi.fn(),
    getNodeChildrenBatch: vi.fn(),
    rerunJob: vi.fn(),
    removeJob: vi.fn(),
  },
}));

vi.mock('../jobs.js', () => ({
  jobStore: mockJobStore,
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  const api = express.Router();
  registerJobRoutes(api);
  app.use('/api', api);
  return app;
}

const completedJob: ScanJob = {
  id: 'job-1',
  status: 'completed',
  rootPath: '/tmp',
  progress: {
    directoriesVisited: 1,
    filesVisited: 1,
    startedAt: '2026-01-01T00:00:00.000Z',
  },
};

const queuedJob: ScanJob = {
  id: 'job-2',
  status: 'queued',
  rootPath: '/tmp',
  progress: {
    directoriesVisited: 0,
    filesVisited: 0,
    startedAt: '2026-01-01T00:00:00.000Z',
  },
};

const rootNode: StoredDirectoryNode = {
  id: 10,
  parentId: null,
  jobId: 'job-1',
  depth: 0,
  name: 'tmp',
  path: '/tmp',
  sizeBytes: 100,
  percentOfRoot: 100,
  inaccessible: false,
  hasChildren: true,
};

describe('job tree routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for scan requests with an empty path', async () => {
    const app = buildApp();

    const response = await request(app).post('/api/jobs/scan').send({ path: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Body must contain a non-empty path field.');
    expect(mockJobStore.createScanJob).not.toHaveBeenCalled();
  });

  it('returns 400 for scan requests with a non-string path', async () => {
    const app = buildApp();

    const response = await request(app).post('/api/jobs/scan').send({ path: 123 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Body must contain a non-empty path field.');
    expect(mockJobStore.createScanJob).not.toHaveBeenCalled();
  });

  it('creates a scan job for valid scan requests', async () => {
    const createdJob: ScanJob = {
      id: 'job-3',
      status: 'queued',
      rootPath: '/var/tmp',
      progress: {
        directoriesVisited: 0,
        filesVisited: 0,
        startedAt: '2026-01-01T00:00:00.000Z',
      },
    };
    mockJobStore.createScanJob.mockReturnValue(createdJob);
    const app = buildApp();

    const response = await request(app).post('/api/jobs/scan').send({ path: '  /var/tmp  ' });

    expect(response.status).toBe(202);
    expect(mockJobStore.createScanJob).toHaveBeenCalledWith('/var/tmp');
    expect(response.body).toEqual(createdJob);
  });

  it('lists jobs', async () => {
    mockJobStore.listJobs.mockReturnValue([completedJob, queuedJob]);
    const app = buildApp();

    const response = await request(app).get('/api/jobs');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([completedJob, queuedJob]);
  });

  it('returns 404 when fetching an unknown job', async () => {
    mockJobStore.getJob.mockResolvedValue(undefined);
    const app = buildApp();

    const response = await request(app).get('/api/jobs/missing');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Job not found.');
  });

  it('returns a job when fetching a known job', async () => {
    mockJobStore.getJob.mockResolvedValue(completedJob);
    const app = buildApp();

    const response = await request(app).get('/api/jobs/job-1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(completedJob);
  });

  it('returns 404 for root request when job does not exist', async () => {
    mockJobStore.getJob.mockResolvedValue(undefined);
    const app = buildApp();

    const response = await request(app).get('/api/jobs/missing/tree/root');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Job not found.');
  });

  it('returns 409 for root request when job is not completed', async () => {
    mockJobStore.getJob.mockResolvedValue(queuedJob);
    const app = buildApp();

    const response = await request(app).get('/api/jobs/job-2/tree/root');

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Tree is only available for completed jobs.');
  });

  it('returns 404 when completed job has no persisted root node', async () => {
    mockJobStore.getJob.mockResolvedValue(completedJob);
    mockJobStore.getRootNode.mockReturnValue(undefined);
    const app = buildApp();

    const response = await request(app).get('/api/jobs/job-1/tree/root');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Root node not found for this job.');
  });

  it('returns root node for completed jobs', async () => {
    mockJobStore.getJob.mockResolvedValue(completedJob);
    mockJobStore.getRootNode.mockReturnValue(rootNode);
    const app = buildApp();

    const response = await request(app).get('/api/jobs/job-1/tree/root');

    expect(response.status).toBe(200);
    expect(response.body.node).toEqual(rootNode);
  });

  it('returns 400 when children batch body does not contain parentIds array', async () => {
    const app = buildApp();

    const response = await request(app).post('/api/jobs/job-1/tree/children-batch').send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Body must contain a parentIds array.');
  });

  it('returns 400 when children batch contains invalid parent IDs', async () => {
    const app = buildApp();

    const response = await request(app).post('/api/jobs/job-1/tree/children-batch').send({ parentIds: [10, -1, 'x'] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('parentIds must contain only positive integers.');
  });

  it('returns 400 when children batch exceeds the maximum parent IDs', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/jobs/job-1/tree/children-batch')
      .send({ parentIds: Array.from({ length: 257 }, (_, index) => index + 1) });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('parentIds cannot contain more than 256 entries.');
  });

  it('returns 404 for children batch when job does not exist', async () => {
    mockJobStore.getJob.mockResolvedValue(undefined);
    const app = buildApp();

    const response = await request(app).post('/api/jobs/missing/tree/children-batch').send({ parentIds: [10] });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Job not found.');
    expect(mockJobStore.getNodeChildrenBatch).not.toHaveBeenCalled();
  });

  it('returns 409 for children batch when job is not completed', async () => {
    mockJobStore.getJob.mockResolvedValue(queuedJob);
    const app = buildApp();

    const response = await request(app).post('/api/jobs/job-2/tree/children-batch').send({ parentIds: [10] });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Tree is only available for completed jobs.');
    expect(mockJobStore.getNodeChildrenBatch).not.toHaveBeenCalled();
  });

  it('returns batched children for completed jobs', async () => {
    const byParentId = {
      10: [
        {
          id: 11,
          parentId: 10,
          jobId: 'job-1',
          depth: 1,
          name: 'sub',
          path: '/tmp/sub',
          sizeBytes: 50,
          percentOfRoot: 50,
          inaccessible: false,
          hasChildren: false,
        },
      ],
      11: [],
    };

    mockJobStore.getJob.mockResolvedValue(completedJob);
    mockJobStore.getNodeChildrenBatch.mockReturnValue(byParentId);
    const app = buildApp();

    const response = await request(app).post('/api/jobs/job-1/tree/children-batch').send({ parentIds: [10, 11, 10] });

    expect(response.status).toBe(200);
    expect(mockJobStore.getNodeChildrenBatch).toHaveBeenCalledWith('job-1', [10, 11]);
    expect(response.body.byParentId).toEqual({
      '10': byParentId[10],
      '11': byParentId[11],
    });
  });

  it('returns 404 when rerunning an unknown job', async () => {
    mockJobStore.rerunJob.mockReturnValue(undefined);
    const app = buildApp();

    const response = await request(app).post('/api/jobs/missing/rerun');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Job not found.');
  });

  it('reruns a known job', async () => {
    const rerunJob: ScanJob = {
      ...queuedJob,
      id: 'job-4',
      rootPath: '/rerun',
    };
    mockJobStore.rerunJob.mockReturnValue(rerunJob);
    const app = buildApp();

    const response = await request(app).post('/api/jobs/job-1/rerun');

    expect(response.status).toBe(202);
    expect(mockJobStore.rerunJob).toHaveBeenCalledWith('job-1');
    expect(response.body).toEqual(rerunJob);
  });

  it('returns 404 when deleting an unknown job', async () => {
    mockJobStore.removeJob.mockReturnValue(false);
    const app = buildApp();

    const response = await request(app).delete('/api/jobs/missing');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Job not found.');
  });

  it('deletes a known job', async () => {
    mockJobStore.removeJob.mockReturnValue(true);
    const app = buildApp();

    const response = await request(app).delete('/api/jobs/job-1');

    expect(response.status).toBe(204);
    expect(mockJobStore.removeJob).toHaveBeenCalledWith('job-1');
    expect(response.text).toBe('');
  });
});
