import type { Response, Router } from 'express';
import { jobStore } from '../jobs.js';

const MAX_BATCH_PARENT_IDS = 256;

export function registerJobRoutes(api: Router) {
  async function ensureCompletedTreeJob(jobId: string, res: Response): Promise<boolean> {
    const job = await jobStore.getJob(jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found.' });
      return false;
    }

    if (job.status !== 'completed') {
      res.status(409).json({ error: 'Tree is only available for completed jobs.' });
      return false;
    }

    return true;
  }

  api.post('/jobs/scan', (req, res) => {
    const scanPath = typeof req.body?.path === 'string' ? req.body.path.trim() : '';

    if (!scanPath) {
      console.warn('[Jobs] Scan request with empty path');
      res.status(400).json({ error: 'Body must contain a non-empty path field.' });
      return;
    }

    console.log(`[Jobs] Starting scan: ${scanPath}`);
    const job = jobStore.createScanJob(scanPath);
    res.status(202).json(job);
  });

  api.get('/jobs', (_req, res) => {
    const jobs = jobStore.listJobs();
    console.debug(`[Jobs] Listing ${jobs.length} jobs`);
    res.json(jobs);
  });

  api.get('/jobs/:id', async (req, res) => {
    const jobId = req.params.id;
    console.debug(`[Jobs] Fetching job: ${jobId}`);
    const job = await jobStore.getJob(jobId);

    if (!job) {
      console.warn(`[Jobs] Job not found: ${jobId}`);
      res.status(404).json({ error: 'Job not found.' });
      return;
    }

    res.json(job);
  });

  api.get('/jobs/:id/tree/root', async (req, res) => {
    const jobId = req.params.id;
    if (!(await ensureCompletedTreeJob(jobId, res))) {
      return;
    }

    const root = jobStore.getRootNode(jobId);
    if (!root) {
      res.status(404).json({ error: 'Root node not found for this job.' });
      return;
    }

    res.json({ node: root });
  });

  api.post('/jobs/:id/tree/children-batch', async (req, res) => {
    const jobId = req.params.id;
    const parentIdsRaw = req.body?.parentIds;

    if (!Array.isArray(parentIdsRaw)) {
      res.status(400).json({ error: 'Body must contain a parentIds array.' });
      return;
    }

    const parsedParentIds = parentIdsRaw
      .map((value) => (typeof value === 'number' ? value : Number.NaN))
      .filter((value) => Number.isInteger(value) && value > 0);

    if (parsedParentIds.length !== parentIdsRaw.length) {
      res.status(400).json({ error: 'parentIds must contain only positive integers.' });
      return;
    }

    const parentIds = [...new Set(parsedParentIds)];
    if (parentIds.length > MAX_BATCH_PARENT_IDS) {
      res.status(400).json({ error: `parentIds cannot contain more than ${MAX_BATCH_PARENT_IDS} entries.` });
      return;
    }

    if (!(await ensureCompletedTreeJob(jobId, res))) {
      return;
    }

    const byParentId = jobStore.getNodeChildrenBatch(jobId, parentIds);
    res.json({ byParentId });
  });

  api.post('/jobs/:id/rerun', (req, res) => {
    const jobId = req.params.id;
    console.log(`[Jobs] Rerunning job: ${jobId}`);
    const job = jobStore.rerunJob(jobId);

    if (!job) {
      console.warn(`[Jobs] Cannot rerun: job not found: ${jobId}`);
      res.status(404).json({ error: 'Job not found.' });
      return;
    }

    res.status(202).json(job);
  });

  api.delete('/jobs/:id', (req, res) => {
    const jobId = req.params.id;
    console.log(`[Jobs] Deleting job: ${jobId}`);
    const removed = jobStore.removeJob(jobId);

    if (!removed) {
      console.warn(`[Jobs] Cannot delete: job not found: ${jobId}`);
      res.status(404).json({ error: 'Job not found.' });
      return;
    }

    res.status(204).send();
  });
}
