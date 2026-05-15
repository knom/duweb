import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTreeData } from './useTreeData'
import type { ScanJob } from '../types/scan'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('useTreeData', () => {
  const completedJob: ScanJob = {
    id: 'job-1',
    status: 'completed',
    rootPath: '/mnt/files',
    progress: {
      directoriesVisited: 10,
      filesVisited: 25,
      startedAt: '2026-05-14T10:00:00.000Z',
    },
  }

  const apiUrl = (path: string) => `/api${path}`

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('prefetches deeper levels in background and clears postloading state', async () => {
    let resolveFirstLevelBatch!: (response: Response) => void

    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url.endsWith('/api/jobs/job-1/tree/root')) {
        return jsonResponse({
          node: {
            id: 10,
            parentId: null,
            jobId: 'job-1',
            depth: 0,
            name: 'files',
            path: '/mnt/files',
            sizeBytes: 500,
            percentOfRoot: 100,
            inaccessible: false,
            hasChildren: true,
          },
        })
      }

      if (url.endsWith('/api/jobs/job-1/tree/children-batch')) {
        const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as { parentIds?: number[] }) : {}
        const parentIds = Array.isArray(body.parentIds) ? body.parentIds : []

        if (parentIds.includes(10)) {
          return await new Promise<Response>((resolve) => {
            resolveFirstLevelBatch = resolve
          })
        }

        if (parentIds.includes(11)) {
          return jsonResponse({
            byParentId: {
              '11': [
                {
                  id: 12,
                  parentId: 11,
                  jobId: 'job-1',
                  depth: 2,
                  name: 'leaf',
                  path: '/mnt/files/parent/leaf',
                  sizeBytes: 50,
                  percentOfRoot: 10,
                  inaccessible: false,
                  hasChildren: false,
                },
              ],
            },
          })
        }

        return jsonResponse({ byParentId: {} })
      }

      return jsonResponse({ error: 'not-found' }, 404)
    })

    const { result } = renderHook(() => useTreeData({ job: completedJob, apiUrl }))

    await waitFor(() => {
      expect(result.current.rootNode?.id).toBe(10)
    })

    await waitFor(() => {
      expect(result.current.isPostLoading).toBe(true)
    })

    resolveFirstLevelBatch(
      jsonResponse({
        byParentId: {
          '10': [
            {
              id: 11,
              parentId: 10,
              jobId: 'job-1',
              depth: 1,
              name: 'parent',
              path: '/mnt/files/parent',
              sizeBytes: 100,
              percentOfRoot: 20,
              inaccessible: false,
              hasChildren: true,
            },
          ],
        },
      }),
    )

    await waitFor(() => {
      expect(result.current.isPostLoading).toBe(false)
    })

    expect(result.current.getChildren(10)?.[0]?.name).toBe('parent')
    expect(result.current.getChildren(11)?.[0]?.name).toBe('leaf')
    expect(result.current.levelOptions).toEqual([1, 2])
  })

  it('marks tree as unavailable when root endpoint returns 404', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url.endsWith('/api/jobs/job-1/tree/root')) {
        return jsonResponse({ error: 'not-found' }, 404)
      }

      return jsonResponse({ error: 'not-found' }, 404)
    })

    const { result } = renderHook(() => useTreeData({ job: completedJob, apiUrl }))

    await waitFor(() => {
      expect(result.current.treeUnavailable).toBe(true)
    })

    expect(result.current.rootNode).toBeNull()
    expect(result.current.levelOptions).toEqual([])
  })

  it('recovers when initial batch prefetch fails and loads children via on-demand expand', async () => {
    let batchRequestCount = 0

    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url.endsWith('/api/jobs/job-1/tree/root')) {
        return jsonResponse({
          node: {
            id: 10,
            parentId: null,
            jobId: 'job-1',
            depth: 0,
            name: 'files',
            path: '/mnt/files',
            sizeBytes: 500,
            percentOfRoot: 100,
            inaccessible: false,
            hasChildren: true,
          },
        })
      }

      if (url.endsWith('/api/jobs/job-1/tree/children-batch')) {
        batchRequestCount += 1

        if (batchRequestCount === 1) {
          return jsonResponse({ error: 'temporary failure' }, 500)
        }

        const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as { parentIds?: number[] }) : {}
        const parentIds = Array.isArray(body.parentIds) ? body.parentIds : []

        if (parentIds.includes(10)) {
          return jsonResponse({
            byParentId: {
              '10': [
                {
                  id: 11,
                  parentId: 10,
                  jobId: 'job-1',
                  depth: 1,
                  name: 'recovered-child',
                  path: '/mnt/files/recovered-child',
                  sizeBytes: 100,
                  percentOfRoot: 20,
                  inaccessible: false,
                  hasChildren: false,
                },
              ],
            },
          })
        }

        return jsonResponse({ byParentId: {} })
      }

      return jsonResponse({ error: 'not-found' }, 404)
    })

    const { result } = renderHook(() => useTreeData({ job: completedJob, apiUrl }))

    await waitFor(() => {
      expect(result.current.rootNode?.id).toBe(10)
    })

    await waitFor(() => {
      expect(result.current.isPostLoading).toBe(false)
    })

    expect(result.current.getChildren(10)).toBeUndefined()

    await result.current.ensureChildrenLoaded(result.current.rootNode as NonNullable<typeof result.current.rootNode>)

    await waitFor(() => {
      expect(result.current.getChildren(10)?.[0]?.name).toBe('recovered-child')
    })

    expect(batchRequestCount).toBe(2)
  })
})
