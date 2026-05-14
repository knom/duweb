import { useEffect, useMemo, useState } from 'react'
import './App.css'

type JobStatus = 'queued' | 'running' | 'completed' | 'failed'

interface DirectoryNode {
  name: string
  path: string
  sizeBytes: number
  percentOfRoot: number
  children: DirectoryNode[]
  inaccessible?: boolean
}

interface ScanProgress {
  directoriesVisited: number
  filesVisited: number
  startedAt: string
  endedAt?: string
}

interface ScanJob {
  id: string
  status: JobStatus
  rootPath: string
  progress: ScanProgress
  result?: DirectoryNode
  error?: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[exponent]}`
}

function TreeNodeRow({ node, depth }: { node: DirectoryNode; depth: number }) {
  const [collapsed, setCollapsed] = useState(depth > 1)
  const hasChildren = node.children.length > 0

  return (
    <li className="tree-node">
      <div className="tree-row" style={{ paddingLeft: `${depth * 1.15}rem` }}>
        <button
          type="button"
          className="tree-toggle"
          onClick={() => setCollapsed((value) => !value)}
          disabled={!hasChildren}
          aria-label={collapsed ? 'Expand directory' : 'Collapse directory'}
        >
          {hasChildren ? (collapsed ? '>' : 'v') : '-'}
        </button>
        <span className="tree-name">{node.name || node.path}</span>
        {node.inaccessible && <span className="tree-warning">inaccessible</span>}
        <span className="tree-size">{formatBytes(node.sizeBytes)}</span>
        <span className="tree-percent">{node.percentOfRoot.toFixed(2)}%</span>
        <div className="tree-bar" aria-hidden="true">
          <div style={{ width: `${Math.min(100, node.percentOfRoot)}%` }} />
        </div>
      </div>

      {!collapsed && hasChildren && (
        <ul className="tree-children">
          {node.children.map((child) => (
            <TreeNodeRow key={child.path} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

function App() {
  const [scanPath, setScanPath] = useState('/')
  const [job, setJob] = useState<ScanJob | null>(null)
  const [error, setError] = useState<string>('')
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (!job || (job.status !== 'queued' && job.status !== 'running')) {
      return
    }

    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/jobs/${job.id}`)
      if (!response.ok) {
        setError('Unable to refresh job state.')
        return
      }

      const updated = (await response.json()) as ScanJob
      setJob(updated)
    }, 1200)

    return () => {
      window.clearInterval(timer)
    }
  }, [job])

  const statusLabel = useMemo(() => {
    if (!job) {
      return 'No job started'
    }
    return `${job.status.toUpperCase()} - dirs ${job.progress.directoriesVisited}, files ${job.progress.filesVisited}`
  }, [job])

  async function startScan() {
    setStarting(true)
    setError('')

    try {
      const response = await fetch('/api/jobs/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: scanPath }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        setError(payload.error ?? 'Could not start scan.')
        return
      }

      const created = (await response.json()) as ScanJob
      setJob(created)
    } catch {
      setError('Server is not reachable. Start the backend on port 3001.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <main className="app">
      <section className="panel hero">
        <h1>Disk Scope</h1>
        <p>
          Launch asynchronous disk scans and explore directory usage as a collapsible tree with absolute sizes
          and percentages of the scanned root.
        </p>
        <div className="controls">
          <label htmlFor="scan-path">Directory path</label>
          <input
            id="scan-path"
            value={scanPath}
            onChange={(event) => setScanPath(event.target.value)}
            placeholder="/home"
          />
          <button type="button" onClick={startScan} disabled={starting || !scanPath.trim()}>
            {starting ? 'Starting...' : 'Start Scan Job'}
          </button>
        </div>
      </section>

      <section className="panel status">
        <h2>Job Status</h2>
        <p>{statusLabel}</p>
        {job?.error && <p className="error">{job.error}</p>}
        {error && <p className="error">{error}</p>}
        {job && (
          <div className="meta">
            <span>Job: {job.id}</span>
            <span>Root: {job.rootPath}</span>
            <span>Started: {new Date(job.progress.startedAt).toLocaleString()}</span>
          </div>
        )}
      </section>

      <section className="panel tree-panel">
        <h2>Directory Tree</h2>
        {!job?.result && <p className="empty">No completed scan yet.</p>}
        {job?.result && (
          <ul className="tree-root">
            <TreeNodeRow node={job.result} depth={0} />
          </ul>
        )}
      </section>
    </main>
  )
}

export default App
