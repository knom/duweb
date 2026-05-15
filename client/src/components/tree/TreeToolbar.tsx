import { Loader2 } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import type { JobStatus } from '../../types/scan'

interface TreeToolbarProps {
  showControls: boolean
  selectedLevel: number
  levelOptions: number[]
  onSelectedLevelChange: (level: number) => void
  onCollapse: () => void
  jobStatus?: JobStatus
  isPostLoading: boolean
}

export function TreeToolbar({
  showControls,
  selectedLevel,
  levelOptions,
  onSelectedLevelChange,
  onCollapse,
  jobStatus,
  isPostLoading,
}: TreeToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      {isPostLoading && (
        <span className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-700">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading...
        </span>
      )}
      {showControls && (
        <>
          <select
            id="collapse-level"
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700"
            value={selectedLevel}
            onChange={(event) => onSelectedLevelChange(Number(event.target.value))}
          >
            {levelOptions.map((level) => (
              <option key={level} value={level}>
                {`Level ${level}`}
              </option>
            ))}
          </select>
          <Button type="button" variant="secondary" size="sm" onClick={onCollapse}>
            Collapse
          </Button>
        </>
      )}
      {jobStatus && <Badge variant={jobStatus}>{jobStatus}</Badge>}
    </div>
  )
}
