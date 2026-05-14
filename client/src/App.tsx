import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { DirectoryTreeCard } from './components/DirectoryTreeCard'
import { JobsSidebar } from './components/JobsSidebar'
import type { JobStatus, ScanJob } from './types/scan'

const API_BASE = `${import.meta.env.BASE_URL}api`

function apiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${suffix}`
}

function App() {
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
  const logoUrl = `${import.meta.env.BASE_URL}favicon.svg`

  const fetchFullJob = useCallback(async (id: string, signal?: AbortSignal): Promise<ScanJob | null> => {
    try {
      const response = await fetch(apiUrl(`/jobs/${id}`), { signal })
      if (!response.ok) return null
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

    async function loadJobs() {
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

        const first = await fetchFullJob(existingJobs[0].id)
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
  }, [])

  useEffect(() => {
    if (!job || (job.status !== 'queued' && job.status !== 'running')) {
      return
    }

    const timer = window.setInterval(async () => {
      const response = await fetch(apiUrl(`/jobs/${job.id}`))
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
  }, [job])

  useEffect(() => {
    if (!job) {
      return
    }

    setScanPath(job.rootPath)
  }, [job?.id, job?.rootPath])

  const statusLabel = useMemo(() => {
    if (!job) {
      return 'No job selected'
    }
    return `${job.status.toUpperCase()} - dirs ${job.progress.directoriesVisited}, files ${job.progress.filesVisited}`
  }, [job])

  const filteredJobs = useMemo(() => {
    const searchValue = deferredSearch.trim().toLowerCase()

    return jobs.filter((item) => {
      const matchesFilter = filter === 'all' || item.status === filter
      const matchesSearch =
        searchValue.length === 0 ||
        item.rootPath.toLowerCase().includes(searchValue) ||
        item.id.toLowerCase().includes(searchValue)

      return matchesFilter && matchesSearch
    })
  }, [deferredSearch, filter, jobs])

  async function startScan() {
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
  }

  async function rerunSelectedJob() {
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
  }

  async function removeSelectedJob() {
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
          void fetchFullJob(updated[0].id).then((full) => setJob(full))
        } else {
          setJob(null)
        }
        return updated
      })
    } catch {
      setError('Server is not reachable. Start the backend on port 3001.')
    }
  }

  return (
    <main className="h-screen overflow-hidden bg-[radial-gradient(circle_at_10%_15%,rgba(14,165,233,0.18),transparent_38%),radial-gradient(circle_at_88%_0%,rgba(16,185,129,0.14),transparent_36%),linear-gradient(170deg,#f5f7fb_0%,#eef3f8_42%,#f8fafc_100%)] text-slate-900">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1280px] flex-col gap-4 p-0 md:p-6">
        <AppHeader
          logoUrl={logoUrl}
          sidebarOpen={sidebarOpen}
          scanPath={scanPath}
          starting={starting}
          onToggleSidebar={() => setSidebarOpen((value) => !value)}
          onScanPathChange={setScanPath}
          fetchPathSuggestions={fetchPathSuggestions}
          onStartScan={startScan}
        />

        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar overlay"
            className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <JobsSidebar
            sidebarOpen={sidebarOpen}
            statusLabel={statusLabel}
            search={search}
            filter={filter}
            loadingJobs={loadingJobs}
            filteredJobs={filteredJobs}
            selectedJobId={job?.id}
            error={job?.error ?? error}
            hasSelectedJob={Boolean(job)}
            onCloseSidebar={() => setSidebarOpen(false)}
            onSearchChange={setSearch}
            onFilterChange={setFilter}
            onSelectJob={(selectedJob) => {
              void fetchFullJob(selectedJob.id).then((full) => setJob(full ?? selectedJob))
              setSidebarOpen(false)
            }}
            onRerunSelectedJob={rerunSelectedJob}
            onRemoveSelectedJob={removeSelectedJob}
          />

          <DirectoryTreeCard job={job} />
        </div>
      </div>
    </main>
  )
}

export default App