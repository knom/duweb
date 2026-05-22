import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

const jobsControllerMock = vi.fn()

vi.mock('./hooks/useJobsController', () => ({
  useJobsController: () => jobsControllerMock(),
}))

vi.mock('./components/AppHeader', () => ({
  AppHeader: ({ onToggleSidebar }: { onToggleSidebar: () => void }) => (
    <button type="button" onClick={onToggleSidebar}>
      header-toggle
    </button>
  ),
}))

vi.mock('./components/JobsSidebar', () => ({
  JobsSidebar: ({ onSelectJob }: { onSelectJob: (job: { id: string }) => void }) => (
    <button type="button" onClick={() => onSelectJob({ id: 'job-2' })}>
      sidebar-select
    </button>
  ),
}))

vi.mock('./components/DirectoryTreeCard', () => ({
  DirectoryTreeCard: ({ job }: { job: { id: string } | null }) => <div>{job ? `job:${job.id}` : 'no-job'}</div>,
}))

describe('App', () => {
  it('wires sidebar toggling and closes the overlay', () => {
    const setSidebarOpen = vi.fn()

    jobsControllerMock.mockReturnValue({
      apiUrl: (path: string) => `/api${path}`,
      scanPath: '/home/user',
      setScanPath: vi.fn(),
      job: { id: 'job-1' },
      selectedJobId: 'job-1',
      search: '',
      setSearch: vi.fn(),
      filter: 'all',
      setFilter: vi.fn(),
      error: '',
      loadingJobs: false,
      starting: false,
      sidebarOpen: true,
      setSidebarOpen,
      authRequired: false,
      authUsername: null,
      fetchPathSuggestions: vi.fn(),
      filteredJobs: [],
      startScan: vi.fn(),
      rerunSelectedJob: vi.fn(),
      removeSelectedJob: vi.fn(),
      selectJob: vi.fn(),
    })

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'header-toggle' }))
    fireEvent.click(screen.getByLabelText('Close sidebar overlay'))

    expect(setSidebarOpen).toHaveBeenCalledTimes(2)
    expect(setSidebarOpen.mock.calls[1]?.[0]).toBe(false)
  })

  it('selects a job from the sidebar and closes it', () => {
    const setSidebarOpen = vi.fn()
    const selectJob = vi.fn()

    jobsControllerMock.mockReturnValue({
      apiUrl: (path: string) => `/api${path}`,
      scanPath: '/home/user',
      setScanPath: vi.fn(),
      job: null,
      selectedJobId: undefined,
      search: '',
      setSearch: vi.fn(),
      filter: 'all',
      setFilter: vi.fn(),
      error: '',
      loadingJobs: false,
      starting: false,
      sidebarOpen: false,
      setSidebarOpen,
      authRequired: false,
      authUsername: null,
      fetchPathSuggestions: vi.fn(),
      filteredJobs: [],
      startScan: vi.fn(),
      rerunSelectedJob: vi.fn(),
      removeSelectedJob: vi.fn(),
      selectJob,
    })

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'sidebar-select' }))

    expect(selectJob).toHaveBeenCalledWith({ id: 'job-2' })
    expect(setSidebarOpen).toHaveBeenCalledWith(false)
    expect(screen.getByText('no-job')).toBeTruthy()
  })
})