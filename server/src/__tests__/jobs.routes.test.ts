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
    getNodeChildren: vi.fn(),
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

  it('returns 400 for invalid parent node id in children endpoint', async () => {
    const app = buildApp();

    const response = await request(app).get('/api/jobs/job-1/tree/nodes/not-a-number/children');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('nodeId must be a positive integer.');
  });

  it('returns children for completed jobs', async () => {
    const children: StoredDirectoryNode[] = [
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
    ];

    mockJobStore.getJob.mockResolvedValue(completedJob);
    mockJobStore.getNodeChildren.mockReturnValue(children);
    const app = buildApp();

    const response = await request(app).get('/api/jobs/job-1/tree/nodes/10/children');

    expect(response.status).toBe(200);
    expect(mockJobStore.getNodeChildren).toHaveBeenCalledWith('job-1', 10);
    expect(response.body.children).toEqual(children);
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
});
