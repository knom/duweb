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
}

export function TreeToolbar({
  showControls,
  selectedLevel,
  levelOptions,
  onSelectedLevelChange,
  onCollapse,
  jobStatus,
}: TreeToolbarProps) {
  return (
    <div className="flex items-center gap-2">
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
