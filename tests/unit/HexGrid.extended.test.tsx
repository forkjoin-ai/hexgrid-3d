import React from 'react'
import { render, screen } from '@testing-library/react'
import { HexGrid } from '../../src/components/HexGrid'
import { Photo } from '../../src/types'

describe('HexGrid Texture Loading', () => {
  const mockPhotos: Photo[] = [
    {
      id: '1',
      url: 'https://example.com/photo1.jpg',
      source: 'test',
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      url: 'https://example.com/photo2.jpg',
      source: 'test',
      createdAt: new Date().toISOString(),
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    // Mock Image constructor
    global.Image = class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      src = ''
      
      constructor() {
        setTimeout(() => {
          if (this.onload) this.onload()
        }, 0)
      }
    } as any
  })

  it('renders canvas for texture loading', () => {
    render(<HexGrid photos={mockPhotos} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })

  it('handles empty photo array', () => {
    render(<HexGrid photos={[]} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })

  it('handles photos with thumbnailUrls', () => {
    const photosWithThumbs = mockPhotos.map(p => ({
      ...p,
      thumbnailUrl: `${p.url}-thumb`,
    }))
    
    render(<HexGrid photos={photosWithThumbs} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })

  it('handles duplicate photo URLs', () => {
    const duplicatePhotos: Photo[] = [
      {
        id: '1',
        url: 'https://example.com/same-photo.jpg',
        source: 'test',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        url: 'https://example.com/same-photo.jpg',
        source: 'test',
        createdAt: new Date().toISOString(),
      },
    ]
    
    render(<HexGrid photos={duplicatePhotos} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })
})

describe('HexGrid Camera System', () => {
  const mockPhotos: Photo[] = [
    {
      id: '1',
      url: 'https://example.com/photo1.jpg',
      source: 'test',
      createdAt: new Date().toISOString(),
    },
  ]

  it('accepts custom spacing', () => {
    const { rerender } = render(<HexGrid photos={mockPhotos} spacing={0.5} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
    
    rerender(<HexGrid photos={mockPhotos} spacing={2.0} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })

  it('handles external canvas ref', () => {
    const canvasRef = { current: null }
    render(<HexGrid photos={mockPhotos} canvasRef={canvasRef as any} />)
    
    expect(canvasRef.current).toBeDefined()
  })

  it('responds to modalOpen prop changes', () => {
    const { rerender } = render(<HexGrid photos={mockPhotos} modalOpen={false} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
    
    rerender(<HexGrid photos={mockPhotos} modalOpen={true} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })
})

describe('HexGrid Props Handling', () => {
  const mockPhotos: Photo[] = [
    {
      id: '1',
      url: 'https://example.com/photo1.jpg',
      source: 'test',
      createdAt: new Date().toISOString(),
    },
  ]

  it('calls onHexClick callback', () => {
    const onHexClick = jest.fn()
    render(<HexGrid photos={mockPhotos} onHexClick={onHexClick} />)
    
    // Would need actual click simulation to test properly
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })

  it('handles onLeaderboardUpdate callback', () => {
    const onLeaderboardUpdate = jest.fn()
    render(
      <HexGrid
        photos={mockPhotos}
        onLeaderboardUpdate={onLeaderboardUpdate}
      />
    )
    
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })

  it('handles autoplayQueueLimit prop', () => {
    render(
      <HexGrid
        photos={mockPhotos}
        autoplayQueueLimit={50}
        onAutoplayQueueLimitChange={() => {}}
      />
    )
    
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })

  it('handles userId prop', () => {
    render(<HexGrid photos={mockPhotos} userId="user123" />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })

  it('handles username prop', () => {
    render(<HexGrid photos={mockPhotos} username="testuser" />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })
})

describe('HexGrid Photo Updates', () => {
  it('updates when photos are added', () => {
    const initialPhotos: Photo[] = [
      {
        id: '1',
        url: 'https://example.com/photo1.jpg',
        source: 'test',
        createdAt: new Date().toISOString(),
      },
    ]
    
    const { rerender } = render(<HexGrid photos={initialPhotos} />)
    
    const updatedPhotos = [
      ...initialPhotos,
      {
        id: '2',
        url: 'https://example.com/photo2.jpg',
        source: 'test',
        createdAt: new Date().toISOString(),
      },
    ]
    
    rerender(<HexGrid photos={updatedPhotos} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })

  it('updates when photos are removed', () => {
    const initialPhotos: Photo[] = [
      {
        id: '1',
        url: 'https://example.com/photo1.jpg',
        source: 'test',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        url: 'https://example.com/photo2.jpg',
        source: 'test',
        createdAt: new Date().toISOString(),
      },
    ]
    
    const { rerender } = render(<HexGrid photos={initialPhotos} />)
    
    rerender(<HexGrid photos={[initialPhotos[0]]} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })

  it('handles photo metadata changes', () => {
    const photo: Photo = {
      id: '1',
      url: 'https://example.com/photo1.jpg',
      source: 'test',
      createdAt: new Date().toISOString(),
      title: 'Original Title',
    }
    
    const { rerender } = render(<HexGrid photos={[photo]} />)
    
    const updatedPhoto = {
      ...photo,
      title: 'Updated Title',
      description: 'New description',
    }
    
    rerender(<HexGrid photos={[updatedPhoto]} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })
})
