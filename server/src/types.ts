export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface DirectoryNode {
  name: string;
  path: string;
  sizeBytes: number;
  percentOfRoot: number;
  children: DirectoryNode[];
  inaccessible?: boolean;
}

export interface StoredDirectoryNode {
  id: number;
  parentId: number | null;
  jobId: string;
  depth: number;
  name: string;
  path: string;
  sizeBytes: number;
  percentOfRoot: number;
  inaccessible: boolean;
  hasChildren: boolean;
}

export interface ScanProgress {
  directoriesVisited: number;
  filesVisited: number;
  startedAt: string;
  endedAt?: string;
}

export interface ScanJob {
  id: string;
  status: JobStatus;
  rootPath: string;
  progress: ScanProgress;
  runtimeMs?: number;
  error?: string;
}
