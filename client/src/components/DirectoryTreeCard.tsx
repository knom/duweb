import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { TreeNodeRow } from './TreeNodeRow'
import type { DirectoryNode, ScanJob } from '../types/scan'

interface DirectoryTreeCardProps {
  job: ScanJob | null
  apiUrl: (path: string) => string
}

export function DirectoryTreeCard({ job, apiUrl }: DirectoryTreeCardProps) {
  const [rootNode, setRootNode] = useState<DirectoryNode | null>(null)
  const [childrenByParent, setChildrenByParent] = useState<Record<number, DirectoryNode[]>>({})
  const [loadingParents, setLoadingParents] = useState<Record<number, boolean>>({})
  const [treeUnavailable, setTreeUnavailable] = useState(false)
  const requestedParentsRef = useRef<Set<number>>(new Set())
  const [selectedLevel, setSelectedLevel] = useState(1)
  const [collapseLevel, setCollapseLevel] = useState<number | null>(null)
  const [collapseSignal, setCollapseSignal] = useState(0)

  const clearTreeState = useCallback((): void => {
    setRootNode(null)
    setChildrenByParent({})
    setLoadingParents({})
    setTreeUnavailable(false)
    requestedParentsRef.current = new Set()
  }, [])

  const markLoading = useCallback((nodeId: number, loading: boolean): void => {
    setLoadingParents((state) => ({ ...state, [nodeId]: loading }))
  }, [])

  const loadNodeChildren = useCallback(
    async (jobId: string, nodeId: number): Promise<DirectoryNode[]> => {
      const response = await fetch(apiUrl(`/jobs/${jobId}/tree/nodes/${nodeId}/children`))
      if (!response.ok) {
        return []
      }

      const payload = (await response.json()) as { children?: DirectoryNode[] }
      return Array.isArray(payload.children) ? payload.children : []
    },
    [apiUrl],
  )

  useEffect(() => {
    let cancelled = false

    async function loadRoot(): Promise<void> {
      clearTreeState()

      if (!job || job.status !== 'completed') {
        return
      }

      try {
        const response = await fetch(apiUrl(`/jobs/${job.id}/tree/root`))
        if (!response.ok) {
          if (!cancelled && response.status === 404) {
            setTreeUnavailable(true)
          }
          return
        }

        const payload = (await response.json()) as { node?: DirectoryNode }
        if (!cancelled) {
          setRootNode(payload.node ?? null)
        }
      } catch {
        if (!cancelled) {
          setRootNode(null)
          setTreeUnavailable(false)
        }
      }
    }

    void loadRoot()

    return () => {
      cancelled = true
    }
  }, [apiUrl, clearTreeState, job, job?.id, job?.status])

  useEffect(() => {
    if (!job || job.status !== 'completed' || !rootNode) {
      return
    }

    const jobId = job.id

    let cancelled = false
    const queue: DirectoryNode[] = [rootNode]

    async function prefetchTree(): Promise<void> {
      while (!cancelled && queue.length > 0) {
        const current = queue.shift()
        if (!current || !current.hasChildren) {
          continue
        }

        if (requestedParentsRef.current.has(current.id)) {
          continue
        }

        requestedParentsRef.current.add(current.id)
        markLoading(current.id, true)

        try {
          const children = await loadNodeChildren(jobId, current.id)

          if (cancelled) {
            return
          }

          setChildrenByParent((state) => ({ ...state, [current.id]: children }))
          for (const child of children) {
            if (child.hasChildren) {
              queue.push(child)
            }
          }
        } finally {
          if (!cancelled) {
            markLoading(current.id, false)
          }
        }
      }
    }

    void prefetchTree()

    return () => {
      cancelled = true
    }
  }, [job?.id, job?.status, loadNodeChildren, markLoading, rootNode])

  const maxDepth = useMemo(() => {
    if (!rootNode) {
      return 0
    }

    const visibleDepths = Object.values(childrenByParent)
      .flat()
      .map((node) => node.depth)
    visibleDepths.push(rootNode.depth)
    return Math.max(...visibleDepths)
  }, [childrenByParent, rootNode])

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

  async function ensureChildrenLoaded(node: DirectoryNode): Promise<void> {
    if (!job || !node.hasChildren || childrenByParent[node.id] || loadingParents[node.id]) {
      return
    }

    if (requestedParentsRef.current.has(node.id)) {
      return
    }

    requestedParentsRef.current.add(node.id)

    markLoading(node.id, true)

    try {
      const payload = await loadNodeChildren(job.id, node.id)
      setChildrenByParent((current) => ({
        ...current,
        [node.id]: payload,
      }))
    } finally {
      markLoading(node.id, false)
    }
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
        {!rootNode ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            {treeUnavailable
              ? 'This completed job has no stored tree details. Rerun the scan to generate node data.'
              : 'Select a scan to view the disk usage.'}
          </div>
        ) : (
          <ul className="px-2 py-2">
            <TreeNodeRow
              node={rootNode}
              depth={0}
              collapseLevel={collapseLevel}
              collapseSignal={collapseSignal}
              getChildren={(parentId) => childrenByParent[parentId]}
              isChildrenLoading={(parentId) => Boolean(loadingParents[parentId])}
              onExpandNode={ensureChildrenLoaded}
            />
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
