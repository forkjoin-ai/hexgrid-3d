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
