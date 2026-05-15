import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DirectoryNode, ScanJob } from '../types/scan'

interface UseTreeDataArgs {
  job: ScanJob | null
  apiUrl: (path: string) => string
}

const PREFETCH_PARENT_BATCH_SIZE = 8

export function useTreeData({ job, apiUrl }: UseTreeDataArgs) {
  const [rootNode, setRootNode] = useState<DirectoryNode | null>(null)
  const [childrenByParent, setChildrenByParent] = useState<Record<number, DirectoryNode[]>>({})
  const [loadingParents, setLoadingParents] = useState<Record<number, boolean>>({})
  const [treeUnavailable, setTreeUnavailable] = useState(false)
  const [isPostLoading, setIsPostLoading] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState(1)
  const [collapseLevel, setCollapseLevel] = useState<number | null>(null)
  const [collapseSignal, setCollapseSignal] = useState(0)

  const requestedParentsRef = useRef<Set<number>>(new Set())

  const clearTreeState = useCallback((): void => {
    setRootNode(null)
    setChildrenByParent({})
    setLoadingParents({})
    setTreeUnavailable(false)
    setIsPostLoading(false)
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

  const loadNodeChildrenBatch = useCallback(
    async (jobId: string, parentNodeIds: number[]): Promise<Record<number, DirectoryNode[]>> => {
      if (parentNodeIds.length === 0) {
        return {}
      }

      const response = await fetch(apiUrl(`/jobs/${jobId}/tree/children-batch`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentIds: parentNodeIds }),
      })

      if (!response.ok) {
        return {}
      }

      const payload = (await response.json()) as { byParentId?: Record<string, DirectoryNode[] | unknown> }
      const byParentId: Record<number, DirectoryNode[]> = {}

      for (const parentId of parentNodeIds) {
        const key = String(parentId)
        const children = payload.byParentId?.[key]
        byParentId[parentId] = Array.isArray(children) ? (children as DirectoryNode[]) : []
      }

      return byParentId
    },
    [apiUrl],
  )

  const jobId = job?.id
  const jobStatus = job?.status

  useEffect(() => {
    let cancelled = false

    async function loadRoot(): Promise<void> {
      clearTreeState()

      if (!jobId || jobStatus !== 'completed') {
        return
      }

      try {
        const response = await fetch(apiUrl(`/jobs/${jobId}/tree/root`))
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
  }, [apiUrl, clearTreeState, jobId, jobStatus])

  useEffect(() => {
    if (!jobId || jobStatus !== 'completed' || !rootNode) {
      return
    }

    const resolvedJobId = jobId

    let cancelled = false
    const queue: number[] = [rootNode.id]

    async function prefetchTree(): Promise<void> {
      setIsPostLoading(true)

      try {
        while (!cancelled && queue.length > 0) {
          const batchParentIds: number[] = []

          while (queue.length > 0 && batchParentIds.length < PREFETCH_PARENT_BATCH_SIZE) {
            const parentId = queue.shift()
            if (!parentId || requestedParentsRef.current.has(parentId)) {
              continue
            }

            requestedParentsRef.current.add(parentId)
            batchParentIds.push(parentId)
            markLoading(parentId, true)
          }

          if (batchParentIds.length === 0) {
            continue
          }

          try {
            const childrenByParentId = await loadNodeChildrenBatch(resolvedJobId, batchParentIds)

            if (cancelled) {
              return
            }

            setChildrenByParent((state) => {
              const nextState = { ...state }

              for (const parentId of batchParentIds) {
                nextState[parentId] = childrenByParentId[parentId] ?? []
              }

              return nextState
            })

            for (const parentId of batchParentIds) {
              const children = childrenByParentId[parentId] ?? []

              for (const child of children) {
                if (child.hasChildren && !requestedParentsRef.current.has(child.id)) {
                  queue.push(child.id)
                }
              }
            }
          } finally {
            if (!cancelled) {
              for (const parentId of batchParentIds) {
                markLoading(parentId, false)
              }
            }
          }
        }
      } finally {
        if (!cancelled) {
          setIsPostLoading(false)
        }
      }
    }

    void prefetchTree()

    return () => {
      cancelled = true
      setIsPostLoading(false)
    }
  }, [jobId, jobStatus, loadNodeChildrenBatch, markLoading, rootNode])

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

  const applyCollapse = useCallback((): void => {
    setCollapseLevel(selectedLevel)
    setCollapseSignal((value) => value + 1)
  }, [selectedLevel])

  const ensureChildrenLoaded = useCallback(
    async (node: DirectoryNode): Promise<void> => {
      if (!jobId || !node.hasChildren || childrenByParent[node.id] || loadingParents[node.id]) {
        return
      }

      if (requestedParentsRef.current.has(node.id)) {
        return
      }

      requestedParentsRef.current.add(node.id)
      markLoading(node.id, true)

      try {
        const payload = await loadNodeChildren(jobId, node.id)
        setChildrenByParent((current) => ({
          ...current,
          [node.id]: payload,
        }))
      } finally {
        markLoading(node.id, false)
      }
    },
    [childrenByParent, jobId, loadNodeChildren, loadingParents, markLoading],
  )

  return {
    rootNode,
    treeUnavailable,
    isPostLoading,
    levelOptions,
    selectedLevel,
    setSelectedLevel,
    collapseLevel,
    collapseSignal,
    applyCollapse,
    getChildren: (parentId: number): DirectoryNode[] | undefined => childrenByParent[parentId],
    isChildrenLoading: (parentId: number): boolean => Boolean(loadingParents[parentId]),
    ensureChildrenLoaded,
  }
}
