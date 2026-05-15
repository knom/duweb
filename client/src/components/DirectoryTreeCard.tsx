import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { TreeNodeRow } from './TreeNodeRow'
import { TreeToolbar } from './tree/TreeToolbar'
import { TreeEmptyState } from './tree/TreeEmptyState'
import { useTreeData } from '../hooks/useTreeData'
import type { ScanJob } from '../types/scan'
import { formatDuration } from '../lib/formatDuration'

interface DirectoryTreeCardProps {
  job: ScanJob | null
  apiUrl: (path: string) => string
}

export function DirectoryTreeCard({ job, apiUrl }: DirectoryTreeCardProps) {
  const {
    rootNode,
    treeUnavailable,
    isPostLoading,
    levelOptions,
    selectedLevel,
    setSelectedLevel,
    collapseLevel,
    collapseSignal,
    applyCollapse,
    getChildren,
    isChildrenLoading,
    ensureChildrenLoaded,
  } = useTreeData({ job, apiUrl })

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden lg:col-start-2">
      <CardHeader className="border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <span>Directory Tree</span>
              {job && <span>{job.rootPath}</span>}
            </CardTitle>
            <CardDescription>
              {job
                ? `${job.progress.directoriesVisited} directories · ${job.progress.filesVisited} files${job.status !== 'running' ? ` · Runtime ${formatDuration(job.runtimeMs)}` : ''}`
                : 'Choose or run a job to inspect disk usage.'}
            </CardDescription>
          </div>
          <TreeToolbar
            showControls={Boolean(job) && levelOptions.length > 0}
            selectedLevel={selectedLevel}
            levelOptions={levelOptions}
            onSelectedLevelChange={setSelectedLevel}
            onCollapse={applyCollapse}
            jobStatus={job?.status}
            isPostLoading={isPostLoading}
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-0">
        {!rootNode ? (
          <TreeEmptyState treeUnavailable={treeUnavailable} />
        ) : (
          <ul className="px-2 py-2">
            <TreeNodeRow
              node={rootNode}
              depth={0}
              collapseLevel={collapseLevel}
              collapseSignal={collapseSignal}
              getChildren={getChildren}
              isChildrenLoading={isChildrenLoading}
              onExpandNode={ensureChildrenLoaded}
            />
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
