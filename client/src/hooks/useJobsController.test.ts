import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useJobsController } from './useJobsController'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('useJobsController', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads jobs, selects first job details, and filters by path only', async () => {
    const jobs = [
      {
        id: 'job-1',
        status: 'completed',
        rootPath: '/mnt/files',
        progress: { directoriesVisited: 2, filesVisited: 3, startedAt: '2026-05-14T10:00:00.000Z' },
      },
      {
        id: 'job-2',
        status: 'failed',
        rootPath: '/var/log',
        progress: { directoriesVisited: 1, filesVisited: 1, startedAt: '2026-05-14T11:00:00.000Z' },
      },
    ]

    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({ requireAuth: false, identity: { groups: [] } })
      }

      if (url.endsWith('/api/jobs')) {
        return jsonResponse(jobs)
      }

      if (url.endsWith('/api/jobs/job-1')) {
        return jsonResponse(jobs[0])
      }

      return jsonResponse({ error: 'not-found' }, 404)
    })

    const { result } = renderHook(() => useJobsController())

    await waitFor(() => {
      expect(result.current.loadingJobs).toBe(false)
    })

    expect(result.current.selectedJobId).toBe('job-1')
    expect(result.current.scanPath).toBe('/mnt/files')
    expect(result.current.filteredJobs).toHaveLength(2)

    act(() => {
      result.current.setSearch('job-1')
    })

    await waitFor(() => {
      expect(result.current.filteredJobs).toHaveLength(0)
    })

    act(() => {
      result.current.setSearch('/var')
    })

    await waitFor(() => {
      expect(result.current.filteredJobs.map((item) => item.id)).toEqual(['job-2'])
    })
  })

  it('reruns selected job and prepends the new queued job', async () => {
    const failedJob = {
      id: 'job-2',
      status: 'failed',
      rootPath: '/var/log',
      progress: { directoriesVisited: 1, filesVisited: 1, startedAt: '2026-05-14T11:00:00.000Z' },
    }

    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({ requireAuth: false, identity: { groups: [] } })
      }

      if (url.endsWith('/api/jobs')) {
        return jsonResponse([failedJob])
      }

      if (url.endsWith('/api/jobs/job-2') && (!init || init.method === undefined)) {
        return jsonResponse(failedJob)
      }

      if (url.endsWith('/api/jobs/job-2/rerun') && init?.method === 'POST') {
        return jsonResponse(
          {
            id: 'job-3',
            status: 'queued',
            rootPath: '/var/log',
            progress: { directoriesVisited: 0, filesVisited: 0, startedAt: '2026-05-14T12:00:00.000Z' },
          },
          202,
        )
      }

      return jsonResponse({ error: 'not-found' }, 404)
    })

    const { result } = renderHook(() => useJobsController())

    await waitFor(() => {
      expect(result.current.loadingJobs).toBe(false)
    })

    await act(async () => {
      await result.current.rerunSelectedJob()
    })

    await waitFor(() => {
      expect(result.current.selectedJobId).toBe('job-3')
    })

    expect(result.current.jobs[0]?.id).toBe('job-3')
    expect(result.current.scanPath).toBe('/var/log')
  })

  it('reloads jobs list after a queued job reaches completed status', async () => {
    const initialQueuedJob = {
      id: 'job-2',
      status: 'queued',
      rootPath: '/var/log',
      progress: { directoriesVisited: 0, filesVisited: 0, startedAt: '2026-05-14T11:00:00.000Z' },
    }

    const completedJob = {
      id: 'job-2',
      status: 'completed',
      rootPath: '/var/log',
      progress: {
        directoriesVisited: 10,
        filesVisited: 20,
        startedAt: '2026-05-14T11:00:00.000Z',
        endedAt: '2026-05-14T11:00:05.000Z',
      },
    }

    const refreshedList = [
      completedJob,
      {
        id: 'job-other',
        status: 'completed',
        rootPath: '/opt/data',
        progress: { directoriesVisited: 1, filesVisited: 2, startedAt: '2026-05-14T10:00:00.000Z' },
      },
    ]

    let jobsListCallCount = 0
    let jobDetailsCallCount = 0

    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({ requireAuth: false, identity: { groups: [] } })
      }

      if (url.endsWith('/api/jobs') && (!init || init.method === undefined)) {
        jobsListCallCount += 1

        if (jobsListCallCount === 1) {
          return jsonResponse([initialQueuedJob])
        }

        return jsonResponse(refreshedList)
      }

      if (url.endsWith('/api/jobs/job-2')) {
        jobDetailsCallCount += 1

        if (jobDetailsCallCount === 1) {
          return jsonResponse(initialQueuedJob)
        }

        return jsonResponse(completedJob)
      }

      return jsonResponse({ error: 'not-found' }, 404)
    })

    const { result } = renderHook(() => useJobsController())

    await waitFor(() => {
      expect(result.current.loadingJobs).toBe(false)
    })

    expect(result.current.selectedJobId).toBe('job-2')

    await waitFor(
      () => {
        expect(result.current.jobs).toHaveLength(2)
      },
      { timeout: 3_000 },
    )

    expect(result.current.jobs[0]?.id).toBe('job-2')
    expect(jobsListCallCount).toBe(2)
  })

  it('exposes auth-required username only when auth is required', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({
          requireAuth: true,
          identity: { username: 'alice', groups: ['diskusage-admins'] },
        })
      }

      if (url.endsWith('/api/jobs')) {
        return jsonResponse([])
      }

      return jsonResponse({ error: 'not-found' }, 404)
    })

    const { result } = renderHook(() => useJobsController())

    await waitFor(() => {
      expect(result.current.loadingJobs).toBe(false)
    })

    await waitFor(() => {
      expect(result.current.authRequired).toBe(true)
      expect(result.current.authUsername).toBe('alice')
    })
  })

  it('returns filtered path suggestions and falls back to an empty list for bad payloads', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({ requireAuth: false, identity: { groups: [] } })
      }

      if (url.endsWith('/api/jobs')) {
        return jsonResponse([])
      }

      if (url.includes('/api/paths/suggest')) {
        return jsonResponse({ suggestions: ['/srv/data', 123, '/srv/logs'] })
      }

      return jsonResponse({ error: 'not-found' }, 404)
    })

    const { result } = renderHook(() => useJobsController())

    await waitFor(() => {
      expect(result.current.loadingJobs).toBe(false)
    })

    await expect(result.current.fetchPathSuggestions('/srv')).resolves.toEqual(['/srv/data', '/srv/logs'])

    fetchMock.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url.includes('/api/paths/suggest')) {
        return jsonResponse({ suggestions: 'nope' })
      }

      return jsonResponse([])
    })

    await expect(result.current.fetchPathSuggestions('/srv')).resolves.toEqual([])
  })

  it('starts a scan and prepends the created job', async () => {
    const createdJob = {
      id: 'job-3',
      status: 'queued',
      rootPath: '/new/path',
      progress: { directoriesVisited: 0, filesVisited: 0, startedAt: '2026-05-14T12:00:00.000Z' },
    }

    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({ requireAuth: false, identity: { groups: [] } })
      }

      if (url.endsWith('/api/jobs') && (!init || init.method === undefined)) {
        return jsonResponse([])
      }

      if (url.endsWith('/api/jobs/scan') && init?.method === 'POST') {
        return jsonResponse(createdJob, 202)
      }

      return jsonResponse({ error: 'not-found' }, 404)
    })

    const { result } = renderHook(() => useJobsController())

    await waitFor(() => {
      expect(result.current.loadingJobs).toBe(false)
    })

    act(() => {
      result.current.setScanPath('/new/path')
    })

    await act(async () => {
      await result.current.startScan()
    })

    expect(result.current.selectedJobId).toBe('job-3')
    expect(result.current.jobs[0]?.id).toBe('job-3')
    expect(result.current.scanPath).toBe('/new/path')
    expect(result.current.starting).toBe(false)
  })

  it('surfaces start-scan errors from the server', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({ requireAuth: false, identity: { groups: [] } })
      }

      if (url.endsWith('/api/jobs') && (!init || init.method === undefined)) {
        return jsonResponse([])
      }

      if (url.endsWith('/api/jobs/scan') && init?.method === 'POST') {
        return jsonResponse({ error: 'Cannot scan path' }, 400)
      }

      return jsonResponse({ error: 'not-found' }, 404)
    })

    const { result } = renderHook(() => useJobsController())

    await waitFor(() => {
      expect(result.current.loadingJobs).toBe(false)
    })

    await act(async () => {
      await result.current.startScan()
    })

    expect(result.current.error).toBe('Cannot scan path')
    expect(result.current.starting).toBe(false)
  })

  it('removes the selected job and loads the next remaining job details', async () => {
    const firstJob = {
      id: 'job-1',
      status: 'completed',
      rootPath: '/first',
      progress: { directoriesVisited: 1, filesVisited: 1, startedAt: '2026-05-14T10:00:00.000Z' },
    }
    const secondJob = {
      id: 'job-2',
      status: 'completed',
      rootPath: '/second',
      progress: { directoriesVisited: 2, filesVisited: 2, startedAt: '2026-05-14T11:00:00.000Z' },
    }
    const secondJobFull = {
      ...secondJob,
      progress: { ...secondJob.progress, filesVisited: 99 },
    }

    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({ requireAuth: false, identity: { groups: [] } })
      }

      if (url.endsWith('/api/jobs') && (!init || init.method === undefined)) {
        return jsonResponse([firstJob, secondJob])
      }

      if (url.endsWith('/api/jobs/job-1') && (!init || init.method === undefined)) {
        return jsonResponse(firstJob)
      }

      if (url.endsWith('/api/jobs/job-1') && init?.method === 'DELETE') {
        return jsonResponse({ ok: true })
      }

      if (url.endsWith('/api/jobs/job-2')) {
        return jsonResponse(secondJobFull)
      }

      return jsonResponse({ error: 'not-found' }, 404)
    })

    const { result } = renderHook(() => useJobsController())

    await waitFor(() => {
      expect(result.current.selectedJobId).toBe('job-1')
    })

    await waitFor(() => {
      expect(result.current.jobs).toHaveLength(2)
    })

    await act(async () => {
      await result.current.removeSelectedJob()
    })

    await waitFor(() => {
      expect(result.current.selectedJobId).toBe('job-2')
    })

    await waitFor(() => {
      expect(result.current.job?.progress.filesVisited).toBe(99)
    })
  })

  it('selects a job and upgrades it with fetched details', async () => {
    const job = {
      id: 'job-1',
      status: 'completed',
      rootPath: '/base',
      progress: { directoriesVisited: 1, filesVisited: 1, startedAt: '2026-05-14T10:00:00.000Z' },
    }
    const jobFull = {
      ...job,
      rootPath: '/base/full',
      progress: { ...job.progress, filesVisited: 42 },
    }

    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({ requireAuth: false, identity: { groups: [] } })
      }

      if (url.endsWith('/api/jobs')) {
        return jsonResponse([job])
      }

      if (url.endsWith('/api/jobs/job-1')) {
        return jsonResponse(jobFull)
      }

      return jsonResponse({ error: 'not-found' }, 404)
    })

    const { result } = renderHook(() => useJobsController())

    await waitFor(() => {
      expect(result.current.loadingJobs).toBe(false)
    })

    act(() => {
      result.current.selectJob(job)
    })

    await waitFor(() => {
      expect(result.current.job?.rootPath).toBe('/base/full')
    })
    expect(result.current.scanPath).toBe('/base/full')
  })
})
