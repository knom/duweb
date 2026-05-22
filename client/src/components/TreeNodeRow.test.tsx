import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TreeNodeRow } from './TreeNodeRow'

describe('TreeNodeRow', () => {
  it('renders a leaf node with size, percent, and inaccessible label', () => {
    render(
      <TreeNodeRow
        node={{
          id: 1,
          parentId: null,
          jobId: 'job-1',
          depth: 0,
          name: 'restricted',
          path: '/restricted',
          sizeBytes: 1024,
          percentOfRoot: 10,
          inaccessible: true,
          hasChildren: false,
        }}
        depth={0}
        collapseLevel={null}
        collapseSignal={0}
        getChildren={() => undefined}
        isChildrenLoading={() => false}
        onExpandNode={vi.fn()}
      />,
    )

    expect(screen.getByText('restricted')).toBeTruthy()
    expect(screen.getByText('inaccessible')).toBeTruthy()
    expect(screen.getByText('1.00 KB')).toBeTruthy()
    expect(screen.getByText('10.00%')).toBeTruthy()
    expect(screen.getByLabelText('Collapse directory').hasAttribute('disabled')).toBe(true)
  })

  it('expands a collapsed parent and requests children when missing', async () => {
    const onExpandNode = vi.fn().mockResolvedValue(undefined)

    render(
      <TreeNodeRow
        node={{
          id: 2,
          parentId: null,
          jobId: 'job-1',
          depth: 0,
          name: 'parent',
          path: '/parent',
          sizeBytes: 2048,
          percentOfRoot: 100,
          inaccessible: false,
          hasChildren: true,
        }}
        depth={0}
        collapseLevel={0}
        collapseSignal={1}
        getChildren={() => undefined}
        isChildrenLoading={() => false}
        onExpandNode={onExpandNode}
      />,
    )

    fireEvent.click(screen.getByLabelText('Expand directory'))

    await waitFor(() => {
      expect(onExpandNode).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByLabelText('Collapse directory')).toBeTruthy()
  })

  it('renders loading state and nested children when expanded', () => {
    render(
      <TreeNodeRow
        node={{
          id: 3,
          parentId: null,
          jobId: 'job-1',
          depth: 0,
          name: 'root',
          path: '/root',
          sizeBytes: 4096,
          percentOfRoot: 100,
          inaccessible: false,
          hasChildren: true,
        }}
        depth={0}
        collapseLevel={1}
        collapseSignal={1}
        getChildren={(id) =>
          id === 3
            ? [
                {
                  id: 4,
                  parentId: 3,
                  jobId: 'job-1',
                  depth: 1,
                  name: 'child',
                  path: '/root/child',
                  sizeBytes: 1024,
                  percentOfRoot: 25,
                  inaccessible: false,
                  hasChildren: false,
                },
              ]
            : undefined
        }
        isChildrenLoading={(id) => id === 3}
        onExpandNode={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByLabelText('Expand directory'))

    expect(screen.getByText('Loading...')).toBeTruthy()
    expect(screen.getByText('child')).toBeTruthy()
  })
})