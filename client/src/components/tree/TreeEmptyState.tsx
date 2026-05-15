interface TreeEmptyStateProps {
  treeUnavailable: boolean
}

export function TreeEmptyState({ treeUnavailable }: TreeEmptyStateProps) {
  return (
    <div className="px-4 py-6 text-sm text-slate-500">
      {treeUnavailable
        ? 'This completed job has no stored tree details. Rerun the scan to generate node data.'
        : 'Select a scan to view the disk usage.'}
    </div>
  )
}
