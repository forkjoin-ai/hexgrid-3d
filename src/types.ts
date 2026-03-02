/**
 * Type definitions for HexGrid Visualization
 */

import type { RefObject } from 'react';
import type { HexGridFeatureFlags } from './features';
export type { HexGridFeatureFlags } from './features';

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

// ---------------------------------------------------------------------------
// Game Piece & GameSphere types
// ---------------------------------------------------------------------------

/** Built-in 3D primitive shapes for game pieces */
export type PieceShape =
  | 'sphere'
  | 'cube'
  | 'cone'
  | 'cylinder'
  | 'pyramid'
  | 'torus'
  | 'ring'
  | 'flag'
  | 'star'
  | 'diamond'
  | 'capsule'
  | 'octahedron'
  | 'dodecahedron'
  | 'icosahedron';

/** Animation presets that can be applied to game pieces */
export type PieceAnimation =
  | 'none'
  | 'spin'
  | 'bob'
  | 'pulse'
  | 'wobble'
  | 'orbit'
  | 'glow';

/** Animation configuration */
export interface PieceAnimationConfig {
  type: PieceAnimation;
  speed?: number;       // Multiplier (default 1.0)
  amplitude?: number;   // Multiplier (default 1.0)
  axis?: [number, number, number]; // For spin/orbit — axis of rotation
  phase?: number;       // Starting phase offset [0, 2π]
}

/**
 * A game piece placed on a hex cell.
 *
 * Supports three rendering modes:
 * 1. **Primitive shape** — set `shape` to a PieceShape string.
 * 2. **Custom Three.js Object3D** — set `object3D` to any Object3D instance.
 *    The renderer will clone it and place it on the hex surface.
 * 3. **GLTF/GLB model URL** — set `modelUrl` to a URL pointing to a .glb/.gltf.
 *    The renderer loads it asynchronously and caches the geometry.
 */
export interface GamePiece {
  id: string;

  // --- Appearance (pick one) ---
  shape?: PieceShape;
  /** Arbitrary Three.js Object3D (mesh, group, sprite, etc.) */
  object3D?: unknown;   // typed as unknown to avoid hard Three.js dep at type level; cast to Object3D at runtime
  /** URL to a .glb / .gltf model */
  modelUrl?: string;

  // --- Visual properties ---
  color?: string;                // CSS color string — applied as MeshStandardMaterial color
  emissive?: string;             // Emissive glow color
  emissiveIntensity?: number;    // 0-1 (default 0)
  opacity?: number;              // 0-1 (default 1)
  metalness?: number;            // 0-1 (default 0.1)
  roughness?: number;            // 0-1 (default 0.6)
  wireframe?: boolean;

  // --- Transform ---
  scale?: number | [number, number, number];  // Uniform or per-axis
  offsetY?: number;                           // Height above hex surface (default 0)
  rotationY?: number;                         // Y-axis rotation in radians

  // --- Animation ---
  animation?: PieceAnimation | PieceAnimationConfig;

  // --- Metadata ---
  label?: string;           // Text rendered above the piece (billboarded)
  labelColor?: string;
  tooltip?: string;         // Shown on hover
  count?: number;           // For stackable pieces (e.g. army count) — renders as badge or stacked copies
  stackStyle?: 'badge' | 'stack' | 'ring'; // How to display count > 1

  // --- Interaction ---
  interactive?: boolean;    // Default true — can be clicked/hovered
  draggable?: boolean;      // Can be drag-and-dropped between cells

  // --- Grouping ---
  layer?: number;           // Z-order layer for multiple pieces on same cell (default 0)
  group?: string;           // Logical group name (e.g. 'armies', 'buildings')
}

/** Fog of war visibility levels */
export type FogLevel = 'visible' | 'explored' | 'dim' | 'hidden';

/** Cell highlight modes */
export type CellHighlight =
  | 'none'
  | 'selected'
  | 'hover'
  | 'attack-target'
  | 'move-target'
  | 'great-circle'
  | 'path'
  | 'danger'
  | 'friendly'
  | 'contested'
  | string; // extensible

/** Border style for cell outlines */
export interface CellBorder {
  color: string;
  width?: number;       // Default 1
  style?: 'solid' | 'dashed' | 'glow' | 'pulse';
  emissive?: boolean;   // Glow effect on border
}

/**
 * Complete game state for a single cell on the sphere.
 * Pass a `Map<number, CellGameState>` to GameSphere to overlay game state on the geodesic grid.
 */
export interface CellGameState {
  // --- Ownership ---
  ownerId?: string;
  ownerColor?: string;        // Cell fill color (blended with base)
  ownerColorIntensity?: number; // 0-1 blend with base hex color (default 0.7)

  // --- Pieces on this cell ---
  pieces?: GamePiece[];

  // --- Fog of war ---
  fogLevel?: FogLevel;

  // --- Highlights ---
  highlight?: CellHighlight;
  highlightColor?: string;     // Override highlight color
  highlightIntensity?: number; // 0-1

