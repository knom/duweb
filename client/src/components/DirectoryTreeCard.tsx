import { useEffect, useMemo, useState } from 'react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { TreeNodeRow } from './TreeNodeRow'
import type { ScanJob } from '../types/scan'

interface DirectoryTreeCardProps {
  job: ScanJob | null
}

function getMaxDepth(node: ScanJob['result']): number {
  if (!node || node.children.length === 0) {
    return 0
  }

  return 1 + Math.max(...node.children.map((child) => getMaxDepth(child)))
}

export function DirectoryTreeCard({ job }: DirectoryTreeCardProps) {
  const [selectedLevel, setSelectedLevel] = useState(1)
  const [collapseLevel, setCollapseLevel] = useState<number | null>(null)
  const [collapseSignal, setCollapseSignal] = useState(0)

  const maxDepth = useMemo(() => getMaxDepth(job?.result), [job?.id, job?.result])
  const levelOptions = useMemo(() => Array.from({ length: maxDepth }, (_, index) => index + 1), [maxDepth])

  useEffect(() => {
    if (levelOptions.length === 0) {
      return
    }

    setSelectedLevel((current) => Math.min(current, levelOptions[levelOptions.length - 1]))
  }, [levelOptions])

  function applyCollapse(): void {
    setCollapseLevel(selectedLevel)
    setCollapseSignal((value) => value + 1)
  }

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden lg:col-start-2">
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
          <div className="flex items-center gap-2">
            {job && levelOptions.length > 0 && (
              <>
                <select
                  id="collapse-level"
                  className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700"
                  value={selectedLevel}
                  onChange={(event) => setSelectedLevel(Number(event.target.value))}
                >
                  {levelOptions.map((level) => (
                    <option key={level} value={level}>
                      {`Level ${level}`}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="secondary" size="sm" onClick={applyCollapse}>
                  Collapse
                </Button>
              </>
            )}
            {job && <Badge variant={job.status}>{job.status}</Badge>}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-0">
        {!job?.result ? (
          <div className="px-4 py-6 text-sm text-slate-500">Select a scan to view the disk usage.</div>
        ) : (
          <ul className="px-2 py-2">
            <TreeNodeRow node={job.result} depth={0} collapseLevel={collapseLevel} collapseSignal={collapseSignal} />
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
