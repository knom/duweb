import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { JobsSidebar } from './JobsSidebar'
import type { ScanJob } from '../types/scan'

describe('JobsSidebar', () => {
  const jobs = [
    {
      id: 'job-1',
      status: 'completed' as const,
      rootPath: '/srv/data',
      progress: { directoriesVisited: 2, filesVisited: 4, startedAt: '2026-05-14T10:00:00.000Z' },
      runtimeMs: 5_000,
    },
    {
      id: 'job-2',
      status: 'running' as const,
      rootPath: '/srv/logs',
      progress: { directoriesVisited: 3, filesVisited: 6, startedAt: '2026-05-14T11:00:00.000Z' },
      runtimeMs: 8_000,
    },
  ]

  function createJob(overrides: Partial<ScanJob>): ScanJob {
    return {
      id: 'job-default',
      status: 'queued',
      rootPath: '/mnt/default',
      progress: {
        directoriesVisited: 0,
        filesVisited: 0,
        startedAt: '2026-05-14T10:00:00.000Z',
      },
      ...overrides,
    }
  }

  function renderSidebar(overrides: Partial<React.ComponentProps<typeof JobsSidebar>> = {}) {
    const props: React.ComponentProps<typeof JobsSidebar> = {
      sidebarOpen: true,
      search: '',
      filter: 'all',
      loadingJobs: false,
      filteredJobs: jobs,
      selectedJobId: 'job-1',
      error: '',
      hasSelectedJob: true,
      onCloseSidebar: vi.fn(),
      onSearchChange: vi.fn(),
      onFilterChange: vi.fn(),
      onSelectJob: vi.fn(),
      onRerunSelectedJob: vi.fn(),
      onRemoveSelectedJob: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    }

    const view = render(<JobsSidebar {...props} />)
    return { ...view, props }
  }

  it('renders loading state and close action', () => {
    const { props } = renderSidebar({ loadingJobs: true, filteredJobs: [] })

    fireEvent.click(screen.getByLabelText('Close jobs sidebar'))

    expect(screen.getByText('Loading jobs...')).toBeTruthy()
    expect(props.onCloseSidebar).toHaveBeenCalledTimes(1)
  })

  it('renders empty state, filter changes, and disabled toolbar actions', () => {
    const { props } = renderSidebar({ filteredJobs: [], hasSelectedJob: false })

    fireEvent.change(screen.getByPlaceholderText('Search by path'), { target: { value: '/srv' } })
    fireEvent.click(screen.getByRole('button', { name: 'failed' }))

    expect(screen.getByText('No jobs match this filter.')).toBeTruthy()
    expect(props.onSearchChange).toHaveBeenCalledWith('/srv')
    expect(props.onFilterChange).toHaveBeenCalledWith('failed')
    expect(screen.getByRole('button', { name: 'Rerun' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Remove' }).hasAttribute('disabled')).toBe(true)
  })

  it('renders jobs, selects a job, reruns, and removes selected jobs', async () => {
    const { props } = renderSidebar({ error: 'Boom' })

    fireEvent.click(screen.getByText('/srv/logs'))
    fireEvent.click(screen.getByRole('button', { name: 'Rerun' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    expect(screen.getByText('Boom')).toBeTruthy()
    expect(props.onSelectJob).toHaveBeenCalledWith(jobs[1])
    expect(props.onRerunSelectedJob).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(props.onRemoveSelectedJob).toHaveBeenCalledTimes(1)
    })
  })

  it('hides runtime text for running jobs while preserving row size', () => {
    const runningJob = createJob({
      id: 'job-running',
      status: 'running',
      rootPath: '/mnt/running',
      runtimeMs: 4_000,
    })
    const completedJob = createJob({
      id: 'job-completed',
      status: 'completed',
      rootPath: '/mnt/completed',
      runtimeMs: 65_000,
    })

    render(
      <JobsSidebar
        sidebarOpen
        search=""
        filter="all"
        loadingJobs={false}
        filteredJobs={[runningJob, completedJob]}
        selectedJobId={runningJob.id}
        error=""
        hasSelectedJob
        onCloseSidebar={() => {}}
        onSearchChange={() => {}}
        onFilterChange={() => {}}
        onSelectJob={vi.fn()}
        onRerunSelectedJob={() => {}}
        onRemoveSelectedJob={() => {}}
      />,
    )

    const runningRow = screen.getByRole('button', { name: /\/mnt\/running/i })
    const completedRow = screen.getByRole('button', { name: /\/mnt\/completed/i })

    const runningRuntime = runningRow.querySelector('div[aria-hidden="true"]')
    const completedRuntime = completedRow.querySelector('div[aria-hidden="false"]')

    expect(runningRuntime?.textContent).toContain('Runtime: 4s')
    expect(completedRuntime?.textContent).toContain('Runtime: 1m 5s')
    expect(runningRow.className).toContain('min-h-20')
    expect(completedRow.className).toContain('min-h-20')
  })
})
