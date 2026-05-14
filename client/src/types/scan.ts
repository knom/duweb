export type JobStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface DirectoryNode {
  name: string
  path: string
  sizeBytes: number
  percentOfRoot: number
  children: DirectoryNode[]
  inaccessible?: boolean
}

export interface ScanProgress {
  directoriesVisited: number
  filesVisited: number
  startedAt: string
  endedAt?: string
}

export interface ScanJob {
  id: string
  status: JobStatus
  rootPath: string
  progress: ScanProgress
  result?: DirectoryNode
  error?: string
}
