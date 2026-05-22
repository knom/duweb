import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppHeader } from './AppHeader'

describe('AppHeader', () => {
  function renderHeader(overrides: Partial<React.ComponentProps<typeof AppHeader>> = {}) {
    const props: React.ComponentProps<typeof AppHeader> = {
      logoUrl: '/favicon.svg',
      sidebarOpen: false,
      scanPath: '/home/user',
      starting: false,
      authRequired: false,
      authUsername: null,
      onToggleSidebar: vi.fn(),
      onScanPathChange: vi.fn(),
      fetchPathSuggestions: vi.fn().mockResolvedValue(['/home/user/docs', '/home/user/downloads']),
      onStartScan: vi.fn(),
      ...overrides,
    }

    const view = render(<AppHeader {...props} />)
    return { ...view, props }
  }

  it('renders auth state, toggles sidebar, and starts a scan', () => {
    const { props } = renderHeader({ authRequired: true, authUsername: 'alice' })

    fireEvent.click(screen.getByLabelText('Open jobs sidebar'))
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }))

    expect(screen.getByLabelText('Authenticated user').textContent).toContain('alice')
    expect(props.onToggleSidebar).toHaveBeenCalledTimes(1)
    expect(props.onStartScan).toHaveBeenCalledTimes(1)
  })

  it('loads and applies path suggestions from the dropdown', async () => {
    const onScanPathChange = vi.fn()
    const fetchPathSuggestions = vi.fn().mockResolvedValue(['/srv/data', '/srv/logs'])

    renderHeader({ scanPath: '/srv', onScanPathChange, fetchPathSuggestions })

    fireEvent.focus(screen.getByLabelText('Scan path'))

    await waitFor(() => {
      expect(fetchPathSuggestions).toHaveBeenCalledWith('/srv', expect.any(AbortSignal))
    })

    fireEvent.click(screen.getByRole('button', { name: '/srv/logs' }))

    expect(onScanPathChange).toHaveBeenCalledWith('/srv/logs')
  })

  it('supports keyboard navigation and enter selection in suggestions', async () => {
    const onScanPathChange = vi.fn()
    const fetchPathSuggestions = vi.fn().mockResolvedValue(['/tmp/a', '/tmp/b'])

    renderHeader({ scanPath: '/tmp', onScanPathChange, fetchPathSuggestions })

    const input = screen.getByLabelText('Scan path')
    fireEvent.focus(input)

    await screen.findByRole('button', { name: '/tmp/a' })

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onScanPathChange).toHaveBeenCalledWith('/tmp/b')
  })

  it('closes suggestions when escape is pressed', async () => {
    const fetchPathSuggestions = vi.fn().mockResolvedValue(['/tmp/a', '/tmp/b'])

    renderHeader({ scanPath: '/tmp', fetchPathSuggestions })

    const input = screen.getByLabelText('Scan path')
    fireEvent.focus(input)

    await screen.findByRole('button', { name: '/tmp/a' })

    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByRole('button', { name: '/tmp/a' })).toBeNull()
  })

  it('disables scan button when starting or path is blank', () => {
    const { rerender } = render(
      <AppHeader
        logoUrl="/favicon.svg"
        sidebarOpen={false}
        scanPath="   "
        starting={false}
        authRequired={false}
        authUsername={null}
        onToggleSidebar={vi.fn()}
        onScanPathChange={vi.fn()}
        fetchPathSuggestions={vi.fn().mockResolvedValue([])}
        onStartScan={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Scan' }).hasAttribute('disabled')).toBe(true)

    rerender(
      <AppHeader
        logoUrl="/favicon.svg"
        sidebarOpen={false}
        scanPath="/home/user"
        starting
        authRequired={false}
        authUsername={null}
        onToggleSidebar={vi.fn()}
        onScanPathChange={vi.fn()}
        fetchPathSuggestions={vi.fn().mockResolvedValue([])}
        onStartScan={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Starting...' }).hasAttribute('disabled')).toBe(true)
  })
})