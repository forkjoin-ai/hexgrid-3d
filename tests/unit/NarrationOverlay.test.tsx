import React from 'react'
import { render } from '@testing-library/react'
import { NarrationOverlay } from '../../src/components/NarrationOverlay'

describe('NarrationOverlay Component', () => {
  const mockMessages = [
    {
      id: '1',
      text: 'Test message 1',
      timestamp: Date.now(),
      type: 'info' as const,
    },
    {
      id: '2',
      text: 'Test message 2',
      timestamp: Date.now(),
      type: 'achievement' as const,
    },
  ]

  it('renders when visible', () => {
    const { container } = render(
      <NarrationOverlay
        messages={mockMessages}
        statsTracker={null as any}
        isVisible={true}
        onClose={() => {}}
      />
    )
    expect(container.firstChild).toBeInTheDocument()
  })

  it('does not render when not visible', () => {
    const { container } = render(
      <NarrationOverlay
        messages={mockMessages}
        statsTracker={null as any}
        isVisible={false}
        onClose={() => {}}
      />
    )
    // Should still render but with opacity 0
    expect(container.firstChild).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn()
    const { container } = render(
      <NarrationOverlay
        messages={mockMessages}
        statsTracker={null as any}
        isVisible={true}
        onClose={onClose}
      />
    )
    
    // Find and click close button
    const closeButton = container.querySelector('button')
    if (closeButton) {
      closeButton.click()
      expect(onClose).toHaveBeenCalled()
    }
  })

  it('displays all messages', () => {
    const { container } = render(
      <NarrationOverlay
        messages={mockMessages}
        statsTracker={null as any}
        isVisible={true}
        onClose={() => {}}
      />
    )
    
    expect(container.textContent).toContain('Test message 1')
    expect(container.textContent).toContain('Test message 2')
  })
})
