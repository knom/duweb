import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { JobsSidebar } from './JobsSidebar'
import type { ScanJob } from '../types/scan'

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

describe('JobsSidebar', () => {
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