  // --- Border ---
  border?: CellBorder;

  // --- Terrain overlay ---
  terrainType?: string;        // Extensible terrain key (games define their own)
  terrainColor?: string;

  // --- Label on the cell surface ---
  cellLabel?: string;
  cellLabelColor?: string;
  cellLabelSize?: number;

  // --- Elevation (3D height above sphere surface) ---
  elevation?: number;          // 0 = flush, positive = raised plateau

  // --- Pentagon / special cell flag ---
  isPentagon?: boolean;

  // --- Arbitrary data for game-specific logic ---
  data?: Record<string, unknown>;
}

/**
 * Configuration for the GameSphere's visual appearance.
 */
export interface GameSphereConfig {
  // --- Sphere geometry ---
  subdivisions?: number;        // GeodesicHexGrid subdivisions (default 3 → ~92 cells)
  sphereRadius?: number;        // World-space radius (default 5)

  // --- Camera ---
  cameraDistance?: number;       // Distance from center (default 12)
  cameraFov?: number;           // Field of view degrees (default 50)
  enableOrbitControls?: boolean; // Allow mouse/touch orbit (default true)
  autoRotate?: boolean;          // Idle rotation (default false)
  autoRotateSpeed?: number;      // Degrees per second

  // --- Lighting ---
  ambientLightIntensity?: number;     // Default 0.4
  directionalLightIntensity?: number; // Default 0.8
  directionalLightPosition?: [number, number, number]; // Default [5, 10, 7]

  // --- Hex cell rendering ---
  hexBaseColor?: string;         // Default '#1a1a2e'
  hexBorderColor?: string;       // Default '#333355'
  hexBorderWidth?: number;       // Default 0.02
  pentagonBaseColor?: string;    // Default '#2a1a3e' (distinct from hex)
  pentagonBorderColor?: string;  // Default '#553377'

  // --- Fog of war ---
  fogDimColor?: string;          // Color for 'dim' cells (default 'rgba(0,0,0,0.5)')
  fogHiddenColor?: string;       // Color for 'hidden' cells (default 'rgba(0,0,0,0.85)')
  fogExploredColor?: string;     // Color for 'explored' cells (default 'rgba(0,0,0,0.3)')

  // --- Game piece defaults ---
  defaultPieceScale?: number;    // Default 0.3
  defaultPieceColor?: string;    // Default '#ffffff'

  // --- Interaction ---
  enableRaycasting?: boolean;    // Click/hover detection (default true)
  enableDragDrop?: boolean;      // Piece drag-and-drop (default false)
  hoverHighlightColor?: string;  // Default '#ffffff33'

  // --- Post-processing ---
  enableBloom?: boolean;         // Glow effect for emissive materials (default false)
  enableShadows?: boolean;       // Shadow mapping (default false)
  enableAntialias?: boolean;     // MSAA (default true)

  // --- Performance ---
  enableInstancing?: boolean;    // Instance identical pieces (default true)
  maxVisiblePieces?: number;     // LOD culling limit (default 500)
  pixelRatio?: number;           // Canvas resolution scale (default devicePixelRatio)
}

/**
 * Events emitted by the GameSphere component.
 */
export interface GameSphereEvents {
  /** Cell was clicked */
  onCellClick?: (cellIndex: number, event: { shiftKey: boolean; ctrlKey: boolean }) => void;
  /** Cell hover entered */
  onCellHover?: (cellIndex: number | null) => void;
  /** A piece was clicked */
  onPieceClick?: (cellIndex: number, piece: GamePiece) => void;
  /** A piece was dragged from one cell to another */
  onPieceDrop?: (fromCell: number, toCell: number, piece: GamePiece) => void;
  /** Camera moved (for syncing external UI) */
  onCameraChange?: (position: [number, number, number], target: [number, number, number]) => void;
  /** Render frame callback (for custom overlays) */
  onFrame?: (deltaTime: number) => void;
}

/**
 * Props for the GameSphere component — the 3D board game renderer.
 */
export interface GameSphereProps {
  /** Game state per cell. Key = cell index from GeodesicHexGrid. */
  cellGameState?: Map<number, CellGameState>;

  /** Visual and behavior configuration */
  config?: GameSphereConfig;

  /** Event callbacks */
  events?: GameSphereEvents;

  /** Width of the canvas (default '100%') */
  width?: number | string;
  /** Height of the canvas (default '100%') */
  height?: number | string;

  /** CSS class for the container */
  className?: string;
  /** Inline styles for the container */
  style?: React.CSSProperties;

  /** Optional ref to the Three.js renderer for external access */
  rendererRef?: RefObject<unknown>;

  /** Optional ref to the Three.js scene for injecting custom objects */
  sceneRef?: RefObject<unknown>;

  /** Pauses rendering when true (e.g. modal open) */
  paused?: boolean;

  /** Children rendered as React overlay on top of the canvas */
  children?: React.ReactNode;
}
