import { Badge } from './ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { TreeNodeRow } from './TreeNodeRow'
import type { ScanJob } from '../types/scan'

interface DirectoryTreeCardProps {
  job: ScanJob | null
}

export function DirectoryTreeCard({ job }: DirectoryTreeCardProps) {
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
          {job && <Badge variant={job.status}>{job.status}</Badge>}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-0">
        {!job?.result ? (
          <div className="px-4 py-6 text-sm text-slate-500">Select a scan to view the disk usage.</div>
        ) : (
          <ul className="px-2 py-2">
            <TreeNodeRow node={job.result} depth={0} />
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
