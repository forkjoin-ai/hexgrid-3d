/**
 * Type definitions for HexGrid Visualization
 */

import type { RefObject } from 'react'
import type { HexGridFeatureFlags } from './features'

export interface Photo {
  id: string
  url: string
  thumbnailUrl?: string
  title?: string
  description?: string
  source: string
  createdAt: string
  userId?: string
  username?: string
  videoUrl?: string
  platform?: string
  author?: string
  authorUrl?: string
  likes?: number
  views?: number
  comments?: number
  dominantColor?: string
}

/**
 * Generic item that can represent any data object in the grid
 * Extends Photo for backward compatibility while adding generic data support
 */
export interface GridItem<T = unknown> {
  // Core identification
  id: string
  type: string // 'photo' | 'note' | 'emotion' | 'ontology-entity' | 'custom'

  // Visual representation (optional - allows non-visual items)
  imageUrl?: string
  thumbnailUrl?: string
  videoUrl?: string

  // Display metadata
  title?: string
  alt?: string
  description?: string
  category?: string

  // Embedded data object (preserves original type)
  data?: T

  // Ontology metadata (optional, for ontology-aware items)
  ontologyMetadata?: {
    entityId?: string
    entityType?: string | string[]
    properties?: Record<string, unknown>
    provenance?: {
      source: string
      extractedAt: string
      confidence: number
    }
  }

  // Grid behavior
  velocity?: number
  source?: string
  sourceUrl?: string
  createdAt?: string

  // Metrics (flexible for any data type)
  metrics?: Record<string, number>

  // Legacy Photo fields (for backward compatibility)
  url?: string // Maps to imageUrl
  userId?: string
  username?: string
  platform?: string
  author?: string
  authorUrl?: string
  likes?: number
  views?: number
  comments?: number
  dominantColor?: string
}

export interface HexGridProps {
  photos: Photo[]
  onHexClick?: (photo: Photo) => void
  spacing?: number
  canvasRef?: RefObject<HTMLCanvasElement>
  onLeaderboardUpdate?: (leaderboard: any) => void
  autoplayQueueLimit?: number
  onAutoplayQueueLimitChange?: (limit: number) => void
  modalOpen?: boolean
  userId?: string
  username?: string
  featureFlags?: HexGridFeatureFlags
}

export interface UIState {
  debugOpen: boolean
  showStats: boolean
  cameraOpen: boolean
  showNarration: boolean
}

export interface WorkerDebug {
  curveUDeg: number
  curveVDeg: number
  batchPerFrame: number
  [key: string]: any
}
