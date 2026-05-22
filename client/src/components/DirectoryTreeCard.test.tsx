import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DirectoryTreeCard } from './DirectoryTreeCard'

const useTreeDataMock = vi.fn()

vi.mock('../hooks/useTreeData', () => ({
  useTreeData: (args: unknown) => useTreeDataMock(args),
}))

vi.mock('./TreeNodeRow', () => ({
  TreeNodeRow: ({ node }: { node: { name: string } }) => <li>node:{node.name}</li>,
}))

vi.mock('./tree/TreeToolbar', () => ({
  TreeToolbar: ({ showControls, jobStatus }: { showControls: boolean; jobStatus?: string }) => (
    <div>{`toolbar:${showControls}:${jobStatus ?? 'none'}`}</div>
  ),
}))

describe('DirectoryTreeCard', () => {
  it('shows the empty state when no job is selected', () => {
    useTreeDataMock.mockReturnValue({
      rootNode: null,
      treeUnavailable: false,
      isPostLoading: false,
      levelOptions: [],
      selectedLevel: 1,
      setSelectedLevel: vi.fn(),
      collapseLevel: null,
      collapseSignal: 0,
      applyCollapse: vi.fn(),
      getChildren: vi.fn(),
      isChildrenLoading: vi.fn(),
      ensureChildrenLoaded: vi.fn(),
    })

    render(<DirectoryTreeCard job={null} apiUrl={(path) => `/api${path}`} />)

    expect(screen.getByText('Choose or run a job to inspect disk usage.')).toBeTruthy()
    expect(screen.getByText('Select a completed scan to view the disk usage.')).toBeTruthy()
    expect(screen.getByText('toolbar:false:none')).toBeTruthy()
  })

  it('shows tree unavailable state for completed jobs without stored nodes', () => {
    useTreeDataMock.mockReturnValue({
      rootNode: null,
      treeUnavailable: true,
      isPostLoading: false,
      levelOptions: [],
      selectedLevel: 1,
      setSelectedLevel: vi.fn(),
      collapseLevel: null,
      collapseSignal: 0,
      applyCollapse: vi.fn(),
      getChildren: vi.fn(),
      isChildrenLoading: vi.fn(),
      ensureChildrenLoaded: vi.fn(),
    })

    render(
      <DirectoryTreeCard
        job={{
          id: 'job-1',
          status: 'completed',
          rootPath: '/data',
          progress: { directoriesVisited: 3, filesVisited: 4, startedAt: '2026-05-14T10:00:00.000Z' },
          runtimeMs: 65_000,
        }}
        apiUrl={(path) => `/api${path}`}
      />,
    )

    expect(screen.getByText('Directory Tree')).toBeTruthy()
    expect(screen.getByText('/data')).toBeTruthy()
    expect(screen.getByText('3 directories · 4 files · Runtime 1m 5s')).toBeTruthy()
    expect(screen.getByText('This completed job has no stored tree details. Rerun the scan to generate node data.')).toBeTruthy()
  })

  it('renders the root node when tree data is available', () => {
    useTreeDataMock.mockReturnValue({
      rootNode: {
        id: 1,
        parentId: null,
        jobId: 'job-1',
        depth: 0,
        name: 'data',
        path: '/data',
        sizeBytes: 100,
        percentOfRoot: 100,
        inaccessible: false,
        hasChildren: true,
      },
      treeUnavailable: false,
      isPostLoading: true,
      levelOptions: [1, 2],
      selectedLevel: 2,
      setSelectedLevel: vi.fn(),
      collapseLevel: 1,
      collapseSignal: 9,
      applyCollapse: vi.fn(),
      getChildren: vi.fn(),
      isChildrenLoading: vi.fn(),
      ensureChildrenLoaded: vi.fn(),
    })

    render(
      <DirectoryTreeCard
        job={{
          id: 'job-1',
          status: 'running',
          rootPath: '/data',
          progress: { directoriesVisited: 3, filesVisited: 4, startedAt: '2026-05-14T10:00:00.000Z' },
          runtimeMs: 5_000,
        }}
        apiUrl={(path) => `/api${path}`}
      />,
    )

    expect(screen.getByText('3 directories · 4 files')).toBeTruthy()
    expect(screen.queryByText(/Runtime/)).toBeNull()
    expect(screen.getByText('toolbar:true:running')).toBeTruthy()
    expect(screen.getByText('node:data')).toBeTruthy()
  })
})