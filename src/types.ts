/**
 * Type definitions for HexGrid Visualization
 */

import type { RefObject } from 'react';
import type { HexGridFeatureFlags } from './features';

/**
 * Photo type for HexGrid visualization
 *
 * This is the unified Photo type used throughout the hexgrid-3d package.
 * It includes all fields needed for display, media playback, and analytics.
 */
export interface Photo {
  id: string;
  title: string;

  // Image URLs - imageUrl is primary, url is for backward compatibility
  imageUrl: string;
  url?: string; // Alias for imageUrl (backward compatibility)
  thumbnailUrl?: string;

  // Display metadata
  alt: string;
  category: string;
  description?: string;

  // Source information
  source: string;
  sourceUrl?: string;
  createdAt?: string;

  // Shop integration
  shopUrl?: string;
  location?: string;

  // Media type flags
  isVideo?: boolean;
  videoUrl?: string;
  isTweet?: boolean;
  tweetUrl?: string;
  redditUrl?: string;
  durationSeconds?: number;

  // Competition/ranking system
  velocity?: number; // Normalized velocity [0.1, 1.0] for meritocratic competition

  // User info
  userId?: string;
  username?: string;
  platform?: string;
  author?: string;
  authorUrl?: string;

  // Metrics for analytics
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  upvotes?: number;
  retweets?: number;
  replies?: number;
  age_in_hours?: number;

  // Visual
  dominantColor?: string;
}

/**
 * Generic item that can represent any data object in the grid
 * Extends Photo for backward compatibility while adding generic data support
 */
export interface GridItem<T = unknown> {
  // Core identification
  id: string;
  type: string; // 'photo' | 'note' | 'emotion' | 'ontology-entity' | 'custom'

  // Visual representation (optional - allows non-visual items)
  imageUrl?: string;
  thumbnailUrl?: string;
  videoUrl?: string;

  // Display metadata
  title?: string;
  alt?: string;
  description?: string;
  category?: string;

  // Embedded data object (preserves original type)
  data?: T;

  // Ontology metadata (optional, for ontology-aware items)
  ontologyMetadata?: {
    entityId?: string;
    entityType?: string | string[];
    properties?: Record<string, unknown>;
    provenance?: {
      source: string;
      extractedAt: string;
      confidence: number;
    };
  };

  // Grid behavior
  velocity?: number;
  source?: string;
  sourceUrl?: string;
  createdAt?: string;

  // Metrics (flexible for any data type)
  metrics?: Record<string, number>;

  // Legacy Photo fields (for backward compatibility)
  url?: string; // Maps to imageUrl
  userId?: string;
  username?: string;
  platform?: string;
  author?: string;
  authorUrl?: string;
  likes?: number;
  views?: number;
  comments?: number;
  dominantColor?: string;
}

export interface HexGridProps {
  photos: Photo[];
  onHexClick?: (photo: Photo) => void;
  spacing?: number;
  canvasRef?: RefObject<HTMLCanvasElement>;
  onLeaderboardUpdate?: (leaderboard: any) => void;
  autoplayQueueLimit?: number;
  onAutoplayQueueLimitChange?: (limit: number) => void;
  modalOpen?: boolean;
  userId?: string;
  username?: string;
  featureFlags?: HexGridFeatureFlags;
  enableEnhanced?: boolean;
  enhancedConfig?: {
    useWasm?: boolean;
    enableParticles?: boolean;
    enableFlowField?: boolean;
  };
  onTerritoryEvent?: (event: {
    type: 'conquest' | 'birth' | 'death';
    toOwner: number;
    fromOwner?: number;
  }) => Promise<void>;
}

export interface UIState {
  debugOpen: boolean;
  showStats: boolean;
  cameraOpen: boolean;
  showNarration: boolean;
}

export interface WorkerDebug {
  curveUDeg: number;
  curveVDeg: number;
  batchPerFrame: number;
  [key: string]: any;
}
