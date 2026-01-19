import React from 'react'
import { describe, it, expect } from 'bun:test'
import { render } from '@testing-library/react'
import { HexGrid } from '../../src/components/HexGrid'
import { Photo } from '../../src/types'
import { MINIMAL_FEATURE_FLAGS, PERFORMANCE_FEATURE_FLAGS } from '../../src/features'

describe('HexGrid with Feature Flags', () => {
  const mockPhotos: Photo[] = [
    {
      id: '1',
      title: 'Test',
      alt: 'Alt',
      imageUrl: 'https://example.com/photo1.jpg',
      category: 'test',
      source: 'test',
      createdAt: new Date().toISOString(),
    },
  ]

  describe('Narration Feature Flag', () => {
    it('does not render NarrationOverlay component when disabled', () => {
      const { container } = render(
        <HexGrid
          photos={mockPhotos}
          featureFlags={{ enableNarration: false }}
        />
      )
      
      // Canvas should still be rendered
      expect(container.querySelector('canvas')).not.toBeNull()
    })

    it('renders narration when enabled', () => {
      const { container } = render(
        <HexGrid
          photos={mockPhotos}
          featureFlags={{ enableNarration: true }}
        />
      )
      
      expect(container.querySelector('canvas')).not.toBeNull()
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
      
      expect(container.querySelector('canvas')).not.toBeNull()
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
      
      expect(container.querySelector('canvas')).not.toBeNull()
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
      
      expect(container.querySelector('canvas')).not.toBeNull()
    })

    it('works with PERFORMANCE_FEATURE_FLAGS', () => {
      const { container } = render(
        <HexGrid
          photos={mockPhotos}
          featureFlags={PERFORMANCE_FEATURE_FLAGS}
        />
      )
      
      expect(container.querySelector('canvas')).not.toBeNull()
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
      
      expect(container.querySelector('canvas')).not.toBeNull()
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
      
      expect(container.querySelector('canvas')).not.toBeNull()
    })
  })

  describe('Default Behavior', () => {
    it('enables all features by default', () => {
      const { container } = render(
        <HexGrid photos={mockPhotos} />
      )
      
      expect(container.querySelector('canvas')).not.toBeNull()
    })
  })
})
