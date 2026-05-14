import { Menu, Play, Trash2, X } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'

interface AppHeaderProps {
  logoUrl: string
  sidebarOpen: boolean
  scanPath: string
  starting: boolean
  hasSelectedJob: boolean
  onToggleSidebar: () => void
  onScanPathChange: (value: string) => void
  onStartScan: () => void
  onRerunSelectedJob: () => void
  onRemoveSelectedJob: () => void
}

export function AppHeader({
  logoUrl,
  sidebarOpen,
  scanPath,
  starting,
  hasSelectedJob,
  onToggleSidebar,
  onScanPathChange,
  onStartScan,
  onRerunSelectedJob,
  onRemoveSelectedJob,
}: AppHeaderProps) {
  return (
    <header className="sticky top-3 z-30 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight md:gap-3 md:text-2xl">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 w-8 p-0 lg:hidden"
              onClick={onToggleSidebar}
              aria-label={sidebarOpen ? 'Close jobs sidebar' : 'Open jobs sidebar'}
            >
              {sidebarOpen ? <X className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}
            </Button>
            <img src={logoUrl} alt="DiskUsage Web logo" className="h-8 w-8 md:h-10 md:w-10" />
            <span>Disk Usage Web</span>
          </h1>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="w-full sm:w-[360px]">
            <label htmlFor="scan-path" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Scan path
            </label>
            <Input
              id="scan-path"
              value={scanPath}
              onChange={(event) => onScanPathChange(event.target.value)}
              placeholder="/home"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Button type="button" className="w-full sm:w-auto" onClick={onStartScan} disabled={starting || !scanPath.trim()}>
              {starting ? 'Starting...' : 'Scan'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={onRerunSelectedJob}
              disabled={!hasSelectedJob}
            >
              <Play className="h-4 w-4" />
              Rerun
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={onRemoveSelectedJob}
              disabled={!hasSelectedJob}
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
