import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FolderTree, Menu, Play, Search, Trash2, X } from 'lucide-react'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Input } from './components/ui/input'
import { cn } from './lib/utils'

type JobStatus = 'queued' | 'running' | 'completed' | 'failed'

interface DirectoryNode {
  name: string
  path: string
  sizeBytes: number
  percentOfRoot: number
  children: DirectoryNode[]
  inaccessible?: boolean
}

interface ScanProgress {
  directoriesVisited: number
  filesVisited: number
  startedAt: string
  endedAt?: string
}

interface ScanJob {
  id: string
  status: JobStatus
  rootPath: string
  progress: ScanProgress
  result?: DirectoryNode
  error?: string
}

const API_BASE = `${import.meta.env.BASE_URL}api`

function apiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${suffix}`
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[exponent]}`
}

function TreeNodeRow({ node, depth }: { node: DirectoryNode; depth: number }) {
  const [collapsed, setCollapsed] = useState(depth > 1)
  const hasChildren = node.children.length > 0

  return (
    <li>
      <div
        className="grid min-h-8 grid-cols-[1.5rem_minmax(150px,1.2fr)_auto_auto_1fr] items-center gap-2 border-b border-dashed border-slate-200 px-2 py-1 text-sm"
        style={{ paddingLeft: `${depth * 1.05}rem` }}
      >
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-40"
          onClick={() => setCollapsed((value) => !value)}
          disabled={!hasChildren}
          aria-label={collapsed ? 'Expand directory' : 'Collapse directory'}
        >
          {hasChildren ? (
            collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="text-xs">•</span>
          )}
        </button>
        <span className="truncate font-mono text-[13px] text-slate-800">{node.name || node.path}</span>
        {node.inaccessible && (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">inaccessible</span>
        )}
        <span className="justify-self-end font-mono text-[12px] text-slate-600">{formatBytes(node.sizeBytes)}</span>
        <span className="justify-self-end font-mono text-[12px] text-slate-500">{node.percentOfRoot.toFixed(2)}%</span>
        <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-200/70" aria-hidden="true">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
            style={{ width: `${Math.min(100, node.percentOfRoot)}%` }}
          />
        </div>
      </div>

      {!collapsed && hasChildren && (
        <ul>
          {node.children.map((child) => (
            <TreeNodeRow key={child.path} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

function App() {
  const [scanPath, setScanPath] = useState('/')
  const [job, setJob] = useState<ScanJob | null>(null)
  const [jobs, setJobs] = useState<ScanJob[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | JobStatus>('all')
  const [error, setError] = useState<string>('')
  const [starting, setStarting] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const deferredSearch = useDeferredValue(search)
  const logoUrl = `${import.meta.env.BASE_URL}favicon.svg`

  useEffect(() => {
    let cancelled = false

    async function loadJobs() {
      try {
        const response = await fetch(apiUrl('/jobs'))
        if (!response.ok) {
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

        setJob(existingJobs[0])
      } catch {
        if (!cancelled) {
          setError('Server is not reachable. Start the backend on port 3001.')
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

  const statusLabel = useMemo(() => {
    if (!job) {
      return 'No job started'
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
        setJob(updated.length > 0 ? updated[0] : null)
        return updated
      })
    } catch {
      setError('Server is not reachable. Start the backend on port 3001.')
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_15%,rgba(14,165,233,0.18),transparent_38%),radial-gradient(circle_at_88%_0%,rgba(16,185,129,0.14),transparent_36%),linear-gradient(170deg,#f5f7fb_0%,#eef3f8_42%,#f8fafc_100%)] text-slate-900">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 p-4 md:p-6">
        <header className="sticky top-3 z-30 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h1 className="flex items-center gap-3 text-xl font-semibold tracking-tight md:text-2xl">
                <img src={logoUrl} alt="DiskUsage Web logo" className="h-8 w-8 md:h-10 md:w-10" />
                <span>Disk Usage Web</span>
              </h1>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="w-full sm:w-[360px]">
                <label
                  htmlFor="scan-path"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Scan path
                </label>
                <Input
                  id="scan-path"
                  value={scanPath}
                  onChange={(event) => setScanPath(event.target.value)}
                  placeholder="/home"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={startScan}
                  disabled={starting || !scanPath.trim()}
                >
                  {starting ? 'Starting...' : 'Scan'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={rerunSelectedJob}
                  disabled={!job}
                >
                  <Play className="h-4 w-4" />
                  Rerun
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={removeSelectedJob}
                  disabled={!job}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen((value) => !value)}
                aria-label={sidebarOpen ? 'Close jobs sidebar' : 'Open jobs sidebar'}
              >
                {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                Jobs
              </Button>
            </div>
          </div>
        </header>

        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar overlay"
            className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside
            className={cn(
              'fixed inset-y-0 left-0 z-50 w-[340px] max-w-[86vw] p-4 transition-transform duration-200 lg:static lg:z-auto lg:w-auto lg:max-w-none lg:translate-x-0 lg:p-0',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            )}
          >
          <Card className="h-full min-h-[500px] overflow-hidden lg:h-[calc(100vh-11rem)]">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2">
                <FolderTree className="h-4 w-4" />
                Jobs
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close jobs sidebar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>{statusLabel}</CardDescription>
            </CardHeader>

            <CardContent className="flex h-[calc(100%-4.4rem)] flex-col gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Search by path or id"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {(['all', 'queued', 'running', 'completed', 'failed'] as const).map((option) => (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    variant={filter === option ? 'default' : 'secondary'}
                    onClick={() => setFilter(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>

              {(job?.error || error) && (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {job?.error ?? error}
                </p>
              )}

              <div className="overflow-y-auto rounded-lg border border-slate-200">
                {filteredJobs.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-slate-500">No jobs match this filter.</div>
                ) : (
                  <ul className="divide-y divide-slate-200">
                    {filteredJobs.map((item) => {
                      const selected = job?.id === item.id

                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={cn(
                              'grid w-full grid-cols-[1fr_auto] items-center gap-2 px-3 py-2 text-left transition-colors',
                              selected ? 'bg-cyan-50/80' : 'hover:bg-slate-50',
                            )}
                            onClick={() => {
                              setJob(item)
                              setSidebarOpen(false)
                            }}
                          >
                            <div>
                              <div className="truncate font-medium text-slate-800">{item.rootPath}</div>
                              <div className="text-xs text-slate-500">
                                {new Date(item.progress.startedAt).toLocaleString()}
                              </div>
                            </div>
                            <Badge variant={item.status}>{item.status}</Badge>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
          </aside>

          <Card className="h-[calc(100vh-11rem)] min-h-[500px] overflow-hidden lg:col-start-2">
            <CardHeader className="border-b border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Directory Tree</CardTitle>
                  <CardDescription>
                    {job
                      ? `Root ${job.rootPath} · ${job.progress.directoriesVisited} directories · ${job.progress.filesVisited} files`
                      : 'Choose or run a job to inspect disk usage.'}
                  </CardDescription>
                </div>
                {job && <Badge variant={job.status}>{job.status}</Badge>}
              </div>
            </CardHeader>

            <CardContent className="h-[calc(100%-5rem)] overflow-auto p-0">
              {!job?.result ? (
                <div className="px-4 py-6 text-sm text-slate-500">No completed scan yet.</div>
              ) : (
                <ul className="px-2 py-2">
                  <TreeNodeRow node={job.result} depth={0} />
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

export default App