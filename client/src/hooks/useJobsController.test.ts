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
})
