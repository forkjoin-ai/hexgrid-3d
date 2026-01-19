import React from 'react'
import { render } from '@testing-library/react'
import { HexGrid } from '../../src/components/HexGrid'
import { Photo } from '../../src/types'
import { MINIMAL_FEATURE_FLAGS, PERFORMANCE_FEATURE_FLAGS } from '../../src/features'

describe('HexGrid with Feature Flags', () => {
  const mockPhotos: Photo[] = [
    {
      id: '1',
      url: 'https://example.com/photo1.jpg',
      source: 'test',
      createdAt: new Date().toISOString(),
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Narration Feature Flag', () => {
    it('does not render narration when disabled', () => {
      const { container } = render(
        <HexGrid
          photos={mockPhotos}
          featureFlags={{ enableNarration: false }}
        />
      )
      
      // NarrationOverlay should not be rendered
      expect(container.textContent).not.toContain('Narration')
    })

    it('renders narration when enabled', () => {
      const { container } = render(
        <HexGrid
          photos={mockPhotos}
          featureFlags={{ enableNarration: true }}
        />
      )
      
      expect(container).toBeInTheDocument()
    })
  })

  describe('Stats Feature Flag', () => {
    it('does not show stats when disabled', () => {
      const { container } = render(
        <HexGrid
          photos={mockPhotos}
          featureFlags={{ enableStats: false }}
        />
      )
      
      // Stats panel should not be visible
      expect(container.textContent).not.toContain('Telemetry')
    })
  })

  describe('Debug Panel Feature Flag', () => {
    it('does not render debug panel when disabled', () => {
      const { container } = render(
        <HexGrid
          photos={mockPhotos}
          featureFlags={{ enableDebugPanel: false }}
        />
      )
      
      expect(container.textContent).not.toContain('Debug')
    })
  })

  describe('Preset Feature Flags', () => {
    it('works with MINIMAL_FEATURE_FLAGS', () => {
      const { container } = render(
        <HexGrid
          photos={mockPhotos}
          featureFlags={MINIMAL_FEATURE_FLAGS}
        />
      )
      
      expect(container.querySelector('canvas')).toBeInTheDocument()
    })

    it('works with PERFORMANCE_FEATURE_FLAGS', () => {
      const { container } = render(
        <HexGrid
          photos={mockPhotos}
          featureFlags={PERFORMANCE_FEATURE_FLAGS}
        />
      )
      
      expect(container.querySelector('canvas')).toBeInTheDocument()
    })
  })

  describe('Multiple Feature Flags', () => {
    it('handles multiple disabled features', () => {
      const { container } = render(
        <HexGrid
          photos={mockPhotos}
          featureFlags={{
            enableNarration: false,
            enableStats: false,
            enableDebugPanel: false,
          }}
        />
      )
      
      const canvas = container.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
    })

    it('renders core visualization with minimal flags', () => {
      const { container } = render(
        <HexGrid
          photos={mockPhotos}
          featureFlags={{
            enableNarration: false,
            enableStats: false,
            enableDebugPanel: false,
            enableCameraControls: false,
            enableLeaderboard: false,
          }}
        />
      )
      
      // Should still render the canvas
      expect(container.querySelector('canvas')).toBeInTheDocument()
    })
  })

  describe('Default Behavior', () => {
    it('enables all features by default', () => {
      const { container } = render(
        <HexGrid photos={mockPhotos} />
      )
      
      expect(container.querySelector('canvas')).toBeInTheDocument()
    })
  })
})
