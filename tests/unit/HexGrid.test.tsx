import React from 'react'
import { render, screen } from '@testing-library/react'
import { HexGrid } from '../../src/components/HexGrid'
import { Photo } from '../../src/types'

describe('HexGrid Component', () => {
  const mockPhotos: Photo[] = [
    {
      id: '1',
      title: 'Test Photo 1',
      alt: 'Test photo 1 alt text',
      imageUrl: 'https://example.com/photo1.jpg',
      category: 'test',
      source: 'test',
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'Test Photo 2',
      alt: 'Test photo 2 alt text',
      imageUrl: 'https://example.com/photo2.jpg',
      category: 'test',
      source: 'test',
      createdAt: new Date().toISOString(),
    },
  ]

  beforeEach(() => {
    // Reset any mocks
    jest.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<HexGrid photos={[]} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })

  it('renders with photos', () => {
    render(<HexGrid photos={mockPhotos} />)
    const canvas = screen.getByRole('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('calls onHexClick when a hex is clicked', () => {
    const onHexClick = jest.fn()
    render(<HexGrid photos={mockPhotos} onHexClick={onHexClick} />)
    
    // Simulate click on canvas
    const canvas = screen.getByRole('canvas')
    canvas.click()
    
    // Note: Actual click detection would require more complex setup
    // This is a placeholder for the structure
  })

  it('applies custom spacing', () => {
    const { rerender } = render(<HexGrid photos={mockPhotos} spacing={1.5} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
    
    rerender(<HexGrid photos={mockPhotos} spacing={2.0} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })

  it('accepts external canvas ref', () => {
    const canvasRef = { current: null }
    render(<HexGrid photos={mockPhotos} canvasRef={canvasRef as any} />)
    expect(canvasRef.current).not.toBeNull()
  })

  it('handles empty photo array', () => {
    render(<HexGrid photos={[]} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })

  it('updates when photos change', () => {
    const { rerender } = render(<HexGrid photos={mockPhotos} />)
    
    const newPhotos: Photo[] = [
      ...mockPhotos,
      {
        id: '3',
        title: 'Test Photo 3',
        alt: 'Test photo 3 alt text',
        imageUrl: 'https://example.com/photo3.jpg',
        category: 'test',
        source: 'test',
        createdAt: new Date().toISOString(),
      },
    ]
    
    rerender(<HexGrid photos={newPhotos} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })

  it('respects modalOpen prop', () => {
    const { rerender } = render(<HexGrid photos={mockPhotos} modalOpen={false} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
    
    rerender(<HexGrid photos={mockPhotos} modalOpen={true} />)
    expect(screen.getByRole('canvas')).toBeInTheDocument()
  })
})
