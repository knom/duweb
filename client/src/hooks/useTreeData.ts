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
  const [loadingParentIds, setLoadingParentIds] = useState<Set<number>>(new Set())
  const [treeUnavailable, setTreeUnavailable] = useState(false)
  const [isPostLoading, setIsPostLoading] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState(1)
  const [collapseLevel, setCollapseLevel] = useState<number | null>(null)
  const [collapseSignal, setCollapseSignal] = useState(0)

  const loadedParentsRef = useRef<Set<number>>(new Set())

  const clearTreeState = useCallback((): void => {
    setRootNode(null)
    setChildrenByParent({})
    setLoadingParentIds(new Set())
    setTreeUnavailable(false)
    setIsPostLoading(false)
    loadedParentsRef.current = new Set()
  }, [])

  const markLoading = useCallback((nodeId: number, loading: boolean): void => {
    setLoadingParentIds((state) => {
      const next = new Set(state)

      if (loading) {
        next.add(nodeId)
      } else {
        next.delete(nodeId)
      }

      return next
    })
  }, [])

  const loadNodeChildrenBatch = useCallback(
    async (jobId: string, parentNodeIds: number[]): Promise<{ ok: boolean; byParentId: Record<number, DirectoryNode[]> }> => {
      if (parentNodeIds.length === 0) {
        return { ok: true, byParentId: {} }
      }

      try {
        const response = await fetch(apiUrl(`/jobs/${jobId}/tree/children-batch`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentIds: parentNodeIds }),
        })

        if (!response.ok) {
          return { ok: false, byParentId: {} }
        }

        const payload = (await response.json()) as { byParentId?: Record<string, DirectoryNode[] | unknown> }
        const byParentId: Record<number, DirectoryNode[]> = {}

        for (const parentId of parentNodeIds) {
          const key = String(parentId)
          const children = payload.byParentId?.[key]
          byParentId[parentId] = Array.isArray(children) ? (children as DirectoryNode[]) : []
        }

        return { ok: true, byParentId }
      } catch {
        return { ok: false, byParentId: {} }
      }
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
            if (!parentId || loadedParentsRef.current.has(parentId)) {
              continue
            }

            batchParentIds.push(parentId)
            markLoading(parentId, true)
          }

          if (batchParentIds.length === 0) {
            continue
          }

          try {
            const batchResult = await loadNodeChildrenBatch(resolvedJobId, batchParentIds)

            if (cancelled) {
              return
            }

            if (!batchResult.ok) {
              continue
            }

            setChildrenByParent((state) => {
              const nextState = { ...state }

              for (const parentId of batchParentIds) {
                const children = batchResult.byParentId[parentId] ?? []
                nextState[parentId] = children
                loadedParentsRef.current.add(parentId)
              }

              return nextState
            })

            for (const parentId of batchParentIds) {
              const children = batchResult.byParentId[parentId] ?? []

              for (const child of children) {
                if (child.hasChildren && !loadedParentsRef.current.has(child.id)) {
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
  const maxLevel = levelOptions[levelOptions.length - 1] ?? 1
  const selectedLevelValue = Math.min(selectedLevel, maxLevel)

  const updateSelectedLevel = useCallback(
    (level: number): void => {
      setSelectedLevel(Math.max(1, Math.min(level, maxLevel)))
    },
    [maxLevel],
  )

  const applyCollapse = useCallback((): void => {
    setCollapseLevel(selectedLevelValue)
    setCollapseSignal((value) => value + 1)
  }, [selectedLevelValue])

  const ensureChildrenLoaded = useCallback(
    async (node: DirectoryNode): Promise<void> => {
      if (!jobId || !node.hasChildren || node.id in childrenByParent || loadingParentIds.has(node.id)) {
        return
      }

      if (loadedParentsRef.current.has(node.id)) {
        return
      }

      markLoading(node.id, true)

      try {
        const batchResult = await loadNodeChildrenBatch(jobId, [node.id])
        if (!batchResult.ok) {
          return
        }

        const payload = batchResult.byParentId[node.id] ?? []
        setChildrenByParent((current) => ({
          ...current,
          [node.id]: payload,
        }))
        loadedParentsRef.current.add(node.id)
      } finally {
        markLoading(node.id, false)
      }
    },
    [childrenByParent, jobId, loadNodeChildrenBatch, loadingParentIds, markLoading],
  )

  return {
    rootNode,
    treeUnavailable,
    isPostLoading,
    levelOptions,
    selectedLevel: selectedLevelValue,
    setSelectedLevel: updateSelectedLevel,
    collapseLevel,
    collapseSignal,
    applyCollapse,
    getChildren: (parentId: number): DirectoryNode[] | undefined => childrenByParent[parentId],
    isChildrenLoading: (parentId: number): boolean => loadingParentIds.has(parentId),
    ensureChildrenLoaded,
  }
}
