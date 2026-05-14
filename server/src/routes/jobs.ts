import type { Router } from 'express';
import { jobStore } from '../jobs.js';

export function registerJobRoutes(api: Router) {
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
