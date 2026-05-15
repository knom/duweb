import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import type { JobStatus, ScanJob } from '../types/scan'

const API_BASE = `${import.meta.env.BASE_URL}api`

function apiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${suffix}`
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
  const deferredSearch = useDeferredValue(search)

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

  useEffect(() => {
    let cancelled = false

    async function loadJobs(): Promise<void> {
      setLoadingJobs(true)

      try {
        const response = await fetch(apiUrl('/jobs'))
        if (!response.ok) {
          if (!cancelled) {
            setError('Unable to load jobs.')
          }
          return
        }

        const existingJobs = (await response.json()) as ScanJob[]

        if (cancelled) {
          return
        }

        setJobs(existingJobs)

        if (existingJobs.length === 0) {
          return
        }

        const first = await fetchJob(existingJobs[0].id)
        if (!cancelled) {
          setJob(first)
        }
      } catch {
        if (!cancelled) {
          setError('Server is not reachable. Start the backend on port 3001.')
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
  }, [fetchJob])

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
      setJobs((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    }, 1200)

    return () => {
      window.clearInterval(timer)
    }
  }, [jobId, jobStatus])

  const selectedRootPath = job?.rootPath
  const selectedJobId = job?.id

  useEffect(() => {
    if (!selectedRootPath || !selectedJobId) {
      return
    }

    setScanPath(selectedRootPath)
  }, [selectedJobId, selectedRootPath])

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
      setJobs((current) => [created, ...current.filter((item) => item.id !== created.id)])
    } catch {
      setError('Server is not reachable. Start the backend on port 3001.')
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
      setJobs((current) => [created, ...current.filter((item) => item.id !== created.id)])
    } catch {
      setError('Server is not reachable. Start the backend on port 3001.')
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
          void fetchJob(updated[0].id).then((full) => setJob(full))
        } else {
          setJob(null)
        }

        return updated
      })
    } catch {
      setError('Server is not reachable. Start the backend on port 3001.')
    }
  }, [fetchJob, job])

  const selectJob = useCallback(
    (selectedJob: ScanJob): void => {
      void fetchJob(selectedJob.id).then((full) => setJob(full ?? selectedJob))
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
    fetchPathSuggestions,
    filteredJobs,
    startScan,
    rerunSelectedJob,
    removeSelectedJob,
    selectJob,
  }
}
