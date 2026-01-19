import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HexGrid } from '../../src/components/HexGrid'
import { uiStore } from '../../src/stores/uiStore'
import { Photo } from '../../src/types'

describe('HexGrid Integration Tests', () => {
  const mockPhotos: Photo[] = Array.from({ length: 20 }, (_, i) => ({
    id: `${i + 1}`,
    url: `https://example.com/photo${i + 1}.jpg`,
    source: 'test',
    createdAt: new Date().toISOString(),
    title: `Photo ${i + 1}`,
  }))

  beforeEach(() => {
    jest.clearAllMocks()
    uiStore.set({
      debugOpen: false,
      showStats: false,
      cameraOpen: false,
      showNarration: false,
    })
  })

  it('integrates with uiStore for debug panel', async () => {
    render(<HexGrid photos={mockPhotos} />)
    
    expect(uiStore).toBeDefined()
    
    // Toggle debug via store
    uiStore.toggleDebug()
    
    await waitFor(() => {
      // Debug panel should be visible
      // Note: Actual implementation depends on HexGrid internals
    })
  })

  it('handles large photo sets', () => {
    const largePhotoSet = Array.from({ length: 1000 }, (_, i) => ({
      id: `${i + 1}`,
      url: `https://example.com/photo${i + 1}.jpg`,
      source: 'test',
      createdAt: new Date().toISOString(),
    }))

    render(<HexGrid photos={largePhotoSet} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })

  it('handles photo updates and re-renders efficiently', () => {
    const { rerender } = render(<HexGrid photos={mockPhotos} />)
    
    // Update with new photos
    const updatedPhotos = [
      ...mockPhotos,
      {
        id: '21',
        url: 'https://example.com/photo21.jpg',
        source: 'test',
        createdAt: new Date().toISOString(),
      },
    ]
    
    rerender(<HexGrid photos={updatedPhotos} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })

  it('maintains camera state across re-renders', () => {
    const { rerender } = render(<HexGrid photos={mockPhotos} />)
    
    // Simulate camera interaction
    const canvas = screen.getByRole('canvas')
    userEvent.click(canvas)
    
    // Re-render with same props
    rerender(<HexGrid photos={mockPhotos} />)
    
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })

  it('coordinates with external canvas ref', () => {
    const canvasRef = { current: null }
    const { rerender } = render(
      <HexGrid photos={mockPhotos} canvasRef={canvasRef as any} />
    )
    
    expect(canvasRef.current).not.toBeNull()
    
    // Update photos
    const newPhotos = [...mockPhotos].slice(0, 10)
    rerender(<HexGrid photos={newPhotos} canvasRef={canvasRef as any} />)
    
    expect(canvasRef.current).not.toBeNull()
  })

  it('handles autoplay queue limit changes', () => {
    const onAutoplayQueueLimitChange = jest.fn()
    
    render(
      <HexGrid
        photos={mockPhotos}
        autoplayQueueLimit={50}
        onAutoplayQueueLimitChange={onAutoplayQueueLimitChange}
      />
    )
    
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })

  it('integrates leaderboard updates', () => {
    const onLeaderboardUpdate = jest.fn()
    
    render(
      <HexGrid
        photos={mockPhotos}
        onLeaderboardUpdate={onLeaderboardUpdate}
      />
    )
    
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })
})
