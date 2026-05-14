import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { DirectoryNode } from '../types/scan'

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[exponent]}`
}

export function TreeNodeRow({ node, depth }: { node: DirectoryNode; depth: number }) {
  const [collapsed, setCollapsed] = useState(depth > 1)
  const hasChildren = node.children.length > 0

  return (
    <li>
      <div
        className="grid min-h-8 grid-cols-[1.5rem_minmax(150px,1.2fr)_auto_auto_1fr] items-center gap-2 border-b border-dashed border-slate-200 px-2 py-1 text-sm"
        style={{ paddingLeft: `${depth * 1.05}rem` }}
      >
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-40"
          onClick={() => setCollapsed((value) => !value)}
          disabled={!hasChildren}
          aria-label={collapsed ? 'Expand directory' : 'Collapse directory'}
        >
          {hasChildren ? (
            collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="text-xs">•</span>
          )}
        </button>
        <span className="truncate font-mono text-[13px] text-slate-800">{node.name || node.path}</span>
        {node.inaccessible && (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">inaccessible</span>
        )}
        <span className="justify-self-end font-mono text-[12px] text-slate-600">{formatBytes(node.sizeBytes)}</span>
        <span className="justify-self-end font-mono text-[12px] text-slate-500">{node.percentOfRoot.toFixed(2)}%</span>
        <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-200/70" aria-hidden="true">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
            style={{ width: `${Math.min(100, node.percentOfRoot)}%` }}
          />
        </div>
      </div>

      {!collapsed && hasChildren && (
        <ul>
          {node.children.map((child) => (
            <TreeNodeRow key={child.path} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}
