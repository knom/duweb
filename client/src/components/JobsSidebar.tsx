import { FolderTree, Loader2, Play, Search, Trash2, X } from 'lucide-react'
import type { JobStatus, ScanJob } from '../types/scan'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { cn } from '../lib/utils'
import { formatDuration } from '../lib/formatDuration'
import { useState } from 'react'

interface JobsSidebarProps {
  sidebarOpen: boolean
  search: string
  filter: 'all' | JobStatus
  loadingJobs: boolean
  filteredJobs: ScanJob[]
  selectedJobId?: string
  error: string
  hasSelectedJob: boolean
  onCloseSidebar: () => void
  onSearchChange: (value: string) => void
  onFilterChange: (value: 'all' | JobStatus) => void
  onSelectJob: (job: ScanJob) => void
  onRerunSelectedJob: () => void
  onRemoveSelectedJob: () => void | Promise<void>
}

export function JobsSidebar({
  sidebarOpen,
  search,
  filter,
  loadingJobs,
  filteredJobs,
  selectedJobId,
  error,
  hasSelectedJob,
  onCloseSidebar,
  onSearchChange,
  onFilterChange,
  onSelectJob,
  onRerunSelectedJob,
  onRemoveSelectedJob,
}: JobsSidebarProps) {
  const appVersion = import.meta.env.VITE_APP_VERSION ?? 'dev'
  const [removingJobId, setRemovingJobId] = useState<string | null>(null)

  const handleRemoveJob = async () => {
    if (!selectedJobId) {
      return
    }

    setRemovingJobId(selectedJobId)
    try {
      await onRemoveSelectedJob()
    } finally {
      setRemovingJobId(null)
    }
  }

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 w-[340px] max-w-[86vw] p-0 transition-transform duration-200 lg:static lg:z-auto lg:h-full lg:w-auto lg:max-w-none lg:translate-x-0 lg:p-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}
    >
      <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-none lg:rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              <FolderTree className="h-4 w-4" />
              Scan Jobs
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={onCloseSidebar}
              aria-label="Close jobs sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardTitle>
          <CardDescription>All disk usage scan jobs</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by path"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(['all', 'queued', 'running', 'completed', 'failed'] as const).map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={filter === option ? 'default' : 'secondary'}
                onClick={() => onFilterChange(option)}
              >
                {option}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={onRerunSelectedJob}
              disabled={!hasSelectedJob}
            >
              <Play className="h-4 w-4" />
              Rerun
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                void handleRemoveJob()
              }}
              disabled={!hasSelectedJob || removingJobId !== null}
            >
              <Trash2 className="h-4 w-4" />
              {removingJobId ? 'Removing...' : 'Remove'}
            </Button>
          </div>

          {error && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200">
            {loadingJobs ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                Loading jobs...
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-500">No jobs match this filter.</div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {filteredJobs.map((item) => {
                  const selected = selectedJobId === item.id
                  const isRemoving = removingJobId === item.id

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={cn(
                          'grid w-full min-h-20 grid-cols-[1fr_auto] items-center gap-2 px-3 py-2 text-left transition-colors',
                          selected ? 'bg-cyan-50/80' : 'hover:bg-slate-50',
                        )}
                        onClick={() => onSelectJob(item)}
                        disabled={isRemoving}
                      >
                        <div>
                          <div className="truncate font-medium text-slate-800">{item.rootPath}</div>
                          <div className="text-xs text-slate-500">{new Date(item.progress.startedAt).toLocaleString()}</div>
                          <div
                            className={cn(
                              'text-xs text-slate-500',
                              item.status === 'running' ? 'invisible' : 'visible',
                            )}
                            aria-hidden={item.status === 'running'}
                          >
                            Runtime: {formatDuration(item.runtimeMs)}
                          </div>
                        </div>
                        {isRemoving ? (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        ) : (
                          <Badge variant={item.status}>{item.status}</Badge>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <p className="text-center text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
            {appVersion}
          </p>
        </CardContent>
      </Card>
    </aside>
  )
}
