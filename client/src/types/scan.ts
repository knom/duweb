export type JobStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface DirectoryNode {
  id: number
  parentId: number | null
  jobId: string
  depth: number
  name: string
  path: string
  sizeBytes: number
  percentOfRoot: number
  inaccessible: boolean
  hasChildren: boolean
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
  error?: string
}
