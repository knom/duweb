import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import type { JobStatus, ScanJob } from '../types/scan'

function getUrlJobId(): string | null {
  return new URLSearchParams(window.location.search).get('job')
}

function setUrlJobId(id: string | null, replace = false): void {
  const url = new URL(window.location.href)
  if (id) {
    url.searchParams.set('job', id)
  } else {
    url.searchParams.delete('job')
  }
  if (replace) {
    window.history.replaceState(null, '', url.toString())
  } else {
    window.history.pushState(null, '', url.toString())
  }
}

const API_BASE = `${import.meta.env.BASE_URL}api`

function apiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${suffix}`
}

interface AuthIdentity {
  username?: string
}

interface AuthMeResponse {
  requireAuth?: boolean
  identity?: AuthIdentity
  username?: string
}

export function useJobsController() {
  const [scanPath, setScanPath] = useState('/')
  const [job, setJob] = useState<ScanJob | null>(null)
  const [jobs, setJobs] = useState<ScanJob[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | JobStatus>('all')
  const [error, setError] = useState<string>('')
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [starting, setStarting] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [authRequired, setAuthRequired] = useState(false)
  const [authUsername, setAuthUsername] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    let cancelled = false

    async function loadAuthState(): Promise<void> {
      try {
        const response = await fetch(apiUrl('/auth/me'))
        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as AuthMeResponse
        if (cancelled) {
          return
        }

        const requireAuth = payload.requireAuth === true
        const username = payload.identity?.username ?? payload.username ?? null

        setAuthRequired(requireAuth)
        setAuthUsername(requireAuth ? username : null)
      } catch {
        if (!cancelled) {
          setAuthRequired(false)
          setAuthUsername(null)
        }
      }
    }

    void loadAuthState()

    return () => {
      cancelled = true
    }
  }, [])

  const fetchJob = useCallback(async (id: string, signal?: AbortSignal): Promise<ScanJob | null> => {
    try {
      const response = await fetch(apiUrl(`/jobs/${id}`), { signal })
      if (!response.ok) {
        return null
      }

      return (await response.json()) as ScanJob
    } catch {
      return null
    }
  }, [])

  const fetchPathSuggestions = useCallback(async (query: string, signal?: AbortSignal): Promise<string[]> => {
    const response = await fetch(`${apiUrl('/paths/suggest')}?q=${encodeURIComponent(query)}`, { signal })
    if (!response.ok) {
      return []
    }

    const payload = (await response.json()) as { suggestions?: unknown }
    if (!Array.isArray(payload.suggestions)) {
      return []
    }

    return payload.suggestions.filter((item): item is string => typeof item === 'string')
  }, [])

  const fetchJobsList = useCallback(async (): Promise<ScanJob[] | null> => {
    try {
      const response = await fetch(apiUrl('/jobs'))
      if (!response.ok) {
        setError('Unable to load jobs.')
        return null
      }

      return (await response.json()) as ScanJob[]
    } catch {
      setError('Server is not reachable.')
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadJobs(): Promise<void> {
      setLoadingJobs(true)

      try {
        const existingJobs = await fetchJobsList()
        if (!existingJobs) {
          return
        }

        if (cancelled) {
          return
        }

        setJobs(existingJobs)

        if (existingJobs.length === 0) {
          return
        }

        const urlJobId = getUrlJobId()
        const initialId =
          urlJobId && existingJobs.some((j) => j.id === urlJobId) ? urlJobId : existingJobs[0].id
        const first = await fetchJob(initialId)
        if (!cancelled) {
          setJob((current) => {
            if (current) {
              return current
            }

            if (first?.rootPath) {
              setScanPath(first.rootPath)
            }

            return first
          })
          if (first) {
            setUrlJobId(first.id, true)
          }
        }
      } finally {
        if (!cancelled) {
          setLoadingJobs(false)
        }
      }
    }

    void loadJobs()

    return () => {
      cancelled = true
    }
  }, [fetchJob, fetchJobsList])

  const jobId = job?.id
  const jobStatus = job?.status

  useEffect(() => {
    if (!jobId || (jobStatus !== 'queued' && jobStatus !== 'running')) {
      return
    }

    const timer = window.setInterval(async () => {
      const response = await fetch(apiUrl(`/jobs/${jobId}`))
      if (!response.ok) {
        setError('Unable to refresh job state.')
        return
      }

      const updated = (await response.json()) as ScanJob
      setJob(updated)
      setScanPath(updated.rootPath)
      setJobs((current) => current.map((item) => (item.id === updated.id ? updated : item)))

      if (updated.status === 'completed') {
        const refreshedJobs = await fetchJobsList()
        if (!refreshedJobs) {
          return
        }

        setJobs(refreshedJobs)
      }
    }, 1200)

    return () => {
      window.clearInterval(timer)
    }
  }, [fetchJobsList, jobId, jobStatus])

  useEffect(() => {
    function onPopState(): void {
      const id = getUrlJobId()
      setJobs((currentJobs) => {
        if (!id) {
          setJob(null)
          return currentJobs
        }

        const found = currentJobs.find((j) => j.id === id)
        if (found) {
          setJob(found)
          setScanPath(found.rootPath)
          void fetchJob(id).then((full) => {
            if (!full) {
              return
            }

            setJob(full)
            setScanPath(full.rootPath)
          })
        }

        return currentJobs
      })
    }

    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [fetchJob])

  const filteredJobs = useMemo(() => {
    const searchValue = deferredSearch.trim().toLowerCase()

    return jobs.filter((item) => {
      const matchesFilter = filter === 'all' || item.status === filter
      const matchesSearch = searchValue.length === 0 || item.rootPath.toLowerCase().includes(searchValue)

      return matchesFilter && matchesSearch
    })
  }, [deferredSearch, filter, jobs])

  const startScan = useCallback(async (): Promise<void> => {
    setStarting(true)
    setError('')

    try {
      const response = await fetch(apiUrl('/jobs/scan'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: scanPath }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        setError(payload.error ?? 'Could not start scan.')
        return
      }

      const created = (await response.json()) as ScanJob
      setJob(created)
      setScanPath(created.rootPath)
      setUrlJobId(created.id)
      setJobs((current) => [created, ...current.filter((item) => item.id !== created.id)])
    } catch {
      setError('Server is not reachable.')
    } finally {
      setStarting(false)
    }
  }, [scanPath])

  const rerunSelectedJob = useCallback(async (): Promise<void> => {
    if (!job) {
      return
    }

    setError('')

    try {
      const response = await fetch(apiUrl(`/jobs/${job.id}/rerun`), {
        method: 'POST',
      })

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        setError(payload.error ?? 'Could not rerun selected job.')
        return
      }

      const created = (await response.json()) as ScanJob
      setJob(created)
      setScanPath(created.rootPath)
      setUrlJobId(created.id)
      setJobs((current) => [created, ...current.filter((item) => item.id !== created.id)])
    } catch {
      setError('Server is not reachable.')
    }
  }, [job])

  const removeSelectedJob = useCallback(async (): Promise<void> => {
    if (!job) {
      return
    }

    setError('')

    try {
      const response = await fetch(apiUrl(`/jobs/${job.id}`), {
        method: 'DELETE',
      })

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        setError(payload.error ?? 'Could not remove selected job.')
        return
      }

      setJobs((current) => {
        const updated = current.filter((item) => item.id !== job.id)
        if (updated.length > 0) {
          setJob(updated[0])
          setScanPath(updated[0].rootPath)
          void fetchJob(updated[0].id).then((full) => {
            if (!full) {
              return
            }

            setJob(full)
            if (full?.rootPath) {
              setScanPath(full.rootPath)
            }
          })
          setUrlJobId(updated[0].id, true)
        } else {
          setJob(null)
          setUrlJobId(null, true)
        }

        return updated
      })
    } catch {
      setError('Server is not reachable.')
    }
  }, [fetchJob, job])

  const selectJob = useCallback(
    (selectedJob: ScanJob): void => {
      setJob(selectedJob)
      setScanPath(selectedJob.rootPath)
      setUrlJobId(selectedJob.id)

      void fetchJob(selectedJob.id).then((full) => {
        if (!full) {
          return
        }

        setJob(full)
        setScanPath(full.rootPath)
      })
    },
    [fetchJob],
  )

  return {
    apiUrl,
    scanPath,
    setScanPath,
    job,
    selectedJobId: job?.id,
    jobs,
    search,
    setSearch,
    filter,
    setFilter,
    error,
    loadingJobs,
    starting,
    sidebarOpen,
    setSidebarOpen,
    authRequired,
    authUsername,
    fetchPathSuggestions,
    filteredJobs,
    startScan,
    rerunSelectedJob,
    removeSelectedJob,
    selectJob,
  }
}
