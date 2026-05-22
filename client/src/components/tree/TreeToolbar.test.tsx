import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TreeToolbar } from './TreeToolbar'

describe('TreeToolbar', () => {
  it('shows loading indicator and status badge without controls', () => {
    render(
      <TreeToolbar
        showControls={false}
        selectedLevel={1}
        levelOptions={[]}
        onSelectedLevelChange={vi.fn()}
        onCollapse={vi.fn()}
        jobStatus="running"
        isPostLoading
      />,
    )

    expect(screen.getByText('Loading...')).toBeTruthy()
    expect(screen.getByText('running')).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('renders controls and forwards level and collapse actions', () => {
    const onSelectedLevelChange = vi.fn()
    const onCollapse = vi.fn()

    render(
      <TreeToolbar
        showControls
        selectedLevel={2}
        levelOptions={[1, 2, 3]}
        onSelectedLevelChange={onSelectedLevelChange}
        onCollapse={onCollapse}
        jobStatus="completed"
        isPostLoading={false}
      />,
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }))

    expect(onSelectedLevelChange).toHaveBeenCalledWith(3)
    expect(onCollapse).toHaveBeenCalledTimes(1)
    expect(screen.getByText('completed')).toBeTruthy()
  })
})