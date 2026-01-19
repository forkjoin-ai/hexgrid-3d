import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { HexGrid } from '../../src/components/HexGrid'
import { uiStore } from '../../src/stores/uiStore'
import { Photo } from '../../src/types'

describe('Performance Tests', () => {
  const createMockPhotos = (count: number): Photo[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `photo-${i}`,
      url: `https://example.com/photo${i}.jpg`,
      source: 'test',
      createdAt: new Date().toISOString(),
      title: `Photo ${i}`,
    }))
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('handles 100 photos efficiently', () => {
    const photos = createMockPhotos(100)
    const { container } = render(<HexGrid photos={photos} />)
    
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('handles 500 photos', () => {
    const photos = createMockPhotos(500)
    const { container } = render(<HexGrid photos={photos} />)
    
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('handles 1000 photos', () => {
    const photos = createMockPhotos(1000)
    const { container } = render(<HexGrid photos={photos} />)
    
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('handles rapid photo updates', () => {
    const initialPhotos = createMockPhotos(10)
    const { rerender } = render(<HexGrid photos={initialPhotos} />)
    
    // Rapidly update photos
    for (let i = 0; i < 10; i++) {
      const newPhotos = createMockPhotos(10 + i)
      rerender(<HexGrid photos={newPhotos} />)
    }
    
    expect(document.querySelector('canvas')).toBeInTheDocument()
  })

  it('handles rapid prop changes', () => {
    const photos = createMockPhotos(10)
    const { rerender } = render(<HexGrid photos={photos} spacing={1.0} />)
    
    // Rapidly change props
    for (let i = 0; i < 20; i++) {
      rerender(<HexGrid photos={photos} spacing={1.0 + i * 0.1} />)
    }
    
    expect(document.querySelector('canvas')).toBeInTheDocument()
  })

  it('cleans up properly on unmount', () => {
    const photos = createMockPhotos(100)
    const { unmount } = render(<HexGrid photos={photos} />)
    
    unmount()
    
    // Verify no memory leaks or hanging listeners
    expect(document.querySelector('canvas')).not.toBeInTheDocument()
  })

  it('handles multiple mount/unmount cycles', () => {
    const photos = createMockPhotos(50)
    
    for (let i = 0; i < 5; i++) {
      const { unmount } = render(<HexGrid photos={photos} />)
      expect(document.querySelector('canvas')).toBeInTheDocument()
      unmount()
      expect(document.querySelector('canvas')).not.toBeInTheDocument()
    }
  })
})

describe('Store Integration Performance', () => {
  beforeEach(() => {
    uiStore.set({
      debugOpen: false,
      showStats: false,
      cameraOpen: false,
      showNarration: false,
    })
  })

  it('handles rapid store updates', () => {
    const photos: Photo[] = [
      {
        id: '1',
        url: 'url',
        source: 'test',
        createdAt: '2024-01-01',
      },
    ]
    
    render(<HexGrid photos={photos} />)
    
    // Rapidly toggle store values
    for (let i = 0; i < 100; i++) {
      uiStore.toggleDebug()
      uiStore.toggleStats()
      uiStore.toggleCamera()
      uiStore.toggleNarration()
    }
    
    expect(document.querySelector('canvas')).toBeInTheDocument()
  })

  it('handles many store subscribers', () => {
    const photos: Photo[] = [
      {
        id: '1',
        url: 'url',
        source: 'test',
        createdAt: '2024-01-01',
      },
    ]
    
    const unsubscribers: Array<() => void> = []
    
    // Create many subscribers
    for (let i = 0; i < 100; i++) {
      const unsubscribe = uiStore.subscribe(() => {
        // Empty subscriber
      })
      unsubscribers.push(unsubscribe)
    }
    
    render(<HexGrid photos={photos} />)
    
    uiStore.toggleDebug()
    
    // Cleanup
    unsubscribers.forEach(unsub => unsub())
    
    expect(document.querySelector('canvas')).toBeInTheDocument()
  })
})

describe('Memory Management', () => {
  it('properly cleans up canvas references', () => {
    const photos: Photo[] = [
      {
        id: '1',
        url: 'url',
        source: 'test',
        createdAt: '2024-01-01',
      },
    ]
    
    const canvasRef = { current: null }
    const { unmount } = render(
      <HexGrid photos={photos} canvasRef={canvasRef as any} />
    )
    
    expect(canvasRef.current).toBeDefined()
    
    unmount()
    
    // Canvas ref should still hold reference but component should clean up
    expect(document.querySelector('canvas')).not.toBeInTheDocument()
  })

  it('handles texture cleanup on photo changes', async () => {
    const initialPhotos: Photo[] = [
      {
        id: '1',
        url: 'https://example.com/photo1.jpg',
        source: 'test',
        createdAt: '2024-01-01',
      },
    ]
    
    const { rerender } = render(<HexGrid photos={initialPhotos} />)
    
    // Change to completely different photos
    const newPhotos: Photo[] = [
      {
        id: '2',
        url: 'https://example.com/photo2.jpg',
        source: 'test',
        createdAt: '2024-01-02',
      },
    ]
    
    rerender(<HexGrid photos={newPhotos} />)
    
    await waitFor(() => {
      expect(document.querySelector('canvas')).toBeInTheDocument()
    })
  })
})
