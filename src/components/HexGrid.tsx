import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { TextureLoader } from '@a0n/aeon-3d/three'
import * as THREE from '@a0n/aeon-3d/three'
import uiStore from '../stores/uiStore'
import { StatsTracker } from '../lib/stats-tracker'
import { NarrationEngine, NarrationMessage } from '../lib/narration'
import { NarrationOverlay } from './NarrationOverlay'
import { PoolStatsOverlay } from './debug/PoolStatsOverlay'
import { logger } from '../lib/logger'
import { setCustomAccentColor, clearCustomAccentColor, getCurrentAccentHex, getAccentColor, getAccentRgba } from '../lib/theme-colors'
import { decodeHTMLEntities } from '../lib/html-utils'
import { getProxiedImageUrl } from '../utils/image-utils'
import type { GridItem, Photo } from '../types'
import { gridItemToPhoto } from '../compat'

// Re-export Photo type for external consumers
export type { Photo }

// Fallback no-op logger at module scope (unused - component-level dlog is used instead)
// Kept for backward compatibility but renamed to avoid shadowing confusion
const noopLog = (..._args: any[]) => {}

// Global browser memory image cache keyed by imageUrl to prevent duplicate loads
// This is especially important for Reddit images where multiple hexes may use the same image
const globalImageCache = new Map<string, HTMLImageElement>()
const imageLoadPromises = new Map<string, Promise<HTMLImageElement>>()

export interface HexGridProps<T = unknown> {
  // Accept both legacy Photo[] and new GridItem[]
  items?: GridItem<T>[]
  photos?: Photo[] // Legacy support
  
  // Type-safe item handlers
  onItemClick?: (item: GridItem<T>) => void
  onHexClick?: (photo: Photo) => void // Legacy support
  
  spacing?: number
  canvasRef?: React.RefObject<HTMLCanvasElement>
  onLeaderboardUpdate?: (leaderboard: Array<{ photoId: string; territory: number; position: number }>) => void
  autoplayQueueLimit?: number
  onAutoplayQueueLimitChange?: (limit: number) => void
  modalOpen?: boolean // Pause evolution when a single item is in view
  userId?: string // User ID for saving/loading settings from Firestore
  username?: string // Username for loading channel settings
}

export interface Infection {
  photo: Photo
  gridPosition: [number, number] // Position in the image grid (col, row)
  infectionTime: number // When this hexagon was infected
  generation: number // How many steps from the origin
  uvBounds: [number, number, number, number] // [minU, minV, maxU, maxV] for the entire infection cluster
  scale: number // Size scale of this infection (affects coverage area)
  growthRate: number // How fast this infection grows
  tilesX: number // Number of tiles in X direction
  tilesY: number // Number of tiles in Y direction
}

// Infection system state interface
interface InfectionSystemState {
  infections: Map<number, Infection>
  availableIndices: number[]
  lastEvolutionTime: number
  generation: number
}

// Worker debug configuration type
interface WorkerDebug {
  evolutionEnabled: boolean
  miniLogGenerations: number
  spawnEnabled: boolean
  spawnRateMultiplier: number
  spawnClusterMax: number
  deathCapPercent: number
  reproThreshold3: number
  reproChance3: number
  reproChance2: number
  reproChance1: number
  reproChance0: number
  reproPriorityMultiplier3: number
  // Per-deficit boost applied when samePhotoNeighbors < 2. Multiplied per deficit step.
  sameNeighborBoostPerDeficit?: number
  sheenEnabled: boolean
  sheenSpeed: number
  sheenIntensity: number
  scratchEnabled: boolean
  translucencySmoothing: number
  streamMs: number
  evolveIntervalMs: number
  batchPerFrame: number
  gridScale: number
  tileSize: number
  hexSpacing: number
  sphericalDensity: number
  curveUDeg: number
  curveVDeg: number
  poleScaleEnabled: boolean
  poleMinScale: number
  polePower: number
  renderBothSides: boolean
  debugLogs: boolean
  // Cluster tiling / seam-blending options (added to match worker-side flags)
  clusterPreserveAspect?: boolean
  clusterDynamicTiling?: boolean
  clusterAnchor?: 'center' | 'min'
  clusterGlobalAlign?: boolean
  clusterUvInset?: number
  clusterJitter?: number
  showTileLabels?: boolean
  clusterAdjacency?: 'rect' | 'hex'
  clusterFillMode?: 'contain' | 'cover'
  clusterMaxTiles?: number
  clusterScanMode?: 'row' | 'serpentine'
  clusterParityAware?: boolean
  showTileCenters?: boolean
  clusterHexLattice?: boolean
  clusterParityUvShift?: boolean
  // Autodisplay tuning (seconds)
  intermissionDurationSec?: number
  photoDurationSec?: number
  // Idle rotation tuning (UI-controlled)
  idleRotationDelayMs?: number
  idleRotationDegPerSec?: number
  idleRotationEnabled?: boolean
}

/**
 * Accent Color Picker Component for Debug Panel
 */
const AccentColorPicker: React.FC = () => {
  const [currentColor, setCurrentColor] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('theme.accentColor')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed?.hex) {
            return parsed.hex
          }
        }
      } catch (e) {
        // ignore
      }
    }
    return getCurrentAccentHex()
  })

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value
    setCurrentColor(newColor)
    setCustomAccentColor(newColor)
  }

  const handleReset = () => {
    clearCustomAccentColor()
    const systemColor = getAccentColor()
    setCurrentColor(systemColor.hex)
  }

  const hasCustomColor = () => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem('theme.accentColor') !== null
    } catch {
      return false
    }
  }

  return (
    <div style={{ marginBottom: 12, padding: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }}>
      <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>Accent Color</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <input
          type="color"
          value={currentColor}
          onChange={handleColorChange}
          style={{
            width: 40,
            height: 40,
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 4,
            cursor: 'pointer',
            background: 'transparent'
          }}
          title="Pick accent color"
        />
        <input
          type="text"
          value={currentColor}
          onChange={(e) => {
            const val = e.target.value
            setCurrentColor(val)
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
              setCustomAccentColor(val)
            }
          }}
          style={{
            flex: 1,
            padding: '4px 8px',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 4,
            color: '#fff',
            fontSize: 12,
            fontFamily: 'monospace'
          }}
          placeholder="#6b7280"
          pattern="^#[0-9A-Fa-f]{6}$"
        />
        {hasCustomColor() && (
          <button
            onClick={handleReset}
            style={{
              padding: '4px 8px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 4,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 11
            }}
            title="Reset to system default"
          >
            Reset
          </button>
        )}
      </div>
      <div style={{ fontSize: 11, color: '#999' }}>
        {hasCustomColor() 
          ? 'Custom color active (overrides system setting)'
          : 'Using system default color'}
      </div>
    </div>
  )
}

export const HexGrid = <T = unknown>({ 
  items, 
  photos: photosProp, 
  onItemClick, 
  onHexClick, 
  spacing = 1.0, 
  canvasRef: externalCanvasRef, 
  onLeaderboardUpdate, 
  autoplayQueueLimit, 
  onAutoplayQueueLimitChange, 
  modalOpen = false, 
  userId, 
  username 
}: HexGridProps<T>) => {
  // Normalize inputs: convert items to photos for internal use, or use photos directly
  const photos = useMemo(() => {
    if (items && items.length > 0) {
      // Convert GridItems to Photos for internal processing
      return items.map(item => {
        // Try to extract Photo from GridItem
        const photo = gridItemToPhoto(item as GridItem<Photo>)
        if (photo) {
          return photo
        }
        // Fallback: construct Photo from GridItem fields
        return {
          id: item.id,
          url: item.imageUrl || item.url || '',
          thumbnailUrl: item.thumbnailUrl,
          title: item.title || '',
          alt: item.alt || item.title || '',
          imageUrl: item.imageUrl || item.url || '',
          category: item.category || 'unknown',
          description: item.description,
          source: item.source || 'unknown',
          createdAt: item.createdAt || new Date().toISOString(),
          velocity: item.velocity,
          sourceUrl: item.sourceUrl,
          views: item.views,
          likes: item.likes,
          comments: item.comments,
          videoUrl: item.videoUrl,
          userId: item.userId,
          username: item.username,
          platform: item.platform,
          author: item.author,
          authorUrl: item.authorUrl,
          dominantColor: item.dominantColor,
        } as Photo
      })
    }
    return photosProp || []
  }, [items, photosProp])

  // Enhanced click handler that supports both items and photos
  const handleHexClick = useCallback((photo: Photo) => {
    // Call legacy handler if provided
    if (onHexClick) {
      onHexClick(photo)
    }
    
    // If items are provided, find the corresponding item and call onItemClick
    if (items && items.length > 0 && onItemClick) {
      const item = items.find(i => i.id === photo.id)
      if (item) {
        onItemClick(item)
      }
    }
  }, [items, onHexClick, onItemClick])

  const internalCanvasRef = useRef<HTMLCanvasElement>(null)
  const canvasRef = externalCanvasRef || internalCanvasRef
  const workerRef = useRef<Worker | null>(null)
  // Stream control refs to coordinate long-running UI streaming from worker
  const streamTokenRef = useRef(0)
  const streamActiveRef = useRef(false)
  const streamTouchesOccupancyRef = useRef(false)
    // Reactive state for telemetry overlay (mirrors streamActiveRef)
    const [streamingActive, setStreamingActive] = useState(false)
    // How many tiles remain to stream in the current streaming run
    const [tilesRemaining, setTilesRemaining] = useState(0)
    // Max crowd toggle state and storage for previous debug settings
    const [maxCrowdActive, setMaxCrowdActive] = useState(false)
    const prevDebugRef = useRef<WorkerDebug | null>(null)
  const [textures, setTextures] = useState<Map<string, HTMLImageElement>>(new Map())
  // Sheen animation time (drives a subtle moving highlight)
  const sheenRef = useRef(0)
  // Pre-generate a tiny scratch noise canvas used as overlay
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null)
  
  // Viewport dimension tracking for 2D mode
  const [viewportDimensions, setViewportDimensions] = useState<{ width: number; height: number }>(() => {
    // Initialize with default dimensions as fallback
    if (typeof window !== 'undefined') {
      return { width: window.innerWidth, height: window.innerHeight }
    }
    return { width: 1200, height: 800 }
  })
  
  // Track viewport dimensions with debounced resize handler
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const updateDimensions = () => {
      setViewportDimensions({ width: window.innerWidth, height: window.innerHeight })
    }
    
    // Initial update
    updateDimensions()
    
    // Debounce resize events to avoid excessive recalculations
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(updateDimensions, 150) // 150ms debounce
    }
    
    // Listen for window resize
    window.addEventListener('resize', handleResize)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      if (resizeTimeout) clearTimeout(resizeTimeout)
    }
  }, [])
  
  // Default dimensions for 3D mode or fallback
  const defaultScreenWidth = 1200
  const defaultScreenHeight = 800
  
  const defaultHexRadius = 15       // Smaller for 2D performance

  // Calculate how many hexagons fit. Allow debug override via workerDebug.gridScale and tileSize
  // layout calculation moved below after workerDebug is declared to avoid
  // using workerDebug before its initialization (see later useMemo).
  
  // Initialize infection system state lazily after hexPositions is computed
  const [infectionState, setInfectionState] = useState<InfectionSystemState>(() => ({
    infections: new Map<number, Infection>(),
    availableIndices: [],
    lastEvolutionTime: 0,
    generation: 0
  }))

  // Tile centers for debug visualization (received from worker when showTileCenters is enabled)
  const [tileCenters, setTileCenters] = useState<Array<{ photoId: string; clusterIndex: number; centers: Array<{ x: number; y: number; col: number; row: number }> }>>([])

  // Narration system
  const statsTrackerRef = useRef<StatsTracker | null>(null)
  const narrationEngineRef = useRef<NarrationEngine | null>(null)
  const [narrationMessages, setNarrationMessages] = useState<NarrationMessage[]>([])
  const [showNarration, setShowNarration] = useState(false)

  // Subscribe once to uiStore for narration visibility.
  // Avoid writing back to uiStore from this component to prevent
  // a ping-pong (subscribe -> setState -> effect -> uiStore.set -> subscribe) that
  // can cause a flashy/flickering UX when toggling the panel quickly.
  useEffect(() => {
    const unsub = uiStore.subscribe((s) => {
      if (s.showNarration !== undefined) {
        setShowNarration(!!s.showNarration)
      }
    })
    return () => { void unsub() }
  }, [])

  // Initialize narration system
  useEffect(() => {
    if (!statsTrackerRef.current) {
      statsTrackerRef.current = new StatsTracker()
      // Load persisted state from localStorage
      try {
        const saved = localStorage.getItem('automata-stats')
        if (saved) {
          statsTrackerRef.current.importState(saved)
        }
      } catch (e) {
        logger.warn('Failed to load stats from localStorage:', e)
      }
    }
    if (!narrationEngineRef.current) {
      narrationEngineRef.current = new NarrationEngine(statsTrackerRef.current)
    }
  }, [])

  // Worker debug options (editable at runtime)
  const [workerDebug, setWorkerDebug] = useState<WorkerDebug>(() => {
    const defaultDebug = {
      evolutionEnabled: true,  // master toggle for evolution system
      miniLogGenerations: 40, // more verbose by default for debugging
      spawnEnabled: true,      // enable controlled spawning
      spawnRateMultiplier: 2.2, // more aggressive spawn rates to encourage spread
      spawnClusterMax: 8, // larger debug-triggered spawns by default
      deathCapPercent: 5,      // percent cap for deaths per generation (informative)
    // Reproduction tuning (live editable)
    reproThreshold3: 3, // number of infected neighbors considered '3+'
    reproChance3: 0.995,
    reproChance2: 0.9,
    reproChance1: 0.75,
    reproChance0: 0.25,
  reproPriorityMultiplier3: 4.0,
  // boost applied per deficit step (0=>no boost). Example: 0.35 means
  // samePhotoNeighbors==0 -> boost = 1 + 0.35*2 = 1.7
  sameNeighborBoostPerDeficit: 0.35,
      // Glass/sheens
      sheenEnabled: true,
      sheenSpeed: 8, // slightly faster sheen loop
      sheenIntensity: 0.14, // slightly stronger sheen
      scratchEnabled: true,
      translucencySmoothing: 0.12, // faster lerp for snappier translucency
    // streamMs controls how many milliseconds between each tile update when streaming changes
    // 0 = immediate (fast fill)
    streamMs: 0,
      // evolveIntervalMs controls how often the main thread posts evolve messages (ms)
      evolveIntervalMs: 60000,
      // batchPerFrame controls how many tiles to apply per requestAnimationFrame (0 = per-tile delay mode)
      batchPerFrame: 8,
    // gridScale >1 reduces effective hex radius (more hexes), <1 increases radius (fewer hexes)
    gridScale: 1,
      // tileSize: base hex radius in pixels (editable)
      tileSize: 8,
      // hexSpacing: multiplier for hex size (1.0 = perfect touching, <1.0 = gaps, >1.0 = overlap)
      hexSpacing: 0.95,
      // sphericalDensity: multiplier for spherical grid density (1.0 = default, >1.0 = more hexes)
      sphericalDensity: 1.4,
      // curvature controls (degrees) - start with a visually pleasing curvature
  curveUDeg: 180,
  curveVDeg: 45,
  // Idle rotation tuning (UI-editable)
  idleRotationDelayMs: 3500,
  idleRotationDegPerSec: 6,
  idleRotationEnabled: true,
      // Pole-scaling: shrink hexes near the poles to avoid overlap when wrapping
      poleScaleEnabled: true,
      // Minimum scale applied at the poles (0..1)
      poleMinScale: 0.25,
      // Exponent to control falloff of scaling based on |cos(lat)| (0..2)
      polePower: 0.9,
      // Render both sides option: when true, draw an antipodal copy so images show on inside/outside
      renderBothSides: false,
      // Worker debug logs (disabled by default for performance)
      debugLogs: false
    ,
      // Cluster tiling defaults: preserve aspect, center anchor, no global alignment,
      // zero uv inset for perfect alignment (seam blending handled separately), no jitter by default
      clusterPreserveAspect: true,
      clusterDynamicTiling: true,
      clusterAnchor: 'center' as 'center' | 'min',
      clusterGlobalAlign: false,
      clusterUvInset: 0.0,  // Set to 0 for seamless alignment
      clusterJitter: 0.0
      ,
      // UI-only debug helpers
      showTileLabels: false,
      showTileCenters: false
      ,
      clusterAdjacency: 'rect' as 'rect' | 'hex',
      clusterFillMode: 'contain' as 'contain' | 'cover',
      clusterMaxTiles: 64
      ,
      clusterScanMode: 'row' as 'row' | 'serpentine',
      clusterParityAware: true,
      clusterHexLattice: false,
      clusterParityUvShift: false
    }
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem('hexgrid.workerDebug')
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed && typeof parsed === 'object') {
            // User has saved preferences - respect them (don't override)
            return { ...defaultDebug, ...parsed }
          }
        } else {
          // No saved preferences - apply mobile defaults if on mobile
          const isMobile = window.innerWidth < 768
          if (isMobile) {
            // Mobile: default to 2D layout (flat grid) with larger hexes for better performance
            return { 
              ...defaultDebug, 
              curveUDeg: 0, 
              curveVDeg: 0,
              // Increase tileSize to reduce grid density on mobile for better performance
              // Larger hexes = fewer total hexes (default tileSize is 12, which reduces hex count for better performance)
              tileSize: 12
            }
          }
          // Desktop: keep 3D defaults (curveUDeg: 180, curveVDeg: 45)
        }
      }
    } catch (err) {
      // ignore
    }
    // Fallback: if window is undefined (SSR), return desktop defaults
    // Mobile detection will happen in useEffect on mount
    return defaultDebug
  })
  // include curvature defaults in the initial debug state
  // curveUDeg: horizontal wrap in degrees (0..360)
  // curveVDeg: vertical coverage in degrees (0..360)
  // If this component was server-rendered (Next.js), the useState initializer
  // above couldn't access localStorage. Read back persisted debug settings on
  // client mount and merge them into state+ref so Apply/reload behaves correctly.
  // Also apply mobile defaults if localStorage is empty and we're on mobile.
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const raw = window.localStorage.getItem('hexgrid.workerDebug')
      if (raw) {
        // User has saved preferences - load them
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
          setWorkerDebug((prev) => {
            const merged: WorkerDebug = { ...prev, ...parsed as Partial<WorkerDebug> }
            try { workerDebugRef.current = merged } catch (err) {}
            return merged
          })
        }
      } else {
        // No saved preferences - apply mobile defaults if on mobile
        // (This handles SSR case where useState initializer returned desktop defaults)
        const isMobile = window.innerWidth < 768
        if (isMobile) {
          setWorkerDebug((prev) => {
            // Only apply mobile defaults if curvature hasn't been set (still at desktop defaults)
            const needsMobileDefaults = prev.curveUDeg === 180 && prev.curveVDeg === 45
            if (needsMobileDefaults) {
              const mobileDefaults: Partial<WorkerDebug> = {
                curveUDeg: 0,
                curveVDeg: 0,
                // Increase tileSize to reduce grid density on mobile for better performance
                // Larger hexes = fewer total hexes (default tileSize is 6, doubling to 12 reduces hex count by ~75%)
                tileSize: 12
              }
              const merged: WorkerDebug = { ...prev, ...mobileDefaults }
              try { workerDebugRef.current = merged } catch (err) {}
              return merged
            }
            return prev
          })
        }
      }
    } catch (err) {
      // ignore localStorage/read errors
    }
  // run only once on mount
  }, [])

  // Camera controls (user-facing) and mouse-driven offsets
  const [camYawDeg, setCamYawDeg] = useState<number>(-90)
  const [camPitchDeg, setCamPitchDeg] = useState<number>(-12)
  const [camDistanceMultiplier, setCamDistanceMultiplier] = useState<number>(1.0)
  const [mouseCameraControl, setMouseCameraControl] = useState<boolean>(false)
  const camOffsetRef = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 })
  // Whether yaw should be inverted (user preference). Default false.
  const [invertYaw, setInvertYaw] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem('hexgrid.invertYaw')
        return raw === 'true'
      }
    } catch (err) {}
    return false
  })
  // Tick to notify projection logic when camOffsetRef changes (mouse-driven offsets)
  const [camOffsetTick, setCamOffsetTick] = useState<number>(0)
  // Drag rotation state (now supports 2D drag: yaw (X) and pitch (Y))
  const dragRef = useRef<{ active: boolean; startX: number; startYaw: number; lastT: number; lastX: number; vx: number; startY: number; startPitch: number; lastY: number; vy: number }>({ active: false, startX: 0, startYaw: 0, lastT: 0, lastX: 0, vx: 0, startY: 0, startPitch: 0, lastY: 0, vy: 0 })

  // Touch gesture state management
  const touchDragRef = useRef<{ active: boolean; startX: number; startY: number; startYaw: number; startPitch: number; lastX: number; lastY: number; lastT: number; vx: number; vy: number }>({ active: false, startX: 0, startY: 0, startYaw: 0, startPitch: 0, lastX: 0, lastY: 0, lastT: 0, vx: 0, vy: 0 })
  const pinchRef = useRef<{ active: boolean; initialDistance: number; initialDistanceMultiplier: number }>({ active: false, initialDistance: 0, initialDistanceMultiplier: 1.0 })
  const doubleTapRef = useRef<{ lastTapTime: number; lastTapX: number; lastTapY: number; justDoubleTapped: boolean }>({ lastTapTime: 0, lastTapX: 0, lastTapY: 0, justDoubleTapped: false })

  // Guard so we don't persist camera values until initial load/migration finished.
  const cameraInitializedRef = useRef(false)
  // Debounce timer for camera persistence so rapid mouse movement doesn't produce
  // many localStorage writes. Also keep a ref to the latest camera so we can
  // flush on unmount.
  const cameraPersistTimeoutRef = useRef<number | null>(null)
  const cameraLatestRef = useRef<{ yaw: number; pitch: number; distance: number }>({ yaw: camYawDeg, pitch: camPitchDeg, distance: camDistanceMultiplier })

  // Inside-view toggle (render from sphere center). Default to true on first run.
  const [insideView, setInsideView] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem('hexgrid.insideView')
        return raw === null ? true : raw === 'true'
      }
    } catch (err) {}
    return true
  })

  // Inside-view tuning controls: focal multiplier and yaw/pitch sensitivity
  const [insideFocal, setInsideFocal] = useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem('hexgrid.insideFocal')
        return raw === null ? 1.2 : Number(raw)
      }
    } catch (err) {}
    return 1.2
  })
  // UI state for persisted camera preview
  const [lastSavedPitch, setLastSavedPitch] = useState<number | null>(null)
  const [showRawCamera, setShowRawCamera] = useState(false)
  const [rawCameraJson, setRawCameraJson] = useState<string | null>(null)

  // On mount, read the last saved camera to populate the UI preview
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const raw = window.localStorage.getItem('hexgrid.camera')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.pitch === 'number') setLastSavedPitch(parsed.pitch)
      try { logger.debug('HexGrid: loaded hexgrid.camera on mount', parsed) } catch (err) {}
      try { setRawCameraJson(JSON.stringify(parsed, null, 2)) } catch (err) {}
    } catch (err) {}
  }, [])
  const [insideYawSens, setInsideYawSens] = useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem('hexgrid.insideYawSens')
        return raw === null ? 0.25 : Number(raw)
      }
    } catch (err) {}
    return 0.25
  })
  const [insidePitchSens, setInsidePitchSens] = useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem('hexgrid.insidePitchSens')
        return raw === null ? 1.0 : Number(raw)
      }
    } catch (err) {}
    return 1.0
  })

  // Persist insideView preference and tuners when they change
  useEffect(() => { try { if (typeof window !== 'undefined') window.localStorage.setItem('hexgrid.insideView', insideView ? 'true' : 'false') } catch (err) {} }, [insideView])
  useEffect(() => { try { if (typeof window !== 'undefined') window.localStorage.setItem('hexgrid.insideFocal', String(insideFocal)) } catch (err) {} }, [insideFocal])
  useEffect(() => { try { if (typeof window !== 'undefined') window.localStorage.setItem('hexgrid.insideYawSens', String(insideYawSens)) } catch (err) {} }, [insideYawSens])
  useEffect(() => { try { if (typeof window !== 'undefined') window.localStorage.setItem('hexgrid.insidePitchSens', String(insidePitchSens)) } catch (err) {} }, [insidePitchSens])

  // Animated yaw multiplier: 1 = full yaw, 0 = no yaw (centered). Tween when insideView toggles.
  // Default to yawMult=1 so camera yaw slider always corresponds to actual view
  const [yawMult, setYawMult] = useState<number>(1)
  // Note: We no longer automatically tween yawMult when insideView changes, because
  // that causes the camera to snap back unexpectedly. Users can manually adjust yaw.
  // The old auto-tween logic has been removed to prevent the "snap back" issue.

  // When the user manipulates the yaw slider we temporarily force yawMult=1 so the slider feels responsive,
  // then after a short idle we tween yawMult back to the insideView target (0) or 1.
  const yawRestoreTimeoutRef = useRef<number | null>(null)
  const yawRestoreRafRef = useRef<number | null>(null)

  const animateYawMultTo = useCallback((to: number, duration = 420) => {
    if (yawRestoreRafRef.current) cancelAnimationFrame(yawRestoreRafRef.current)
    const start = performance.now()
    const from = yawMult
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      setYawMult(from + (to - from) * ease)
      try { setCamOffsetTick((c) => c + 1) } catch (err) {}
      if (t < 1) yawRestoreRafRef.current = requestAnimationFrame(step)
      else yawRestoreRafRef.current = null
    }
    yawRestoreRafRef.current = requestAnimationFrame(step)
  }, [yawMult])

  // Track last user interaction time so we can start idle auto-rotation when appropriate
  const lastInteractionRef = useRef<number>(typeof performance !== 'undefined' ? performance.now() : Date.now())
  // Idle rotation configuration
  const IDLE_ROTATION_DELAY_MS = 3500 // start rotating after 3.5s of inactivity
  const IDLE_ROTATION_DEG_PER_SEC = 6 // degrees per second yaw rotation when idle

  const scheduleRestoreYawMult = useCallback(() => {
    if (yawRestoreTimeoutRef.current) window.clearTimeout(yawRestoreTimeoutRef.current)
    yawRestoreTimeoutRef.current = window.setTimeout(() => {
      const target = insideView ? 0 : 1
      animateYawMultTo(target, 420)
      yawRestoreTimeoutRef.current = null
    }, 1500)
  }, [insideView, animateYawMultTo])

  // Centralized handler for updating camera distance so all related refs/effects
  // are kept in sync. This ensures UI sliders immediately affect projection.
  const handleCamDistanceChange = useCallback((value: number) => {
    // Update React state
    setCamDistanceMultiplier(value)
    // Keep latest-camera ref in sync for persistence flushes
    try { cameraLatestRef.current = { yaw: cameraLatestRef.current.yaw ?? camYawDeg, pitch: cameraLatestRef.current.pitch ?? camPitchDeg, distance: value } } catch (err) {}
    // Notify projection helpers to recompute immediately
    try { setCamOffsetTick((c) => c + 1); cameraDirtyRef.current = true } catch (err) {}
    // mark interaction so idle rotation won't start immediately
    try { lastInteractionRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now() } catch (err) {}
  }, [camYawDeg, camPitchDeg])

  const handleYawInputChange = useCallback((value: number) => {
    // Store value inverted when the user has enabled invertYaw so stored camYawDeg
    // remains the canonical (non-display) value.
    const stored = invertYaw ? -value : value
    dlog('HexGrid: handleYawInputChange', { value, stored, invertYaw })
    setCamYawDeg(stored)
    // When user adjusts yaw slider, set yawMult to 1 and keep it there (don't restore)
    // This prevents the view from snapping back after user interaction
    setYawMult(1)
    // Clear any pending restoration so the yaw stays at the user's chosen value
    if (yawRestoreTimeoutRef.current) {
      window.clearTimeout(yawRestoreTimeoutRef.current)
      yawRestoreTimeoutRef.current = null
    }
    if (yawRestoreRafRef.current) {
      cancelAnimationFrame(yawRestoreRafRef.current)
      yawRestoreRafRef.current = null
    }
    try { setCamOffsetTick((c) => c + 1); cameraDirtyRef.current = true } catch (err) {}
    // mark interaction for idle detection
    try { lastInteractionRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now() } catch (err) {}
  }, [invertYaw])

  // Idle auto-rotation effect: gently rotate yaw when user is idle and we're in 3D mode
  useEffect(() => {
    let rafId: number | null = null
    let lastTs = typeof performance !== 'undefined' ? performance.now() : Date.now()

    const step = (now: number) => {
      try {
        // compute dt
        const t = now || (typeof performance !== 'undefined' ? performance.now() : Date.now())
        const dtMs = Math.max(0, t - lastTs)
        lastTs = t

        // conditions to run idle rotation:
        // - grid has curvature (i.e. not 2D flat)
        // - not currently dragging
        // - not interacting (mouseCameraControl off) and no modal or camera panel open
        // - not recently interacted (idle delay elapsed)
        const nowMs = t
        const lastInteraction = lastInteractionRef.current || 0
        const idleMs = nowMs - lastInteraction

        // compute local settings from workerDebugRef so runtime tweaks persist
        const dbg = workerDebugRef.current || workerDebug
        const curveUDegLocal = Number(dbg?.curveUDeg || 0)
        const curveVDegLocal = Number(dbg?.curveVDeg || 0)
        const localHasSignificantCurvature = Math.abs(curveUDegLocal) > 10 || Math.abs(curveVDegLocal) > 10
  const idleDelay = Number((dbg as any)?.idleRotationDelayMs ?? 3500)
  const idleDegPerSec = Number((dbg as any)?.idleRotationDegPerSec ?? 6)

  const enabled = Boolean((dbg as any).idleRotationEnabled ?? true)
  const shouldRotate = enabled && localHasSignificantCurvature && !dragRef.current.active && !touchDragRef.current.active && !mouseCameraControl && !modalOpen && !(cameraOpenRef && cameraOpenRef.current) && idleMs >= idleDelay

        if (shouldRotate) {
          // degrees to advance this frame
          const degPerMs = idleDegPerSec / 1000
          const deltaDeg = degPerMs * dtMs
          // apply a tiny smoothing so abrupt changes are avoided
          setCamYawDeg((prev) => prev + deltaDeg)
          // bump tick to update projections
          try { setCamOffsetTick((c) => c + 1); cameraDirtyRef.current = true } catch (err) {}
        }
      } catch (err) {
        // swallow
      }
      rafId = requestAnimationFrame(step)
    }

    rafId = requestAnimationFrame(step)
    return () => { if (rafId) cancelAnimationFrame(rafId) }
  // include relevant deps so rotation stops/starts as UI changes
  }, [workerDebug, mouseCameraControl, modalOpen])

  // Load persisted camera from localStorage on mount, with simple migration and logging.
  // This consolidates previous duplicated loaders and makes legacy values easier to debug.
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const raw = window.localStorage.getItem('hexgrid.camera')
      if (raw) {
        let parsed: any = null
        try { parsed = JSON.parse(raw) } catch (err) { parsed = null }
        if (parsed) {
          // Normalize/migrate legacy yaw values into explicit degrees and persist back
          // so future loads are unambiguous.
          let appliedYaw: number | null = null
          if (typeof parsed.yaw === 'number') {
            let yaw = parsed.yaw
            // Preserve historical special-case mapping 0.5 -> 0.25 (keeps older behavior)
            if (yaw === 0.5) yaw = 0.25
            // If yaw looks like a normalized turns fraction (-1..1) convert to degrees
            else if (Math.abs(yaw) <= 1) yaw = yaw * 360
            appliedYaw = yaw
            setCamYawDeg(yaw)
          }
          if (typeof parsed.pitch === 'number') setCamPitchDeg(parsed.pitch)
          if (typeof parsed.distance === 'number') setCamDistanceMultiplier(parsed.distance)

          // Ensure yawMult is set to 1 on load so the slider shows the actual camera position
          setYawMult(1)

          // Ensure our latest-camera ref is in sync immediately so any unmount
          // flush will write the correct values (avoids stale debounce race).
          try {
            cameraLatestRef.current = { yaw: appliedYaw ?? camYawDeg, pitch: parsed.pitch ?? camPitchDeg, distance: parsed.distance ?? camDistanceMultiplier }
          } catch (err) {}

          // Write back a normalized camera object (degrees) with an explicit unit tag
          // so the format is deterministic for subsequent loads. Wrap in try to avoid
          // interfering with environments that disallow localStorage writes.
          try {
            if (typeof window !== 'undefined') {
              const normalized = { yaw: appliedYaw ?? camYawDeg, pitch: parsed.pitch ?? camPitchDeg, distance: parsed.distance ?? camDistanceMultiplier, unit: 'deg' }
              window.localStorage.setItem('hexgrid.camera', JSON.stringify(normalized))
            }
          } catch (err) {}

          // Mark initialization complete so the persistence effect won't clobber this value
          cameraInitializedRef.current = true

          // Dev-only logging to aid debugging of persisted camera values.
          try {
            dlog('HexGrid: loaded persisted camera', { raw, parsed, appliedYaw })
          } catch (err) {}

          return
        }
      }

      // No saved camera - choose a friendly default depending on insideView preference
      const rawInside = window.localStorage.getItem('hexgrid.insideView')
      const preferInside = rawInside === null ? true : rawInside === 'true'
      // Set the same friendly defaults as before (keeps reset behavior stable)
      setCamYawDeg(-90)
      setCamPitchDeg(-12)
      setCamDistanceMultiplier(1.0)
      // Set yawMult     to 1 for consistent behavior
      setYawMult(1)

      // We set defaults explicitly — mark initialization done so persistence can run normally
      cameraInitializedRef.current = true
    } catch (err) {
      // ignore localStorage errors
    }
  }, [])

  // Persist camera settings when they change, using immediate writes.
  // The debounced approach was removed to eliminate race conditions.
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      if (!cameraInitializedRef.current) return
      
      // Update latest ref first so unmount flush uses same values
      cameraLatestRef.current = { yaw: camYawDeg, pitch: camPitchDeg, distance: camDistanceMultiplier }

      const obj = { yaw: camYawDeg, pitch: camPitchDeg, distance: camDistanceMultiplier, unit: 'deg' }
      const finalStr = JSON.stringify(obj)
      
      try {
        window.localStorage.setItem('hexgrid.camera', finalStr)
      } catch (err) {
        // ignore write errors
      }

      try { setLastSavedPitch(camPitchDeg) } catch (err) {}
      try { logger.debug('HexGrid: camera save wrote hexgrid.camera', obj) } catch (err) {}
      try { setRawCameraJson(JSON.stringify(obj, null, 2)) } catch (err) {}
    } catch (err) {
      // ignore localStorage errors
    }
  }, [camPitchDeg, camYawDeg, camDistanceMultiplier])

  // Dev-only: instrument localStorage.setItem globally to log writes and help
  // catch external overwrites of `hexgrid.camera`. This monkey-patches the
  // storage API only in non-production builds and restores the original on
  // unmount.
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      // Only enable instrumentation in development to avoid noise in prod
      if (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.NODE_ENV === 'production') return

      const ls: any = window.localStorage
      if (!ls) return
      const origSetItem = ls.setItem

      const patched = function(this: Storage, key: string, value: string) {
        try {
          // Global log for all setItem calls
          // include a concise stack trace to identify writer
          const stack = (new Error()).stack
          // Use console.debug so logging is easily filterable
          try { 
            //dlog
            dlog('[localStorage] setItem', { key, value, stack: stack ? stack.split('\n').slice(2,6).join('\n') : '' })
          } catch (err) {}
          if (key === 'hexgrid.camera') {
            try { dlog('[hexgrid.camera] writing', value) } catch (err) {}
          }
        } catch (err) {}
        return origSetItem.apply(this, [key, value])
      }

      ;(window as any).localStorage.setItem = patched

      return () => {
        try { (window as any).localStorage.setItem = origSetItem } catch (err) {}
      }
    } catch (err) {
      // ignore
    }
  }, [])

  // Ensure we flush the last scheduled camera state on unmount so the latest
  // camera isn't lost if the component is torn down before the debounce fires.
  useEffect(() => {
    return () => {
      try {
        if (cameraPersistTimeoutRef.current) {
          window.clearTimeout(cameraPersistTimeoutRef.current)
          cameraPersistTimeoutRef.current = null
        }
        if (typeof window !== 'undefined' && cameraInitializedRef.current) {
          const last = cameraLatestRef.current
          try { window.localStorage.setItem('hexgrid.camera', JSON.stringify({ yaw: last.yaw, pitch: last.pitch, distance: last.distance, unit: 'deg' })) } catch (err) {}
        }
      } catch (err) {}
    }
  }, [])


  // Keep a ref to the latest workerDebug so long-lived closures (worker handlers,
  // animation loop, streaming logic) can access up-to-date settings without
  // recreating the worker or re-registering handlers.
  const workerDebugRef = useRef(workerDebug)
  useEffect(() => { workerDebugRef.current = workerDebug }, [workerDebug])

  // Helper: write to localStorage only when serialized value changes to avoid
  // spamming storage and firing storage events unnecessarily.
  const localStorageCacheRef = useRef<Map<string, string>>(new Map())
  const setLocalStorageIfChanged = useCallback((key: string, value: string) => {
    try {
      if (typeof window === 'undefined') return
      const last = localStorageCacheRef.current.get(key)
      if (last === value) return
      window.localStorage.setItem(key, value)
      localStorageCacheRef.current.set(key, value)
    } catch (err) {
      // ignore
    }
  }, [])

  // Debug logging helper - only logs when workerDebugRef.current.debugLogs is true
  // NOTE: previous implementation accidentally called itself causing recursion.
  const dlog = useCallback((...args: any[]) => {
    try {
      if (workerDebugRef.current && workerDebugRef.current.debugLogs) {
        // Use console.debug directly to avoid accidental recursion
        try { logger.debug('[HexGrid]', ...args) } catch (err) { /* ignore */ }
      }
    } catch (err) {
      // swallow logging errors
    }
  }, [])

  // sendEvolve: component-scoped helper so all effects can call it safely
  const sendEvolve = useCallback((stateToSend: any, positionsParam: any, photosParam: any, hexRadiusParam: number, reason = 'manual') => {
    // client throttle: respect the user's evolveIntervalMs setting (minimum 100ms for safety)
    const clientMinPostMs = Math.max(100, workerDebugRef.current?.evolveIntervalMs ?? 1000)
    try {
      const nowTs = Date.now()
      const last = (sendEvolve as any).__lastPostAt || 0
      if (nowTs - last < clientMinPostMs) {
        if (workerDebugRef.current?.debugLogs) dlog('sendEvolve: clamped skip', { reason, lastPostedMsAgo: nowTs - last, clientMinPostMs })
        return
      }
      ;(sendEvolve as any).__lastPostAt = nowTs
    } catch (e) {}
    try {
      if (!workerRef.current) {
        dlog('sendEvolve: worker not ready, skipping', { reason, generation: stateToSend?.generation ?? -1 })
        return
      }
      // Prefer the generation from stateToSend, but if it's 0 and this isn't an explicit
      // initialization/reset (e.g. 'photos-init' or 'reset'), preserve the current
      // infectionStateRef generation to avoid accidental resets.
      const incomingGen = stateToSend?.generation ?? -1
      let gen = incomingGen
      try {
        if (incomingGen === 0 && reason !== 'photos-init' && reason !== 'reset') {
          // use the live ref generation if available
          gen = (typeof infectionStateRef !== 'undefined' && infectionStateRef.current && typeof infectionStateRef.current.generation === 'number') ? infectionStateRef.current.generation : incomingGen
        }
      } catch (err) {
        // fall back to incomingGen
        gen = incomingGen
      }
      const infCount = Array.isArray(stateToSend?.infections) ? stateToSend.infections.length : (stateToSend?.infections ? (stateToSend.infections.size ?? 0) : 0)
      dlog('sendEvolve:', { reason, generation: gen, infections: infCount, positions: positionsParam?.length ?? 0 })
      // Diagnostic: if we're about to send generation===0 but this isn't an explicit init/reset,
      // capture a stack trace (rate-limited) so we can find the code path that triggered it.
      try {
        const dbg = workerDebugRef.current
        if (dbg && dbg.debugLogs && gen === 0 && reason !== 'photos-init' && reason !== 'reset') {
          // Attach a simple rate limiter on the component function to avoid flooding the console
          const lastKey = '__sendEvolve_lastGen0Ts'
          const nowTs = Date.now()
          try {
            const last = (sendEvolve as any)[lastKey] || 0
            if (nowTs - last > 5000) { // at most once every 5s
              ;(sendEvolve as any)[lastKey] = nowTs
              // Create an Error to capture a stack trace and log it with context
              const err = new Error('sendEvolve: posting generation===0 (non-init)')
              try { logger.warn('sendEvolve: unexpected generation 0', { reason, infections: infCount, stack: err.stack }) } catch (e) {}
            }
          } catch (e) { /* swallow */ }
        }
      } catch (e) { /* swallow */ }
      // Ensure infections are serialized as an array of entries (worker expects Array<[index, Infection]>).
      let prevStateForPost = stateToSend
      try {
        if (prevStateForPost && prevStateForPost.infections && !Array.isArray(prevStateForPost.infections)) {
          // Map -> entries array
          if (typeof prevStateForPost.infections.entries === 'function') {
            prevStateForPost = { ...prevStateForPost, infections: Array.from(prevStateForPost.infections.entries()) }
          }
        }
      } catch (err) {
        // fallback: leave as-is
      }
      // If we adjusted the generation above, ensure the posted prevState carries it
      try {
        if (prevStateForPost && typeof gen === 'number' && prevStateForPost.generation !== gen) {
          prevStateForPost = { ...prevStateForPost, generation: gen }
        }
      } catch (err) {}

      const isSpherical = Boolean(gridMetadataRef.current?.isSpherical)
  workerRef.current.postMessage({ type: 'evolve', data: { prevState: prevStateForPost, positions: positionsParam, photos: photosParam, hexRadius: hexRadiusParam, currentTime: Date.now() / 1000, debug: workerDebugRef.current, isSpherical, reason } })
    } catch (err) {
      logger.error('sendEvolve failed', err)
    }
  }, [dlog])

  // Persist workerDebug to localStorage whenever it changes. Use an efficient
  // helper that skips writes when the serialized value is unchanged.
  useEffect(() => {
    try {
      const str = JSON.stringify(workerDebug)
      setLocalStorageIfChanged('hexgrid.workerDebug', str)
    } catch (err) {
      // ignore localStorage errors
    }
  }, [workerDebug, setLocalStorageIfChanged])

  // Auto-save workerDebug to Firestore when userId is available (debounced)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!userId) return // Only save if user is logged in
    
    // Debounce saves to avoid too many Firestore writes
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Convert workerDebug to WorkerDebugSettings format (excluding updatedAt)
        const { updatedAt, ...settingsToSave } = workerDebug as any
        await fetch('/api/settings/worker-debug', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settingsToSave)
        })
      } catch (error) {
        console.warn('Failed to save worker debug settings to Firestore:', error)
      }
    }, 2000) // 2 second debounce
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [workerDebug, userId])

  // Load saved settings from Firestore for channel views (username provided)
  // Only load once when component mounts with a username
  const hasLoadedChannelSettings = useRef(false)
  useEffect(() => {
    if (!username || userId || hasLoadedChannelSettings.current) return // Only load for channel views, not for logged-in users
    
    hasLoadedChannelSettings.current = true
    
    const loadChannelSettings = async () => {
      try {
        const response = await fetch(`/api/settings/worker-debug?username=${encodeURIComponent(username)}`)
        if (response.ok) {
          const savedSettings = await response.json()
          if (savedSettings) {
            // Convert saved settings back to WorkerDebug format (excluding updatedAt)
            const { updatedAt, ...settingsToApply } = savedSettings
            setWorkerDebug((prev) => ({ ...prev, ...settingsToApply }))
          }
        }
      } catch (error) {
        console.warn('Failed to load channel settings:', error)
      }
    }
    
    loadChannelSettings()
  }, [username, userId])

  // Calculate how many hexagons fit. Allow debug override via workerDebug.gridScale
  const sqrt3 = Math.sqrt(3)
  // effectiveHexRadius should follow the live workerDebug state so UI changes
  // (like gridScale/tileSize) take effect immediately and persist on refresh.
  const effectiveHexRadius = useMemo(() => {
    const scale = (workerDebug?.gridScale ?? 1)
    const tile = (workerDebug?.tileSize ?? defaultHexRadius)
    // bigger gridScale => smaller effective hex radius => more hexes
    const r = Math.max(4, Math.floor(tile / Math.max(1, scale)))
    return r
  }, [defaultHexRadius, workerDebug.gridScale, workerDebug.tileSize])

  // Get the hex spacing multiplier from debug settings
  const hexSpacing = workerDebug.hexSpacing ?? 1.0
  
  // Calculate dynamic screen dimensions based on viewport in 2D mode
  // In 3D mode, use default dimensions to maintain consistency
  const curveUDeg = workerDebug.curveUDeg ?? 0
  const curveVDeg = workerDebug.curveVDeg ?? 0
  const hasSignificantCurvature = Math.abs(curveUDeg) > 10 || Math.abs(curveVDeg) > 10
  
  const screenWidth = useMemo(() => {
    if (hasSignificantCurvature) {
      // 3D mode: use default dimensions
      return defaultScreenWidth
    }
    // 2D mode: use viewport width, with minimum constraint
    return Math.max(defaultScreenWidth, viewportDimensions.width)
  }, [hasSignificantCurvature, viewportDimensions.width, defaultScreenWidth])
  
  const screenHeight = useMemo(() => {
    if (hasSignificantCurvature) {
      // 3D mode: use default dimensions
      return defaultScreenHeight
    }
    // 2D mode: use viewport height, with minimum constraint
    return Math.max(defaultScreenHeight, viewportDimensions.height)
  }, [hasSignificantCurvature, viewportDimensions.height, defaultScreenHeight])
  
  // The actual drawn radius accounts for spacing to prevent overlap
  // hexSpacing < 1.0 means hexes are drawn smaller to create gaps
  const drawnHexRadius = effectiveHexRadius * hexSpacing
  
  // Grid spacing must match the DRAWN hexagon size for proper alignment
  // This ensures position generation and drawing use the same dimensions
  const horizontalSpacing = sqrt3 * drawnHexRadius
  const verticalSpacing = 1.5 * drawnHexRadius

  const cols = Math.ceil(screenWidth / horizontalSpacing)
  const rows = Math.ceil(screenHeight / verticalSpacing)
  const totalHexagons = cols * rows

  // Store grid metadata to track whether we're using spherical or flat grid
  const gridMetadataRef = useRef<{ isSpherical: boolean, cols: number, rows: number }>({ 
    isSpherical: false, 
    cols, 
    rows 
  })

  // Generate positions: use spherical grid when curvature is enabled, flat grid otherwise
  const hexPositions = useMemo(() => {
    const curveUDeg = workerDebug.curveUDeg ?? 0
    const curveVDeg = workerDebug.curveVDeg ?? 0
    const hasSignificantCurvature = Math.abs(curveUDeg) > 10 || Math.abs(curveVDeg) > 10
    
    if (hasSignificantCurvature) {
      // Use spherical hexagonal grid for compact 3D packing
      const densityMultiplier = workerDebug.sphericalDensity ?? 1.4
      const result = generateSphericalHexGrid(
        totalHexagons, 
        screenWidth, 
        screenHeight, 
        curveUDeg, 
        curveVDeg, 
        densityMultiplier,
        effectiveHexRadius  // Pass the actual hex radius so spacing matches drawing
      )
      gridMetadataRef.current = result.metadata
      return result.positions
    } else {
      // Use perfect flat hexagonal grid for 2D - use drawnHexRadius for proper alignment
      gridMetadataRef.current = { isSpherical: false, cols, rows }
      return generatePixelScreen(cols, rows, drawnHexRadius)
    }
  }, [cols, rows, drawnHexRadius, effectiveHexRadius, workerDebug.curveUDeg, workerDebug.curveVDeg, workerDebug.sphericalDensity, totalHexagons, screenWidth, screenHeight])


  // Send setDataAndConfig to worker whenever photos or workerDebug changes
  useEffect(() => {
    if (workerRef.current && photos.length > 0) {
      // Remember last sent config to avoid noisy repeated posts when nothing meaningful changed
      const lastSentConfigRef = (sendEvolve as any)._lastSentConfigRef || { current: null }
      ;(sendEvolve as any)._lastSentConfigRef = lastSentConfigRef
      // Use memoized serializablePhotos to avoid allocations and deep clones
      const serializablePhotos = (serializablePhotosMemoRef.current && serializablePhotosMemoRef.current.length === photos.length) ? serializablePhotosMemoRef.current : photos.map(p => ({
        id: p.id,
        title: p.title,
        alt: p.alt,
        imageUrl: p.imageUrl,
        thumbnailUrl: p.thumbnailUrl,
        category: p.category,
        shopUrl: p.shopUrl,
        location: p.location,
        description: p.description,
        videoUrl: p.videoUrl,
        isVideo: p.isVideo,
        velocity: p.velocity, // CRITICAL: Required for meritocratic system
        source: p.source,
        sourceUrl: p.sourceUrl,
        views: p.views,
        likes: p.likes,
        age_in_hours: p.age_in_hours
      }))
      
      if (workerDebugRef.current?.debugLogs) {
        dlog(`[HexGrid] Sending setDataAndConfig with ${serializablePhotos.length} photos`)
        if (serializablePhotos.length > 0) {
          dlog(`[HexGrid] First photo in setDataAndConfig:`, serializablePhotos[0])
          dlog(`[HexGrid] First photo velocity:`, serializablePhotos[0].velocity)
        }
      }
      
      try {
        const payload = {
          photos: serializablePhotos,
          positions: hexPositions,
          hexRadius: drawnHexRadius,
          isSpherical: Boolean(gridMetadataRef.current?.isSpherical),
          debug: workerDebugRef.current
        }
        const asString = JSON.stringify(payload)
        if (lastSentConfigRef.current !== asString) {
          workerRef.current.postMessage({ type: 'setDataAndConfig', data: payload })
          lastSentConfigRef.current = asString
          dlog('Sent setDataAndConfig to worker (photos or debug changed)')
        } else {
          // skip repeated identical config
          dlog('Skipped setDataAndConfig (no meaningful change)')
        }
      } catch (err) {
        // best-effort: fallback to sending without dedupe
        workerRef.current.postMessage({
          type: 'setDataAndConfig',
          data: {
            photos: serializablePhotos,
            positions: hexPositions,
            hexRadius: drawnHexRadius,
            isSpherical: Boolean(gridMetadataRef.current?.isSpherical),
            debug: workerDebugRef.current
          }
        })
        dlog('Sent setDataAndConfig to worker (fallback)')
      }
    } else if (workerRef.current && photos.length === 0) {
      logger.warn(`[HexGrid] Cannot send setDataAndConfig: photos array is empty`)
    }
  }, [photos, workerDebug, hexPositions, drawnHexRadius, dlog])

  // Memoize serializable photos to avoid repeated JSON cloning in animation loop.
  // We use a mutable ref to store the last built array and only rebuild when
  // photo identities or lengths change. This is safe because the serialized
  // shape is purely derived from `photos` prop.
  const serializablePhotosMemoRef = useRef<any[] | null>(null)
  useEffect(() => {
    if (!photos || photos.length === 0) {
      serializablePhotosMemoRef.current = []
      return
    }
    // Simple change detection: length or first/last id change
    const prev = serializablePhotosMemoRef.current
    if (prev && prev.length === photos.length) {
      let same = true
      for (let i = 0; i < photos.length; i++) {
        if (prev[i].id !== photos[i].id || prev[i].imageUrl !== photos[i].imageUrl) { same = false; break }
      }
      if (same) return
    }
    serializablePhotosMemoRef.current = photos.map(p => ({
      id: p.id,
      title: p.title,
      alt: p.alt,
      imageUrl: p.imageUrl,
      thumbnailUrl: p.thumbnailUrl,
      category: p.category,
      shopUrl: p.shopUrl,
      location: p.location,
      description: p.description,
      videoUrl: p.videoUrl,
      isVideo: p.isVideo,
      velocity: p.velocity,
      source: p.source,
      sourceUrl: p.sourceUrl,
      views: p.views,
      likes: p.likes,
      age_in_hours: p.age_in_hours
    }))
  }, [photos])

  
  // CRITICAL: Clear infection state when grid dimensions change to prevent index misalignment
  // When tileSize or gridScale changes, the hexPositions array is regenerated with different
  // indices, making the old infection state invalid.
  const prevGridKeyRef = useRef<string>('')
  useEffect(() => {
    const gridKey = `${cols}-${rows}-${effectiveHexRadius}`
    if (prevGridKeyRef.current && prevGridKeyRef.current !== gridKey) {
      // Grid changed - clear infections and reinitialize
      dlog('HexGrid: Grid dimensions changed, reinitializing infections', { old: prevGridKeyRef.current, new: gridKey })
      const isSpherical = gridMetadataRef.current?.isSpherical ?? false
      const initState = initializeInfectionSystem(hexPositions, photos, effectiveHexRadius, workerDebugRef.current?.spawnClusterMax ?? 8, logger, isSpherical)
      blankNeighborCountGenerationRef.current = -1
      blankNeighborCountRef.current = new Map()
      setInfectionState(initState)
      infectionStateRef.current = initState
      
      // Post to worker immediately (use sendEvolve helper so generation is logged)
      if (workerRef.current) {
        const infectionsArray = Array.from(initState.infections.entries())
        const stateToSend = {
          infections: infectionsArray,
          availableIndices: initState.availableIndices,
          lastEvolutionTime: initState.lastEvolutionTime,
          generation: initState.generation
        }
        sendEvolve(stateToSend, hexPositions, photos, drawnHexRadius, 'grid-dim-change')
      }
      cameraDirtyRef.current = true
    }
    prevGridKeyRef.current = gridKey
  }, [cols, rows, effectiveHexRadius, hexPositions, photos, dlog])

  // Compute grid bounds used for mapping to sphere
  const gridBounds = useMemo(() => {
    if (!hexPositions || hexPositions.length === 0) return { minX: 0, maxX: screenWidth, minY: 0, maxY: screenHeight, width: screenWidth, height: screenHeight }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const p of hexPositions) {
      if (p[0] < minX) minX = p[0]
      if (p[0] > maxX) maxX = p[0]
      if (p[1] < minY) minY = p[1]
      if (p[1] > maxY) maxY = p[1]
    }
    return { minX, maxX, minY, maxY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }
  }, [hexPositions])

  // Map a 2D grid position to 3D point and project to 2D canvas coordinates (returns {x,y,scale,angle,z})
  // z is the camera-space depth (for proper click hit-testing in depth order)
  const mapAndProject = useCallback((pos: [number, number, number], antipodal = false, idx?: number) => {
    const [x, y] = pos
    const dbg = workerDebug
    const curveUDeg = Number(dbg.curveUDeg || 0)
    const curveVDeg = Number(dbg.curveVDeg || 0)

    if ((!curveUDeg && !curveVDeg) || !gridBounds) {
      return { x, y, scale: 1, angle: 0, z: 0 }
    }

    const minX = gridBounds.minX
    const minY = gridBounds.minY
    const w = gridBounds.width
    const h = gridBounds.height

    const u = (x - minX) / Math.max(1e-6, w)
    const v = (y - minY) / Math.max(1e-6, h)

      // Clear, explicit spherical mapping
      const deg2rad = Math.PI / 180
      // longitude: center u=0.5 -> lon=0
      const lon = (u - 0.5) * (curveUDeg * deg2rad)
      // latitude: center v=0.5 -> lat=0; v grows downward in screen coords so keep sign convention
      const lat = (v - 0.5) * (curveVDeg * deg2rad)

      // Radius such that an angular horizontal span of `curveUDeg` maps to pixel width `w`.
      // arcLength = R * angularSpan => R = w / angularSpan (angularSpan in radians)
      const eps = 1e-6
      const angularSpanU = Math.max(eps, Math.abs(curveUDeg * deg2rad))
      // Handle edge case where curveUDeg is effectively zero
      const R = angularSpanU < 0.01 ? w : Math.max(eps, w / angularSpanU)

      const cosLat = Math.cos(lat)
      const sinLat = Math.sin(lat)
      const cosLon = Math.cos(lon)
      const sinLon = Math.sin(lon)

      let px = R * cosLat * cosLon
      let py = R * sinLat
      let pz = R * cosLat * sinLon

    // If requested, use the antipodal point (flip the vector) so images can appear on both sides
    if (antipodal) {
      px = -px
      py = -py
      pz = -pz
    }

    // Simple perspective projection
  const centerX = screenWidth / 2
  const centerY = screenHeight / 2
  // camera distance scaled by multiplier
  const camZBase = R * 3 + 1
  const camZ = camZBase * (camDistanceMultiplier || 1)

  // apply camera rotations: yaw (around Y) then pitch (around X)
  // scale stored yaw by the animated yaw multiplier so toggling insideView centers smoothly
  const effectiveYawDeg = (camYawDeg || 0) * (yawMult ?? 1)
  const yawRad = ((effectiveYawDeg) + (camOffsetRef.current?.yaw || 0)) * (Math.PI / 180)
  const pitchRad = ((camPitchDeg || 0) + (camOffsetRef.current?.pitch || 0)) * (Math.PI / 180)

  // Apply optional inversion for yaw if user prefers the opposite sign convention
  const appliedYawRad = (invertYaw ? -1 : 1) * yawRad

  // yaw rotation about Y axis
  const yawCos = Math.cos(appliedYawRad)
  const yawSin = Math.sin(appliedYawRad)
  const rx = yawCos * px + yawSin * pz
  const rz = -yawSin * px + yawCos * pz

  // pitch rotation about X axis
  const pitchCos = Math.cos(pitchRad)
  const pitchSin = Math.sin(pitchRad)
  const ry = pitchCos * py - pitchSin * rz
  const rz2 = pitchSin * py + pitchCos * rz

  // use rotated coordinates for projection
  const projX3 = rx
  const projY3 = ry
  const projZ3 = rz2
  
  // CRITICAL: Store camera-space Z for depth sorting in click detection
  // For outside view: larger Z = further from camera (behind sphere)
  // For inside view: larger Z = closer to camera (in front of camera at origin)
  const cameraSpaceZ = projZ3
  // If insideView is enabled, treat the camera as being at the sphere center
  // and project points outward onto a virtual focal plane in front of the camera.
  if (insideView) {
    // focal distance tuned relative to sphere radius to keep projection reasonable
    const focal = R * (insideFocal || 1.2) * (camDistanceMultiplier || 1)
    const denom = Math.max(1e-3, projZ3)
    const f = focal / denom
    const sx = projX3 * f + centerX
    const sy = -projY3 * f + centerY
    // For inside view, use projZ3 directly as depth (positive Z = in front of camera)
    return { x: sx, y: sy, scale: f, angle: 0, z: cameraSpaceZ }
  }

  // Default outside-camera projection (camera positioned along +Z looking at origin)
  // project helper that handles both inside/outside projection consistently
  const projectScreen = (x3: number, y3: number, z3: number) => {
    if (insideView) {
      const focal = R * (insideFocal || 1.2) * (camDistanceMultiplier || 1)
      const denom2 = Math.max(1e-3, z3)
      const f2 = focal / denom2
      return { sx: x3 * f2 + centerX, sy: -y3 * f2 + centerY, f: f2, z: z3 }
    }
    const denom2 = Math.max(1e-3, camZ - z3)
    const f2 = camZ / denom2
    // For outside view, return depth as (camZ - z3), smaller = closer
    return { sx: x3 * f2 + centerX, sy: -y3 * f2 + centerY, f: f2, z: camZ - z3 }
  }

  try {
  // project the main point
  const main = projectScreen(projX3, projY3, projZ3)

    // package mapping debug info (include cameraSpaceZ for debugging)
    const mappingDebug = {
      u, v, lon, lat, R, world: { x: px, y: py, z: pz }, rotated: { x: projX3, y: projY3, z: projZ3 }, cameraSpaceZ
    }

    // Compute pole-based scale reduction so hexes shrink toward poles to avoid overlap
    // Use cos(lat) as a natural falloff: cos(0)=1 at equator, cos(pi/2)=0 at poles.
    // Apply an exponent (polePower) to control the curve, and clamp to poleMinScale.
    // For spherical grids, pole scaling is less aggressive since the grid already has
    // adaptive density at different latitudes.
    let poleScale = 1
    try {
      const dbgPoleEnabled = Boolean(workerDebug?.poleScaleEnabled ?? true)
      if (dbgPoleEnabled) {
        const poleMin = Number(workerDebug?.poleMinScale ?? 0.25)
        const polePower = Number(workerDebug?.polePower ?? 1.0)
        // safe cosLat in [0,1]
        const safeCos = Math.max(0, Math.abs(Math.cos(lat)))
        
        // For spherical grids, reduce the pole scaling effect since the grid
        // already has natural density adaptation
        const isSpherical = gridMetadataRef.current?.isSpherical ?? false
        if (isSpherical) {
          // Use a gentler curve for spherical grids - interpolate toward 1.0
          const sphericalPoleScale = Math.max(poleMin, Math.pow(safeCos, polePower))
          // Blend 70% toward no scaling, 30% the calculated value
          poleScale = sphericalPoleScale * 0.3 + 1.0 * 0.7
        } else {
          // Original aggressive scaling for flat grids mapped to sphere
          poleScale = Math.max(poleMin, Math.pow(safeCos, polePower))
        }
      }
    } catch (err) {
      poleScale = 1
    }

  // Use actual neighboring hex projections when an index is provided. This
  // computes on-screen distances by projecting real neighbor positions and
  // yields a more accurate desired radius so hexes stay tightly packed.
  try {
      if (typeof idx === 'number' && Array.isArray(hexPositions) && hexPositions.length > idx) {
        // Find neighbor indices using grid geometry (pass isSpherical flag)
        const isSpherical = gridMetadataRef.current?.isSpherical ?? false
        const neighborIndices = getNeighbors(idx, hexPositions, drawnHexRadius, isSpherical)
        const projNeighbors: {sx: number, sy: number}[] = []
        for (const ni of neighborIndices) {
          const np = hexPositions[ni]
          // Map neighbor pixel to lon/lat using same gridBounds mapping
          const nu = (np[0] - minX) / Math.max(1e-6, w)
          const nv = (np[1] - minY) / Math.max(1e-6, h)
          const nlon = (nu - 0.5) * (curveUDeg * deg2rad)
          const nlat = (nv - 0.5) * (curveVDeg * deg2rad)
          const cosLatN = Math.cos(nlat)
          let npx = R * cosLatN * Math.cos(nlon)
          let npy = R * Math.sin(nlat)
          let npz = R * cosLatN * Math.sin(nlon)
          if (antipodal) { npx = -npx; npy = -npy; npz = -npz }
          // apply camera rotations
          const nrx = yawCos * npx + yawSin * npz
          const nrz = -yawSin * npx + yawCos * npz
          const nry = pitchCos * npy - pitchSin * nrz
          const nrz2 = pitchSin * npy + pitchCos * nrz
          const npProj = projectScreen(nrx, nry, nrz2)
          projNeighbors.push({ sx: npProj.sx, sy: npProj.sy })
        }

        if (projNeighbors.length > 0) {
          // compute mean absolute horizontal and vertical offsets
          let sumDx = 0, sumDy = 0
          for (const pn of projNeighbors) {
            sumDx += Math.abs(pn.sx - main.sx)
            sumDy += Math.abs(pn.sy - main.sy)
          }
          const avgDx = sumDx / projNeighbors.length
          const avgDy = sumDy / projNeighbors.length

          const R_h = avgDx / Math.sqrt(3)
          const R_v = avgDy / 1.5
          let desiredRadius = Math.min(R_h || Infinity, R_v || Infinity)
          if (!isFinite(desiredRadius) || desiredRadius <= 0) {
            // fallback to angular delta method below
          } else {
            // safety factor and pole scale
            desiredRadius *= 0.98
            const drawnBase = effectiveHexRadius * (hexSpacing || 1)
            let projScale = (desiredRadius * poleScale) / Math.max(1e-6, drawnBase)
            if (!isFinite(projScale) || projScale <= 1e-4) {
              const fallbackScale = (main as any).f * poleScale
              return { x: main.sx, y: main.sy, scale: fallbackScale, angle: 0, z: main.z, mappingDebug: { ...mappingDebug, poleScale, desiredRadius, neighborCount: projNeighbors.length, usedFallback: true } }
            }
            projScale = Math.max(0.02, Math.min(8.0, projScale))
            // For spherical grids, hexagons are already properly oriented, so no rotation needed
            // For flat grids, compute tangent angle using first neighbor for orientation
            let angle = 0
            if (!isSpherical) {
              const tangentAngle = Math.atan2(projNeighbors[0].sy - main.sy, projNeighbors[0].sx - main.sx)
              angle = tangentAngle - Math.PI / 2
            }
            return { x: main.sx, y: main.sy, scale: projScale, angle: angle, z: main.z, mappingDebug: { ...mappingDebug, poleScale, desiredRadius, neighborCount: projNeighbors.length } }
          }
        }
      }

      // If neighbor-based method didn't run or failed, fall back to small angular delta projection below

  // Convert desired world-space neighbor offsets (horizontal/vertical spacing in pixels)
  // into angular deltas in radians relative to the mapped angular spans.
  const angularSpanU = Math.max(1e-6, curveUDeg * deg2rad)
  const angularSpanV = Math.max(1e-6, curveVDeg * deg2rad)

      // horizontal/vertical spacing in world pixels (use same math as generatePixelScreen)
  const sqrt3 = Math.sqrt(3)
  // Use drawnHexRadius (includes hexSpacing) so projection-space neighbor offsets
  // match the actual drawn tile spacing used by drawHexagon.
  const drawnBaseRadius = (drawnHexRadius || (effectiveHexRadius * (hexSpacing || 1)))
  const horizontalSpacingLocal = sqrt3 * drawnBaseRadius
  const verticalSpacingLocal = 1.5 * drawnBaseRadius

      // compute dLon/dLat corresponding to those pixel offsets
      const dLon = (horizontalSpacingLocal / Math.max(1, w)) * angularSpanU
      const dLat = (verticalSpacingLocal / Math.max(1, h)) * angularSpanV

      // Project a small longitude offset to estimate horizontal screen spacing
      const lonH = lon + dLon
      const cosLatH = Math.cos(lat)
      let pxH = R * cosLatH * Math.cos(lonH)
      let pyH = R * Math.sin(lat)
      let pzH = R * cosLatH * Math.sin(lonH)
      if (antipodal) { pxH = -pxH; pyH = -pyH; pzH = -pzH }

      const rxH = yawCos * pxH + yawSin * pzH
      const rzH = -yawSin * pxH + yawCos * pzH
      const ryH = pitchCos * pyH - pitchSin * rzH
      const rzH2 = pitchSin * pyH + pitchCos * rzH
      const projH = projectScreen(rxH, ryH, rzH2)

      // Project a small latitude offset to estimate vertical screen spacing
      const latV = lat + dLat
      const cosLatV = Math.cos(latV)
      let pxV = R * cosLatV * Math.cos(lon)
      let pyV = R * Math.sin(latV)
      let pzV = R * cosLatV * Math.sin(lon)
      if (antipodal) { pxV = -pxV; pyV = -pyV; pzV = -pzV }

      const rxV = yawCos * pxV + yawSin * pzV
      const rzV = -yawSin * pxV + yawCos * pzV
      const ryV = pitchCos * pyV - pitchSin * rzV
      const rzV2 = pitchSin * pyV + pitchCos * rzV
      const projV = projectScreen(rxV, ryV, rzV2)

      // screen-space center-to-center distances
      const dx = Math.hypot(projH.sx - main.sx, projH.sy - main.sy)
      const dy = Math.hypot(projV.sx - main.sx, projV.sy - main.sy)

      // Derive radius from center spacings for flat-top hex: horiz spacing = sqrt(3)*R, vert spacing = 1.5*R
      const R_h = dx / Math.sqrt(3)
      const R_v = dy / 1.5

      // desired on-screen radius should be the smaller of the two to avoid overlap
      let desiredRadius = Math.min(R_h || Infinity, R_v || Infinity)
      if (!isFinite(desiredRadius) || desiredRadius <= 0) {
        // Fallback to previous scale calculation
        return { x: main.sx, y: main.sy, scale: main.f * poleScale, angle: 0, mappingDebug: { ...mappingDebug, poleScale } }
      }

      // apply a tiny safety factor to avoid 1px bleeding between tiles
      desiredRadius *= 0.98

      // Convert desiredRadius (pixels) into a projection-scale relative to the drawn hex radius
      const drawnBase = effectiveHexRadius * (hexSpacing || 1)
      let projScale = (desiredRadius * poleScale) / Math.max(1e-6, drawnBase)

      // angle of the screen-space tangent vector (use horizontal projection)
      const tangentAngle = Math.atan2(projH.sy - main.sy, projH.sx - main.sx)
      const adjusted = tangentAngle - Math.PI / 2

      // Validate and clamp the computed scale. If something went wrong (NaN/Inf/too small)
      // fall back to the original projection-scale behaviour which was stable.
      if (!isFinite(projScale) || projScale <= 1e-4) {
        const fallbackScale = (main as any).f * poleScale
        if (workerDebugRef.current?.debugLogs) {
          logger.warn('mapAndProject: Invalid projScale computed, using fallback', { projScale, fallbackScale, idx })
        }
        return { x: main.sx, y: main.sy, scale: fallbackScale, angle: adjusted, mappingDebug: { ...mappingDebug, poleScale, projDx: dx, projDy: dy, desiredRadius, usedFallback: true } }
      }

      // Clamp extreme values to avoid huge overlap or invisible tiles
      const origProjScale = projScale
      projScale = Math.max(0.02, Math.min(8.0, projScale))
      if (workerDebugRef.current?.debugLogs && origProjScale !== projScale) {
        logger.warn('mapAndProject: Clamped projScale', { original: origProjScale, clamped: projScale, idx })
      }

      // For spherical grids, hexagons are already properly oriented, so no rotation needed
      // For flat grids, compute tangent angle from horizontal projection for orientation
      const isSpherical = gridMetadataRef.current?.isSpherical ?? false
      let angle = 0
      if (!isSpherical) {
        const tangentAngle = Math.atan2(projH.sy - main.sy, projH.sx - main.sx)
        angle = tangentAngle - Math.PI / 2
      }

      return { x: main.sx, y: main.sy, scale: projScale, angle: angle, z: main.z, mappingDebug: { ...mappingDebug, poleScale, projDx: dx, projDy: dy, desiredRadius } }
    } catch (err) {
      // On any failure, fallback to earlier behavior
      try {
        const dLon = 1e-4 // small delta in radians
        const lon2 = lon + dLon
        const cosLat2 = Math.cos(lat)
        let px2 = R * cosLat2 * Math.cos(lon2)
        let py2 = R * Math.sin(lat)
        let pz2 = R * cosLat2 * Math.sin(lon2)
        if (antipodal) { px2 = -px2; py2 = -py2; pz2 = -pz2 }

        const rx2 = yawCos * px2 + yawSin * pz2
        const rz2b = -yawSin * px2 + yawCos * pz2
        const ry2 = pitchCos * py2 - pitchSin * rz2b
        const rz22 = pitchSin * py2 + pitchCos * rz2b
        const tang = projectScreen(rx2, ry2, rz22)
        
        // For spherical grids, no rotation needed; for flat grids, compute tangent angle
        const isSpherical = gridMetadataRef.current?.isSpherical ?? false
        let angle = 0
        if (!isSpherical) {
          const tangentAngle = Math.atan2(tang.sy - main.sy, tang.sx - main.sx)
          angle = tangentAngle - Math.PI / 2
        }
        return { x: main.sx, y: main.sy, scale: main.f * poleScale, angle: angle, z: main.z, mappingDebug: { ...mappingDebug, poleScale } }
      } catch (err2) {
        const fallback = projectScreen(projX3, projY3, projZ3)
        return { x: fallback.sx, y: fallback.sy, scale: fallback.f, angle: 0, z: fallback.z || 0 }
      }
    }
  } catch (err) {
    const fallback = projectScreen(projX3, projY3, projZ3)
    return { x: fallback.sx, y: fallback.sy, scale: fallback.f, angle: 0, z: fallback.z || 0 }
  }
  }, [workerDebug, gridBounds, screenWidth, screenHeight, camYawDeg, camPitchDeg, camDistanceMultiplier, camOffsetTick, insideView, invertYaw, drawnHexRadius, hexSpacing, effectiveHexRadius, yawMult, insideFocal])

  // Precompute projected positions (x,y,scale,angle,z,mappingDebug) for drawing and hit tests.
  // Use a ref to cache results and avoid reallocating a big array on every render/draw.
  // CRITICAL: Now includes Z-depth (index 4) for proper depth-sorted click detection
  const projectedPositionsRef = useRef<[number, number, number, number, number, any][]>([])
  useEffect(() => {
    // Recompute projected positions when hexPositions or camera/projection function changes.
    try {
      const arr = hexPositions.map((p, i) => {
        const r = mapAndProject(p, false, i)
        // Sanitize projection results to avoid NaN/Inf/invalid values which can break drawing
        const rx = Number((r as any).x)
        const ry = Number((r as any).y)
        const rscale = Number((r as any).scale)
        const rangle = Number((r as any).angle) || 0
        const rz = Number((r as any).z) || 0
        const mappingDebug = (r as any).mappingDebug || null

        const safeX = isFinite(rx) ? rx : p[0]
        const safeY = isFinite(ry) ? ry : p[1]
        const safeScale = isFinite(rscale) && rscale > 0 ? rscale : 1
        const safeZ = isFinite(rz) ? rz : 0

        // include z-depth as 5th element, mappingDebug as 6th for debug overlays
        return [safeX, safeY, safeScale, rangle, safeZ, mappingDebug] as [number, number, number, number, number, any]
      })
      projectedPositionsRef.current = arr
    } catch (err) {
      // In case of projection errors, keep previous cache
      logger.warn('Failed to recompute projectedPositions:', err)
    }
  }, [hexPositions, mapAndProject])

  // Whether the debug panel is open (hidden by default)
  const [debugOpen, setDebugOpen] = useState(false)
  const debugOpenRef = useRef(debugOpen)
  // Mapping debug overlay toggle (persisted)
  const [showMappingDebug, setShowMappingDebug] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const v = window.localStorage.getItem('hexgrid.showMappingDebug')
        return v === 'true'
      }
    } catch (err) {}
    return false
  })
  const showMappingDebugRef = useRef(showMappingDebug)
  useEffect(() => { showMappingDebugRef.current = showMappingDebug }, [showMappingDebug])
  // Camera panel visibility (controlled by nav button via uiStore)
  const [cameraOpen, setCameraOpen] = useState(false)
  const cameraOpenRef = useRef(cameraOpen)
  // Low-res mode toggle to use larger tiles and fewer hexes for better performance
  const [lowResActive, setLowResActive] = useState(false)
  const lowResSampleStepRef = useRef<number>(1)
  const lowFpsFallbackRef = useRef<{ triggered: boolean; lastLowTs: number }>({ triggered: false, lastLowTs: 0 })
  // Transient UI status for apply operations so users get immediate feedback
  const [applyStatus, setApplyStatus] = useState<null | 'applied' | 'failed'>(null)
  const applyTimeoutRef = useRef<number | null>(null)
  // Whether the telemetry/stats overlay is visible (default closed)
  const [showStats, setShowStats] = useState(false)
  const showStatsRef = useRef(showStats)

  

  // Load persisted debug panel state from localStorage on mount (safe for Next.js)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const v = window.localStorage.getItem('hexgrid.debugOpen')
        if (v !== null) setDebugOpen(v === 'true')
      }
    } catch (err) {
      // ignore localStorage errors
    }
  }, [])

  // Load persisted camera panel state from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const v = window.localStorage.getItem('hexgrid.cameraOpen')
        if (v !== null) setCameraOpen(v === 'true')
      }
    } catch (err) {
      // ignore localStorage errors
    }
  }, [])

  // Keep ref in sync and persist changes
  useEffect(() => {
    debugOpenRef.current = debugOpen
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('hexgrid.debugOpen', debugOpen ? 'true' : 'false')
      }
    } catch (err) {
      // ignore localStorage errors
    }
  }, [debugOpen])

  // persist mapping debug toggle
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('hexgrid.showMappingDebug', showMappingDebug ? 'true' : 'false')
      }
    } catch (err) {}
  }, [showMappingDebug])

  // Persist invertYaw preference
  useEffect(() => {
    // keep state in sync and persist preference
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('hexgrid.invertYaw', invertYaw ? 'true' : 'false')
      }
    } catch (err) {}
  }, [invertYaw])

  // Clear any pending apply status timeout on unmount
  useEffect(() => {
    return () => {
      if (applyTimeoutRef.current) window.clearTimeout(applyTimeoutRef.current)
    }
  }, [])

  // Mirror showStats into a ref & persist toggle
  useEffect(() => { showStatsRef.current = showStats }, [showStats])


  // Keyboard handler: 'd' toggles the debug panel; Enter/Escape close it when open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const key = e.key
      if (key === 'd' || key === 'D') {
        setDebugOpen((v) => !v)
        return
      }

      if ((key === 'Escape' || key === 'Enter') && debugOpenRef.current) {
        setDebugOpen(false)
      }
    }

    window.addEventListener('keydown', onKey)
    // Listen for programmatic toggles from the global nav buttons
    const onToggleDebug = () => setDebugOpen((v) => !v)
    const onToggleStats = () => setShowStats((v) => !v)
    window.addEventListener('toggle-debug-panel', onToggleDebug as EventListener)
    window.addEventListener('toggle-stats-panel', onToggleStats as EventListener)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('toggle-debug-panel', onToggleDebug as EventListener)
      window.removeEventListener('toggle-stats-panel', onToggleStats as EventListener)
    }
  }, [])

  // Animation state for auto-curving
  const animateRef = useRef<{ running: boolean, startTime?: number, duration: number }>({ running: false, duration: 4000 })

  // Start/stop curve animation
  const startCurveAnimation = useCallback(() => {
    if (animateRef.current.running) return
    animateRef.current.running = true
    animateRef.current.startTime = performance.now()

    const step = () => {
      if (!animateRef.current.running) return
      const now = performance.now()
      const t = Math.min(1, (now - (animateRef.current.startTime || now)) / animateRef.current.duration)
      const val = t * 360
      setWorkerDebug((prev) => ({ ...prev, curveUDeg: val, curveVDeg: val }))
      // post debug to worker for live updates
      try {
        if (workerRef.current) {
          const infectionsArray = Array.from(infectionStateRef.current.infections.entries())
          const stateToSend = {
            infections: infectionsArray,
            availableIndices: infectionStateRef.current.availableIndices,
            lastEvolutionTime: infectionStateRef.current.lastEvolutionTime,
            generation: infectionStateRef.current.generation
          }
          sendEvolve(stateToSend, hexPositions, photos, drawnHexRadius, 'curve-animation')
        }
      } catch (err) { /* ignore */ }

      if (t < 1) requestAnimationFrame(step)
      else animateRef.current.running = false
    }

    requestAnimationFrame(step)
  }, [hexPositions, photos, effectiveHexRadius])

  const stopCurveAnimation = useCallback(() => {
    animateRef.current.running = false
  }, [])

  // Cleanup curve animation on unmount
  useEffect(() => {
    return () => {
      animateRef.current.running = false
    }
  }, [])

  // Subscribe to uiStore so nav buttons (which toggle the store) control this component
  useEffect(() => {
    const unsub = uiStore.subscribe((s) => {
      // sync only when different to avoid redundant updates
      setDebugOpen((prev) => (prev === s.debugOpen ? prev : s.debugOpen))
      setShowStats((prev) => (prev === s.showStats ? prev : s.showStats))
    })
    return () => { void unsub() }
  }, [])

  useEffect(() => {
    const unsub = uiStore.subscribe((s) => {
      setCameraOpen(!!s.cameraOpen)
    })
    return () => { void unsub() }
  }, [])

  // Keep ref and localStorage in sync with cameraOpen so panel state persists across reloads
  useEffect(() => {
    cameraOpenRef.current = cameraOpen
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('hexgrid.cameraOpen', cameraOpen ? 'true' : 'false')
      }
    } catch (err) { /* ignore */ }
  }, [cameraOpen])

  // Mirror local debug/showStats/cameraOpen changes into the uiStore so nav reflects state
  useEffect(() => { uiStore.set({ debugOpen }) }, [debugOpen])
  useEffect(() => { uiStore.set({ showStats }) }, [showStats])
  useEffect(() => { uiStore.set({ cameraOpen }) }, [cameraOpen])
  
  // Use a ref to store the current infection state for the animation loop
  const infectionStateRef = useRef(infectionState)
  useEffect(() => {
    infectionStateRef.current = infectionState
  }, [infectionState])

  // Acknowledge counter for worker 'ack-evolve' debug messages
  const [ackEvolveCount, setAckEvolveCount] = useState<number>(0)

  // Per-tile alpha smoothing state (ref to avoid re-renders)
  const tileAlphaRef = useRef<Map<number, number>>(new Map())

  // Per-tile arrival pulse timestamps (ms) to show a brief highlight when a tile appears/updates
  const tilePulseRef = useRef<Map<number, { start: number; duration: number }>>(new Map())
  // Worker-precomputed neighbor blank counts (index -> blank-neighbor count)
  const blankNeighborCountRef = useRef<Map<number, number>>(new Map())
  const blankNeighborCountGenerationRef = useRef<number>(-1)
  // Fallback cache for local blank-neighbor computation when worker data is unavailable/mismatched
  const localBlankNeighborCacheRef = useRef<{
    infectionMap: Map<number, Infection> | null
    positions: [number, number, number][] | null
    hexRadius: number
    counts: Map<number, number>
  }>({
    infectionMap: null,
    positions: null,
    hexRadius: -1,
    counts: new Map()
  })

  // Runtime telemetry: frame timing buffer for FPS/ms overlay
  const frameTimesRef = useRef<number[]>([])
  const lastFrameTimeRef = useRef<number>(performance.now())
  const [telemetry, setTelemetry] = useState<{ fps: number; avgMs: number; lastMs: number; drawAvgMs?: number; drawLastMs?: number }>({ fps: 0, avgMs: 0, lastMs: 0 })
  // Ref to store telemetry for effects that need to read it without causing re-renders
  const telemetryRef = useRef<{ fps: number; avgMs: number; lastMs: number; drawAvgMs?: number; drawLastMs?: number }>({ fps: 0, avgMs: 0, lastMs: 0 })
  // Refs to store values for low-FPS fallback effect to avoid dependency array size issues
  const hexPositionsRef = useRef<any>(null)
  const photosRef = useRef<any[]>([])
  const drawnHexRadiusRef = useRef<number>(0)
  // Separate buffer for draw() timing only
  const drawTimesRef = useRef<number[]>([])
  // update telemetry at ~4Hz
  useEffect(() => {
    let raf = 0
    let lastSample = performance.now()
    const sampleInterval = 250 // ms
    const tick = (now: number) => {
      const dt = now - lastFrameTimeRef.current
      // clamp reasonable dt
      const frameMs = Math.max(0, Math.min(1000, dt))
      const buf = frameTimesRef.current
      buf.push(frameMs)
      if (buf.length > 120) buf.shift()
      lastFrameTimeRef.current = now

      if (now - lastSample >= sampleInterval) {
        const samples = frameTimesRef.current.slice(-60)
        const avg = samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length)
        const fps = avg > 0 ? Math.round(1000 / avg) : 0
        // compute draw averages from drawTimesRef
        const drawSamples = drawTimesRef.current.slice(-120)
        const drawAvg = drawSamples.length ? drawSamples.reduce((a, b) => a + b, 0) / drawSamples.length : 0
        const drawLast = drawSamples.length ? drawSamples[drawSamples.length - 1] : 0
        const newTelemetry = { fps, avgMs: Math.round(avg * 10) / 10, lastMs: Math.round(frameMs * 10) / 10, drawAvgMs: Math.round(drawAvg * 10) / 10, drawLastMs: Math.round(drawLast * 10) / 10 }
        telemetryRef.current = newTelemetry
        setTelemetry(newTelemetry)
        lastSample = now
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Keep refs in sync with current values for low-FPS fallback effect
  useEffect(() => {
    hexPositionsRef.current = hexPositions
    photosRef.current = photos
    drawnHexRadiusRef.current = drawnHexRadius
  }, [hexPositions, photos, drawnHexRadius])

  // Automatic low-FPS fallback: if FPS is low for >2s, enable low-res preset to recover.
  useEffect(() => {
    let raf = 0
    const check = () => {
      const fps = telemetryRef.current.fps || 0
      const now = performance.now()
      if (fps > 8) {
        // recovered
        lowFpsFallbackRef.current.lastLowTs = 0
        if (lowFpsFallbackRef.current.triggered) {
          lowFpsFallbackRef.current.triggered = false
          // smoothly restore previous debug if present to avoid jarring change
          try {
            const target = prevDebugRef.current
            if (target) {
              const startDebug = { ...(workerDebugRef.current || workerDebug) }
              const duration = 600
              const startTs = performance.now()
              const lerp = (a: number, b: number, t: number) => a + (b - a) * t

              const stepRestore = () => {
                const t = Math.min(1, (performance.now() - startTs) / duration)
                const interp: any = { ...startDebug }
                interp.tileSize = Math.round(lerp(startDebug.tileSize ?? target.tileSize ?? 0, target.tileSize ?? 0, t))
                interp.gridScale = lerp(startDebug.gridScale ?? 1, target.gridScale ?? 1, t)
                interp.batchPerFrame = Math.max(0, Math.round(lerp(startDebug.batchPerFrame ?? 0, target.batchPerFrame ?? 0, t)))
                interp.streamMs = Math.round(lerp(startDebug.streamMs ?? 0, target.streamMs ?? 0, t))
                interp.evolveIntervalMs = Math.round(lerp(startDebug.evolveIntervalMs ?? 0, target.evolveIntervalMs ?? 0, t))
                // re-enable booleans at the end
                if (t >= 1) {
                  interp.renderBothSides = target.renderBothSides
                  interp.scratchEnabled = target.scratchEnabled
                  interp.sheenEnabled = target.sheenEnabled
                }
                workerDebugRef.current = interp
                try { setWorkerDebug(interp) } catch (err) {}
                if (t < 1) requestAnimationFrame(stepRestore)
                else {
                  // cleared
                  prevDebugRef.current = null
                  setLowResActive(false)
                  if (workerRef.current) {
                    const infectionsArray = Array.from(infectionStateRef.current.infections.entries())
                    const stateToSend = { infections: infectionsArray, availableIndices: infectionStateRef.current.availableIndices, lastEvolutionTime: infectionStateRef.current.lastEvolutionTime, generation: infectionStateRef.current.generation }
              sendEvolve(stateToSend, hexPositionsRef.current, photosRef.current, drawnHexRadiusRef.current, 'grid-change-init')
                  }
                }
              }
              requestAnimationFrame(stepRestore)
            } else {
              setLowResActive(false)
            }
          } catch (err) { logger.warn('Failed to restore debug settings:', err) }
        }
      } else if (fps > 0 && fps < 2) {
        if (lowFpsFallbackRef.current.lastLowTs === 0) lowFpsFallbackRef.current.lastLowTs = now
        if (!lowFpsFallbackRef.current.triggered && now - lowFpsFallbackRef.current.lastLowTs > 2000) {
          // trigger a gentler fallback applied gradually to avoid jarring visual jumps
          lowFpsFallbackRef.current.triggered = true
          try {
            // save current debug to restore later
            prevDebugRef.current = workerDebugRef.current ?? workerDebug

            // Build a conservative preset: modestly larger tiles, disable expensive effects
            const cur = workerDebugRef.current || workerDebug
            const baseTile = Math.max(8, (cur?.tileSize ?? defaultHexRadius))
            const gentlePreset = {
              ...cur,
              // only increase tile size by up to 2x (not 4x)
              tileSize: Math.min(128, Math.floor(baseTile * 2)),
              // reduce grid density slightly
              gridScale: Math.max(0.5, (cur?.gridScale ?? 1) * 0.8),
              // modest per-frame batching
              batchPerFrame: Math.max(4, Math.floor((cur?.batchPerFrame ?? 4) * 0.5)),
              // increase stream delays a bit to throttle UI updates
              streamMs: Math.max(8, (cur?.streamMs ?? 8)),
              // slow down evolves to reduce worker churn
              evolveIntervalMs: Math.max(300, (cur?.evolveIntervalMs ?? 400)),
              // disable some visual effects that are expensive on CPU/canvas
              renderBothSides: false,
              scratchEnabled: false,
              sheenEnabled: false
            }

            // Smoothly interpolate from current debug to gentlePreset over 600ms
            const startDebug = { ...(workerDebugRef.current || workerDebug) }
            const duration = 600
            const startTs = performance.now()
            const lerp = (a: number, b: number, t: number) => a + (b - a) * t

            const stepInterp = () => {
              const t = Math.min(1, (performance.now() - startTs) / duration)
              const interp = { ...startDebug }
              // interpolate numeric fields
              interp.tileSize = Math.round(lerp(startDebug.tileSize ?? baseTile, gentlePreset.tileSize, t))
              interp.gridScale = lerp(startDebug.gridScale ?? 1, gentlePreset.gridScale, t)
              interp.batchPerFrame = Math.max(0, Math.round(lerp(startDebug.batchPerFrame ?? 0, gentlePreset.batchPerFrame ?? 0, t)))
              interp.streamMs = Math.round(lerp(startDebug.streamMs ?? 0, gentlePreset.streamMs ?? 0, t))
              interp.evolveIntervalMs = Math.round(lerp(startDebug.evolveIntervalMs ?? 0, gentlePreset.evolveIntervalMs ?? 0, t))
              // toggle booleans only when t === 1 to avoid mid-transition visual toggles
              if (t >= 1) {
                interp.renderBothSides = gentlePreset.renderBothSides
                interp.scratchEnabled = gentlePreset.scratchEnabled
                interp.sheenEnabled = gentlePreset.sheenEnabled
              }

              workerDebugRef.current = interp
              try { setWorkerDebug(interp) } catch (err) {}

              if (t < 1) requestAnimationFrame(stepInterp)
              else {
                setLowResActive(true)
                // post evolve so worker picks up the new debug immediately
                if (workerRef.current) {
                  const infectionsArray = Array.from(infectionStateRef.current.infections.entries())
                  const stateToSend = { infections: infectionsArray, availableIndices: infectionStateRef.current.availableIndices, lastEvolutionTime: infectionStateRef.current.lastEvolutionTime, generation: infectionStateRef.current.generation }
                  sendEvolve(stateToSend, hexPositionsRef.current, photosRef.current, drawnHexRadiusRef.current, 'apply-gentle-preset')
                }
              }
            }

            requestAnimationFrame(stepInterp)
          } catch (err) { logger.warn('Failed to apply gentle fallback', err) }
        }
      }
      raf = requestAnimationFrame(check)
    }
    raf = requestAnimationFrame(check)
    return () => cancelAnimationFrame(raf)
  // read telemetry and other values from refs to avoid infinite loops and dependency array size issues - effect runs continuously via RAF
  }, [])

  // Transient heat override for batchPerFrame based on mouse movement
  const transientBatchRef = useRef<number | null>(null)
  const transientTimeoutRef = useRef<number | null>(null)

  // Cleanup transient timeout on unmount
  useEffect(() => {
    return () => {
      if (transientTimeoutRef.current) {
        window.clearTimeout(transientTimeoutRef.current)
        transientTimeoutRef.current = null
      }
    }
  }, [])

  // Rendering throttle and dirty flags to avoid unnecessary full redraws
  const lastDrawTimeRef = useRef<number>(0)
  const lastDrawGenRef = useRef<number>(0)
  const cameraDirtyRef = useRef<boolean>(true)
  // Draw cadence: 30fps when actively animating, lower cadence while static.
  const activeFrameMs = 1000 / 30
  const idleFrameMs = 250

  // Helper to get effective batchPerFrame (transient override if present)
  const getEffectiveBatch = () => {
    const base = Math.max(0, Math.floor(workerDebugRef.current?.batchPerFrame ?? 0))
    return transientBatchRef.current != null ? Math.max(base, transientBatchRef.current) : base
  }

  // Helper: find nearby candidate indices around a point using grid geometry to avoid scanning all hexes
  const findNearbyIndices = useCallback((x: number, y: number, searchRadius = 2) => {
    const candidates: number[] = []
    // Estimate grid cell from spacing. IMPORTANT: x/y should be in CANVAS pixel space
    // (matching drawing coordinates). Use drawn spacing which includes hexSpacing so
    // neighbor estimates line up with visual layout.
    const drawnHorizontalSpacing = Math.sqrt(3) * drawnHexRadius
    const drawnVerticalSpacing = 1.5 * drawnHexRadius
    // Compute approximate row first (used to determine whether row is staggered)
    const approxRow = Math.floor(y / drawnVerticalSpacing)
    // Compute approximate column. If the row is odd (staggered), compensate by
    // subtracting half the horizontal spacing so the column index lines up with
    // how positions were generated (odd rows were offset by +0.5*horizontalSpacing).
    let approxCol = Math.floor(x / drawnHorizontalSpacing)
    if ((approxRow % 2) !== 0) {
      approxCol = Math.floor((x - drawnHorizontalSpacing * 0.5) / drawnHorizontalSpacing)
    }
    // Clamp to valid column range so candidate generation can't use out-of-bounds cols
    if (typeof cols === 'number' && cols > 0) {
      if (approxCol < 0) approxCol = 0
      if (approxCol >= cols) approxCol = cols - 1
    }

    const r = Math.max(1, Math.floor(searchRadius))
    for (let dr = -r; dr <= r; dr++) {
      const row = approxRow + dr
      if (row < 0 || row >= rows) continue
      for (let dc = -r; dc <= r; dc++) {
        const col = approxCol + dc
        if (col < 0 || col >= cols) continue
        const idx = row * cols + col
        if (idx >= 0 && idx < hexPositions.length) candidates.push(idx)
      }
    }
    return candidates
  }, [horizontalSpacing, verticalSpacing, cols, rows, hexPositions])

  // Hover state for metadata overlay
  const [hoverInfo, setHoverInfo] = useState<{index: number, x: number, y: number} | null>(null)
  
  // Load textures with browser memory cache to prevent duplicate loads
  useEffect(() => {
    const textureMap = new Map<string, HTMLImageElement>()
    const uniqueImageUrls = new Set<string>()
    const photoIdToImageUrl = new Map<string, string>()
    
    // Build mapping of photo.id -> imageUrl and collect unique URLs
    photos.forEach((photo) => {
      photoIdToImageUrl.set(photo.id, photo.imageUrl)
      uniqueImageUrls.add(photo.imageUrl)
    })
    
    if (photos.length === 0) return
    
    let loadedCount = 0
    const totalUniqueImages = uniqueImageUrls.size
    const totalPhotos = photos.length
    
    // Load each unique image URL only once
    uniqueImageUrls.forEach((imageUrl) => {
      // Get the proxied URL if needed (for preview.redd.it images with CORS issues)
      const proxiedUrl = getProxiedImageUrl(imageUrl)
      
      // Check global cache first (using original URL as key)
      if (globalImageCache.has(imageUrl)) {
        const cachedImg = globalImageCache.get(imageUrl)!
        // Map all photos with this imageUrl to the cached image
        photoIdToImageUrl.forEach((url, photoId) => {
          if (url === imageUrl) {
            textureMap.set(photoId, cachedImg)
          }
        })
        loadedCount++
        if (loadedCount === totalUniqueImages) {
          setTextures(textureMap)
        }
        return
      }
      
      // Check if there's already a load in progress for this URL
      if (imageLoadPromises.has(imageUrl)) {
        imageLoadPromises.get(imageUrl)!.then((img) => {
          // Map all photos with this imageUrl to the loaded image
          photoIdToImageUrl.forEach((url, photoId) => {
            if (url === imageUrl) {
              textureMap.set(photoId, img)
            }
          })
          loadedCount++
          if (loadedCount === totalUniqueImages) {
            setTextures(textureMap)
          }
        }).catch(() => {
          loadedCount++
          if (loadedCount === totalUniqueImages) {
            setTextures(textureMap)
          }
        })
        return
      }
      
      // Create new image load promise
      const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        // Only set crossOrigin for non-proxied URLs (proxied URLs are same-origin)
        if (proxiedUrl === imageUrl) {
          img.crossOrigin = 'anonymous'
        }
        img.onload = () => {
          // Cache the loaded image globally (using original URL as key)
          globalImageCache.set(imageUrl, img)
          resolve(img)
        }
        img.onerror = () => {
          logger.warn('Failed to load image:', imageUrl, proxiedUrl !== imageUrl ? `(proxied from ${proxiedUrl})` : '')
          imageLoadPromises.delete(imageUrl)
          reject(new Error(`Failed to load image: ${imageUrl}`))
        }
        img.src = proxiedUrl
      })
      
      imageLoadPromises.set(imageUrl, loadPromise)
      
      loadPromise.then((img) => {
        // Map all photos with this imageUrl to the loaded image
        photoIdToImageUrl.forEach((url, photoId) => {
          if (url === imageUrl) {
            textureMap.set(photoId, img)
          }
        })
        imageLoadPromises.delete(imageUrl)
        loadedCount++
        if (loadedCount === totalUniqueImages) {
          setTextures(textureMap)
        }
      }).catch(() => {
        imageLoadPromises.delete(imageUrl)
        loadedCount++
        if (loadedCount === totalUniqueImages) {
          setTextures(textureMap)
        }
      })
    })
  }, [photos])

  // Track previous photos to detect actual changes (not just reference changes)
  const prevPhotosRef = useRef<string>('')
  
  // When photos actually change (not just grid dimensions), reinitialize the infection system
  // so we don't start evolving with 0 infections. This ensures seeds are placed
  // as soon as photos are available.
  // NOTE: Uses workerDebugRef.current.spawnClusterMax at init time - this is intentional
  // to avoid re-initializing every time debug settings change (only when photos/grid change)
  useEffect(() => {
    if (!photos || photos.length === 0) return

    // Create a stable key from photos to detect actual content changes
    const photosKey = photos.map(p => `${p.id}:${p.imageUrl}`).sort().join('|')
    
    // Only reinitialize if photos actually changed (not just grid dimensions)
    // Grid dimension changes are handled separately in the grid-dim-change effect above
    if (prevPhotosRef.current === photosKey) {
      return // Photos haven't changed, skip reinitialization
    }
    
    // Check if this is a filtering change (subset of previous photos) vs complete reload
  const prevPhotosKey = prevPhotosRef.current
  const prevPhotoIds: Set<string> = prevPhotosKey ? new Set<string>(prevPhotosKey.split('|').map(p => p.split(':')[0])) : new Set<string>()
    const currentPhotoIds = new Set(photos.map(p => p.id))
    
    // If current photos are a subset of previous photos, this is filtering - filter existing infections
    const isFilteringChange = prevPhotoIds.size > 0 && 
      Array.from(currentPhotoIds).every(id => prevPhotoIds.has(id)) && 
      currentPhotoIds.size < prevPhotoIds.size
    
    prevPhotosRef.current = photosKey

    if (isFilteringChange && infectionStateRef.current) {
      // Filter existing infections to remove those with filtered-out photos
      const filteredInfections = new Map<number, Infection>()
      for (const [index, infection] of infectionStateRef.current.infections.entries()) {
        if (currentPhotoIds.has(infection.photo.id)) {
          filteredInfections.set(index, infection)
        }
      }
      
      const filteredState = {
        infections: filteredInfections,
        availableIndices: infectionStateRef.current.availableIndices,
        lastEvolutionTime: infectionStateRef.current.lastEvolutionTime,
        generation: infectionStateRef.current.generation
      }
      
      blankNeighborCountGenerationRef.current = -1
      blankNeighborCountRef.current = new Map()
      setInfectionState(filteredState)
      infectionStateRef.current = filteredState

      if (workerRef.current) {
        // Send filtered state to worker with 'filter-update' message type
        const infectionsArray = Array.from(filteredInfections.entries())
        const stateToSend = {
          infections: infectionsArray,
          availableIndices: filteredState.availableIndices,
          lastEvolutionTime: filteredState.lastEvolutionTime,
          generation: filteredState.generation
        }

        if (workerDebugRef.current?.debugLogs) {
          dlog('Filtering debug: removed infections for filtered photos', {
            prevCount: infectionStateRef.current.infections.size,
            newCount: filteredInfections.size,
            filteredIds: Array.from(prevPhotoIds).filter((id: string) => !currentPhotoIds.has(id))
          })
        }

        sendEvolve(stateToSend, hexPositions, photos, drawnHexRadius, 'filter-update')
        cameraDirtyRef.current = true
      }
    } else {
      // Complete reload or first load - reinitialize infection state
      // Use the live spawnClusterMax from workerDebug when available so photo reloads honor debug tuning
      const isSpherical = gridMetadataRef.current?.isSpherical ?? false
      const initState = initializeInfectionSystem(hexPositions, photos, effectiveHexRadius, workerDebugRef.current?.spawnClusterMax ?? 8, logger, isSpherical)
      blankNeighborCountGenerationRef.current = -1
      blankNeighborCountRef.current = new Map()
      setInfectionState(initState)
      infectionStateRef.current = initState

      if (workerRef.current) {
        // Immediately post an evolve message so the worker has a valid non-empty state
        const infectionsArray = Array.from(initState.infections.entries())
        const stateToSend = {
          infections: infectionsArray,
          availableIndices: initState.availableIndices,
          lastEvolutionTime: initState.lastEvolutionTime,
          generation: initState.generation
        }

        // Log the init only if debugLogs is enabled
        if (workerDebugRef.current?.debugLogs) {
          dlog('Initialization debug', workerDebugRef.current);
        }

        sendEvolve(stateToSend, hexPositions, photos, drawnHexRadius, 'photos-init')
        // Mark dirty so the UI redraws with the new initial state
        cameraDirtyRef.current = true
      }
    }
  }, [photos, hexPositions, effectiveHexRadius, dlog])
  
  // Initialize web worker
  useEffect(() => {
    try {
      workerRef.current = new Worker('/hexgrid-worker.js')
      dlog('Worker created successfully')
      
      // Send initial data and config to worker
      if (workerRef.current && photos.length > 0) {
        // Ensure photos are serializable - include all fields needed for meritocratic system
        const serializablePhotos = photos.map(p => ({
          id: p.id,
          title: p.title,
          alt: p.alt,
          imageUrl: p.imageUrl,
          thumbnailUrl: p.thumbnailUrl,
          category: p.category,
          shopUrl: p.shopUrl,
          location: p.location,
          description: p.description,
          videoUrl: p.videoUrl,
          isVideo: p.isVideo,
          velocity: p.velocity, // CRITICAL: Required for meritocratic system
          source: p.source,
          sourceUrl: p.sourceUrl,
          views: p.views,
          likes: p.likes,
          age_in_hours: p.age_in_hours
        }))
        
        dlog(`[HexGrid] Sending initial setDataAndConfig with ${serializablePhotos.length} photos`)
        if (serializablePhotos.length > 0) {
          dlog(`[HexGrid] First photo in initial setDataAndConfig:`, serializablePhotos[0])
        }
        
        workerRef.current.postMessage({
          type: 'setDataAndConfig',
          data: {
            photos: serializablePhotos,
            positions: hexPositions,
            hexRadius: drawnHexRadius,
            isSpherical: Boolean(gridMetadataRef.current?.isSpherical),
            debug: workerDebugRef.current
          }
        })
        dlog('Sent initial setDataAndConfig to worker')
      } else if (workerRef.current && photos.length === 0) {
        logger.warn(`[HexGrid] Cannot send initial setDataAndConfig: photos array is empty`)
      }
    } catch (error) {
      logger.error('Failed to create worker:', error)
      return
    }

    // Note: sendEvolve is defined at component scope (useCallback) so effects can call it.

    // Add error handler for worker errors
    workerRef.current.onerror = (error) => {
      logger.error('Worker error:', error)
      dlog('Worker error:', error.message)
    }

    // Stream token and active flag live at component scope so other effects can inspect them
    // Note: these refs are declared above in component scope (streamTokenRef, streamActiveRef)

    // useRef-like mutable holder but scoped to effect so we can cancel between effect runs
    workerRef.current.onmessage = (e) => {
      const { type, data, error } = e.data
  dlog('Received worker message:', type)
      // Debug ack: worker confirming it received an evolve (low volume)
      if (type === 'ack-evolve') {
        try {
          if (workerDebugRef.current?.debugLogs) logger.info('[HexGrid] worker ack-evolve', data)
        } catch (e) {}
        try { setAckEvolveCount((c) => c + 1) } catch (e) {}
        return
      }
      if (type === 'evolved') {
          dlog('Received evolved message from worker', { generation: data.generation, infections: Array.isArray(data.infections) ? data.infections.length : (data.infections ? (data.infections.size ?? 0) : 0) })
          // Defensive guard: ignore evolved messages that would regress the UI state.
          try {
            const incomingGen = typeof data.generation === 'number' ? data.generation : -1
            const incomingInfCount = Array.isArray(data.infections) ? data.infections.length : (data.infections ? (data.infections.size ?? 0) : 0)
            const incomingLastTs = typeof data.lastEvolutionTime === 'number' ? data.lastEvolutionTime : null
            const currentGen = infectionStateRef.current && typeof infectionStateRef.current.generation === 'number' ? infectionStateRef.current.generation : -1
            const currentInfCount = infectionStateRef.current && infectionStateRef.current.infections ? infectionStateRef.current.infections.size : 0
            const currentLastTs = infectionStateRef.current && typeof infectionStateRef.current.lastEvolutionTime === 'number' ? infectionStateRef.current.lastEvolutionTime : null

            // Skip if incoming generation is older than what the UI already has.
            if (incomingGen < currentGen) {
              dlog('Skipping evolved message: incoming generation older than current', { incomingGen, currentGen, incomingInfCount, currentInfCount, incomingLastTs, currentLastTs })
              return
            }

            // If lastEvolutionTime is available on both sides, skip if the incoming timestamp is older.
            if (incomingLastTs != null && currentLastTs != null && incomingLastTs < currentLastTs) {
              dlog('Skipping evolved message: incoming lastEvolutionTime older than current', { incomingGen, currentGen, incomingInfCount, currentInfCount, incomingLastTs, currentLastTs })
              return
            }

            // Skip if incoming has zero infections while UI already has infections.
            // This prevents a late/empty auto-trigger from wiping a valid state.
            if (incomingInfCount === 0 && currentInfCount > 0) {
              dlog('Skipping evolved message: incoming has 0 infections while current UI has infections', { incomingGen, currentGen, incomingInfCount, currentInfCount, incomingLastTs, currentLastTs })
              return
            }
          } catch (guardErr) {
            // If the guard fails for any reason, continue processing to avoid silencing valid updates.
            dlog('evolved guard exception, proceeding to process message', guardErr)
          }
          dlog('Processing evolved state with', data.infections.length, 'gossip entries')
        // Convert back from array to Map
        const newInfectionsMap = new Map<number, Infection>(data.infections)
        if (Array.isArray(data.blankNeighborCounts)) {
          try {
            blankNeighborCountRef.current = new Map<number, number>(data.blankNeighborCounts as [number, number][])
            blankNeighborCountGenerationRef.current = typeof data.generation === 'number' ? data.generation : -1
          } catch (err) {
            // ignore malformed worker payload
          }
        } else {
          // Fallback to local computation when worker payload doesn't include counts.
          blankNeighborCountGenerationRef.current = -1
          blankNeighborCountRef.current = new Map()
        }

        // Capture tile centers for debug visualization if available
        if (data.tileCenters && Array.isArray(data.tileCenters)) {
          try {
            setTileCenters(data.tileCenters)
            dlog('Received', data.tileCenters.length, 'tile center sets from worker')
          } catch (e) {
            dlog('Failed to set tile centers:', e)
          }
        }

        // Process narration data if available
        if (data.narrationData && narrationEngineRef.current && statsTrackerRef.current) {
          try {
            const { photoTerritories, photoVelocities, photoTitles, totalHexes, availableHexes, births, deaths } = data.narrationData

            const territoriesMap = new Map<string, number>(photoTerritories as [string, number][])
            const velocitiesMap = new Map<string, number>(photoVelocities as [string, number][])
            const titlesMap = new Map<string, string>(photoTitles as [string, string][])

            const messages = narrationEngineRef.current.generateNarration(
              data.generation,
              territoriesMap,
              velocitiesMap,
              titlesMap,
              totalHexes,
              availableHexes,
              births,
              deaths
            )

            if (messages.length > 0) {
              setNarrationMessages(prev => [...prev, ...messages].slice(-50))
            }

            // Persist stats to localStorage (debounced)
            try {
              const statsJson = statsTrackerRef.current.exportState()
              localStorage.setItem('automata-stats', statsJson)
            } catch (e) {
              logger.warn('Failed to save stats to localStorage:', e)
            }

            // Notify parent component of leaderboard update (for autoplay queue filtering)
            if (onLeaderboardUpdate && statsTrackerRef.current) {
              try {
                const leaderboard = statsTrackerRef.current.getLeaderboard(1000) // Get up to 1000 for autoplay filtering
                onLeaderboardUpdate(leaderboard)
              } catch (e) {
                logger.warn('Failed to get leaderboard:', e)
              }
            }
          } catch (e) {
            logger.error('Error processing narration:', e)
          }
        }

        const prevState = infectionStateRef.current
        const prevMap = prevState.infections

        // Build list of changes (add, update, remove)
        type Change = { type: 'add'|'update'|'remove', index: number, infection?: Infection }
        const changes: Change[] = []

        // additions and updates
        newInfectionsMap.forEach((inf, idx) => {
          const prev = prevMap.get(idx)
          if (!prev) {
            changes.push({ type: 'add', index: idx, infection: inf })
          } else {
            // simple equality check for now: photo id or uvBounds or generation changed
            const uvSame = prev.uvBounds[0] === inf.uvBounds[0] && prev.uvBounds[1] === inf.uvBounds[1] && prev.uvBounds[2] === inf.uvBounds[2] && prev.uvBounds[3] === inf.uvBounds[3]
            if (prev.photo.id !== inf.photo.id || !uvSame || prev.generation !== inf.generation) {
              changes.push({ type: 'update', index: idx, infection: inf })
            }
          }
        })

        // removals
        prevMap.forEach((inf, idx) => {
          if (!newInfectionsMap.has(idx)) {
            changes.push({ type: 'remove', index: idx })
          }
        })

        // If no changes, just replace state
        if (changes.length === 0) {
          streamTouchesOccupancyRef.current = false
          setInfectionState({
            infections: newInfectionsMap,
            availableIndices: data.availableIndices,
            lastEvolutionTime: data.lastEvolutionTime,
            generation: data.generation
          })
          infectionStateRef.current = {
            infections: newInfectionsMap,
            availableIndices: data.availableIndices,
            lastEvolutionTime: data.lastEvolutionTime,
            generation: data.generation
          }
          return
        }

        // Start streaming changes; cancel any previous streamer.
        streamTokenRef.current += 1
        const token = streamTokenRef.current
        streamTouchesOccupancyRef.current = changes.some((ch) => ch.type !== 'update')

        // Mark streaming active so other code (animation loop) can avoid posting new evolves
        streamActiveRef.current = true
        try { setStreamingActive(true) } catch (err) { /* ignore during unmount */ }
        try {
          if (workerDebugRef.current?.debugLogs) logger.info('[HexGrid] stream START token=', token, 'changes=', changes.length)
        } catch (err) {}
        // Mark camera dirty so cancelled streams trigger a redraw
        cameraDirtyRef.current = true

  const streamMs = Math.max(0, (workerDebugRef.current?.streamMs ?? 24))
  const batchPerFrame = Math.max(0, Math.floor(getEffectiveBatch()))

        // Work on a copy of the previous infections map to apply incremental changes
        const workingMap = new Map<number, Infection>(prevMap)

        if (batchPerFrame > 0) {
          // Batched per-frame mode
          setTilesRemaining(changes.length)
          let idx = 0

          const applyFrame = () => {
            try {
              // stop if cancelled
              if (streamTokenRef.current !== token) {
                streamActiveRef.current = false
                streamTouchesOccupancyRef.current = false
                try { setStreamingActive(false) } catch (err) {}
                try { if (workerDebugRef.current?.debugLogs) logger.info('[HexGrid] stream CANCEL token=', token) } catch (err) {}
                return
              }

              const count = Math.min(batchPerFrame, changes.length - idx)
              for (let i = 0; i < count; i++, idx++) {
                const ch = changes[idx]
                if (!ch) continue
                if (ch.type === 'add' || ch.type === 'update') {
                  workingMap.set(ch.index, ch.infection!)
                  try { tilePulseRef.current.set(ch.index, { start: performance.now(), duration: 400 }) } catch (err) {}
                } else if (ch.type === 'remove') {
                  workingMap.delete(ch.index)
                }
              }

              const newState = {
                infections: new Map(workingMap),
                availableIndices: data.availableIndices,
                lastEvolutionTime: data.lastEvolutionTime,
                generation: data.generation
              }

              infectionStateRef.current = newState
              setInfectionState(newState)
              try { setTilesRemaining((v) => Math.max(0, v - count)) } catch (err) {}

              if (idx < changes.length) {
                if (streamMs > 0) setTimeout(() => requestAnimationFrame(applyFrame), streamMs)
                else requestAnimationFrame(applyFrame)
              } else {
                streamActiveRef.current = false
                streamTouchesOccupancyRef.current = false
                try { setStreamingActive(false) } catch (err) {}
                try { if (workerDebugRef.current?.debugLogs) logger.info('[HexGrid] stream END token=', token) } catch (err) {}
              }
            } catch (err) {
              // Ensure we never leave streaming active on exception. Cancel the stream and bump token to stop any pending frames.
              try { logger.error('[HexGrid] stream applyFrame error:', err) } catch (e) {}
              try { if (workerDebugRef.current?.debugLogs) logger.error('[HexGrid] stream error token=', token, err) } catch (e) {}
              // Cancel stream and mark inactive so animation loop can continue
              try { streamTokenRef.current += 1 } catch (e) {}
              try { streamActiveRef.current = false } catch (e) {}
              try { streamTouchesOccupancyRef.current = false } catch (e) {}
              try { setStreamingActive(false) } catch (e) {}
            }
          }

          requestAnimationFrame(applyFrame)
        } else {
          // Legacy per-tile async streaming
          (async () => {
            try {
              setTilesRemaining(changes.length)
              for (const ch of changes) {
                if (streamTokenRef.current !== token) return
                if (ch.type === 'add' || ch.type === 'update') {
                  workingMap.set(ch.index, ch.infection!)
                  try { tilePulseRef.current.set(ch.index, { start: performance.now(), duration: 400 }) } catch (err) {}
                } else if (ch.type === 'remove') {
                  workingMap.delete(ch.index)
                }

                const newState = {
                  infections: new Map(workingMap),
                  availableIndices: data.availableIndices,
                  lastEvolutionTime: data.lastEvolutionTime,
                  generation: data.generation
                }

                infectionStateRef.current = newState
                setInfectionState(newState)
                try { setTilesRemaining((v) => Math.max(0, v - 1)) } catch (err) {}
                await new Promise((resolve) => setTimeout(resolve, streamMs))
              }
            } catch (err) {
              try { logger.error('[HexGrid] stream (per-tile) error:', err) } catch (e) {}
              try { if (workerDebugRef.current?.debugLogs) logger.error('[HexGrid] stream (per-tile) error token=', token, err) } catch (e) {}
              // bump token to cancel any concurrent streams
              try { streamTokenRef.current += 1 } catch (e) {}
            } finally {
              streamActiveRef.current = false
              streamTouchesOccupancyRef.current = false
              try { setStreamingActive(false) } catch (err) {}
            }
          })()
        }
      } else if (type === 'error') {
        logger.error('Worker error:', error)
      }
    }
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
      }
    }
  }, [])
  
  // Draw function
  const draw = useCallback(() => {
    const start = performance.now()
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear canvas
    ctx.fillStyle = '#001122'
    ctx.fillRect(0, 0, screenWidth, screenHeight)
    
    const infections = infectionState.infections
    const dbg = workerDebugRef.current
    const projectedPositions = projectedPositionsRef.current
    const pulseMap = tilePulseRef.current
    const prevAlphaMap = tileAlphaRef.current
    const smooth = Math.max(0, Math.min(1, dbg?.translucencySmoothing ?? 0.08))
    const scratchEnabled = !!dbg?.scratchEnabled
    const sheenIntensity = dbg?.sheenIntensity ?? 0.12
    const sheenEnabled = !!dbg?.sheenEnabled
    const seamInset = dbg?.clusterUvInset ?? 0.0
    const isSpherical = gridMetadataRef.current?.isSpherical ?? false

    const computeLocalBlankNeighborCounts = (): Map<number, number> => {
      const cache = localBlankNeighborCacheRef.current
      if (
        cache.infectionMap === infections &&
        cache.positions === hexPositions &&
        cache.hexRadius === drawnHexRadius
      ) {
        return cache.counts
      }
      const infectedIndices = Array.from(infections.keys())
      const infectedSet = new Set<number>(infectedIndices)
      const computed = new Map<number, number>()
      for (const idx of infectedIndices) {
        if (idx < 0 || idx >= hexPositions.length) continue
        const neighbors = getNeighbors(idx, hexPositions, drawnHexRadius, isSpherical)
        let count = 0
        for (const n of neighbors) {
          if (!infectedSet.has(n)) count++
        }
        computed.set(idx, count)
      }
      localBlankNeighborCacheRef.current = {
        infectionMap: infections,
        positions: hexPositions,
        hexRadius: drawnHexRadius,
        counts: computed
      }
      return computed
    }

    const canUseWorkerBlankCounts =
      blankNeighborCountRef.current.size > 0 &&
      blankNeighborCountGenerationRef.current === infectionState.generation &&
      !(streamActiveRef.current && streamTouchesOccupancyRef.current)

    const blankNeighborCount = canUseWorkerBlankCounts
      ? blankNeighborCountRef.current
      : computeLocalBlankNeighborCounts()

    // compute sheen progress using configured speed
    const sheenSpeed = Math.max(0.1, dbg?.sheenSpeed || 10)
    const now = performance.now()
    const sheenProgress = ((now / 1000) % sheenSpeed) / sheenSpeed

    // Draw hexagons (with alpha smoothing)
    // GUARD: Only draw valid hexagons - either infected OR explicitly marked as background
      // selective culling parameters (adaptive)
      const baseSample = Math.max(1, lowResSampleStepRef.current || 1)
      let sampleStep = baseSample
      let minProjectedScale = 0.35 // baseline
      if (lowResActive) {
        const fps = telemetry?.fps || 0
        if (fps === 0) {
          sampleStep = Math.max(baseSample, 3)
          minProjectedScale = 0.45
        } else if (fps <= 15) {
          sampleStep = Math.max(baseSample, 4)
          minProjectedScale = 0.55
        } else if (fps <= 22) {
          sampleStep = Math.max(baseSample, 3)
          minProjectedScale = 0.45
        } else if (fps <= 30) {
          sampleStep = Math.max(baseSample, 2)
          minProjectedScale = 0.35
        } else {
          sampleStep = 1
          minProjectedScale = 0.25
        }
      } else {
        sampleStep = 1
        minProjectedScale = 0.0
      }

  for (let index = 0; index < hexPositions.length; index++) {
  const position = hexPositions[index]
  if (!position) continue

  const infection = infections.get(index)

      const blankCount = infection ? (blankNeighborCount.get(index) || 0) : 0

      // target alpha based on blank count
      const targetAlpha = infection ? (1.0 - Math.min(blankCount, 6) * 0.066) : 1.0
      const prev = prevAlphaMap.get(index) ?? targetAlpha
      const smoothed = prev + (targetAlpha - prev) * smooth
      prevAlphaMap.set(index, smoothed)

      // Compute pulse progress for this tile
      const pulseInfo = pulseMap.get(index)
      let pulseProgress = 0
      if (pulseInfo) {
        const elapsed = now - pulseInfo.start
        pulseProgress = Math.max(0, Math.min(1, elapsed / pulseInfo.duration))
        if (pulseProgress >= 1) pulseMap.delete(index)
      }

      // Use projected position and scale for drawing
  const proj = projectedPositions[index]
  const projX = proj ? proj[0] : position[0]
  const projY = proj ? proj[1] : position[1]
  const projScale = proj ? proj[2] : 1
  const projAngle = proj ? (proj[3] || 0) : 0
  // proj[4] is z-depth (not needed for drawing, only for click detection)

      // Selective culling: when low-res mode is active, always draw infected tiles but
      // sample uninfected/background tiles to reduce draw count while preserving layout.
      if (lowResActive) {
        if (!infection) {
          // skip most background tiles according to the sampling step
          if ((index % sampleStep) !== 0) continue
          // also skip tiles that project very small to avoid wasted draws
          if (projScale < minProjectedScale) continue
        }
      }

      // Draw primary - use drawnHexRadius to account for spacing
  drawHexagon(ctx, [projX, projY, 0], drawnHexRadius * projScale, infection, textures, index, blankCount, smoothed, sheenProgress, sheenIntensity, sheenEnabled, scratchEnabled, scratchCanvasRef.current, seamInset, pulseProgress, false, false, projAngle)

      // Optionally draw antipodal copy (opposite side of sphere).
      // Use the same projection helper as hit-tests so angles/positions match exactly.
      if (dbg?.renderBothSides) {
        try {
          const anti = mapAndProject(hexPositions[index], true)
          const antiScale = (anti as any).scale || 1
          const antiAngle = (anti as any).angle || 0
          drawHexagon(ctx, [anti.x, anti.y, 0], drawnHexRadius * antiScale, infection, textures, index, blankCount, smoothed, sheenProgress, sheenIntensity, sheenEnabled, scratchEnabled, scratchCanvasRef.current, seamInset, pulseProgress, false, true, antiAngle)
        } catch (err) {
          // Skip drawing antipodal hex if projection fails
          // (better to not draw than to draw in wrong location)
          if (workerDebugRef.current?.debugLogs) {
            logger.warn('Failed to project antipodal hex, skipping', { index, err })
          }
        }
      }
    }
    // Dev-only adjacency verification: check a few neighbor pairs to ensure pixel rects are contiguous
    // This helps debug alignment issues caused by UV mapping or aspect ratio mismatches
    try {
      if (workerDebugRef.current?.debugLogs) {
        // Sample a few random infected hexes to check
        const infectedIndices = Array.from(infections.keys())
        const sampleSize = Math.min(5, infectedIndices.length)
        for (let s = 0; s < sampleSize; s++) {
          const idx = infectedIndices[Math.floor(Math.random() * infectedIndices.length)]
          const infection = infections.get(idx)
          if (!infection) continue
          
          const texture = textures.get(infection.photo.id)
          if (!texture) continue
          
          const rect1 = uvBoundsToSrcRect(infection.uvBounds, texture)
          const isSpherical = gridMetadataRef.current?.isSpherical ?? false
          const neighbors = getNeighbors(idx, hexPositions, drawnHexRadius, isSpherical)
          
          for (const nIdx of neighbors) {
            const nInf = infections.get(nIdx)
            // Only check neighbors with the same photo (adjacent tiles of same image)
            if (!nInf || nInf.photo.id !== infection.photo.id) continue
            
            const rect2 = uvBoundsToSrcRect(nInf.uvBounds, texture)
            
            // Check horizontal contiguity: rect2 should start where rect1 ends (perfect alignment)
            const hContiguous = Math.abs((rect1.srcX + rect1.srcW) - rect2.srcX) <= 0 || Math.abs((rect2.srcX + rect2.srcW) - rect1.srcX) <= 0
            // Check vertical contiguity: rect2 should start where rect1 ends (perfect alignment)
            const vContiguous = Math.abs((rect1.srcY + rect1.srcH) - rect2.srcY) <= 0 || Math.abs((rect2.srcY + rect2.srcH) - rect1.srcY) <= 0
            
            if (!hContiguous && !vContiguous) {
              logger.warn('[adjacency check] Adjacent hexes have non-contiguous pixel rects:', {
                idx1: idx,
                idx2: nIdx,
                photoId: infection.photo.id,
                photoTitle: infection.photo.title,
                imageSize: { width: texture.width, height: texture.height },
                uvBounds1: infection.uvBounds,
                uvBounds2: nInf.uvBounds,
                rect1,
                rect2,
                gridPosition1: infection.gridPosition,
                gridPosition2: nInf.gridPosition,
                clusterSize: { tilesX: infection.tilesX, tilesY: infection.tilesY },
                gap: {
                  horizontal: Math.min(Math.abs((rect1.srcX + rect1.srcW) - rect2.srcX), Math.abs((rect2.srcX + rect2.srcW) - rect1.srcX)),
                  vertical: Math.min(Math.abs((rect1.srcY + rect1.srcH) - rect2.srcY), Math.abs((rect2.srcY + rect2.srcH) - rect1.srcY))
                }
              })
            }
          }
        }
      }
    } catch (err) {
      // ignore adjacency check errors
    }

    // Optional mapping debug overlay: draw desiredRadius as small markers when enabled
    try {
      if (showMappingDebug) {
        ctx.save()
        ctx.fillStyle = 'rgba(255,80,80,0.9)'
        for (let i = 0; i < projectedPositionsRef.current.length; i++) {
          const p = projectedPositionsRef.current[i]
          if (!p) continue
          const md = (p[5] && typeof p[5] === 'object' && p[5].mappingDebug) ? p[5].mappingDebug : null
          if (!md || !md.desiredRadius) continue
          const cx = p[0]
          const cy = p[1]
          const r = Math.max(1, Math.min(12, md.desiredRadius))
          ctx.beginPath()
          ctx.arc(cx, cy, 2, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }
    } catch (err) {
      // ignore debug overlay errors
    }
    // Tile labels overlay: show gridPosition (tile coords) on each infected hex when enabled
    try {
      const showTileLabels = (() => {
        try { return workerDebugRef.current?.showTileLabels === true } catch (e) { return false }
      })()
      if (showTileLabels) {
        ctx.save()
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.font = '10px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        for (let i = 0; i < projectedPositionsRef.current.length; i++) {
          const p = projectedPositionsRef.current[i]
          if (!p) continue
          const inf = infectionState.infections.get(i)
          if (!inf) continue
          const gp = inf.gridPosition || null
          const label = gp ? `${gp[0]},${gp[1]}` : '·'
          ctx.fillText(label, p[0], p[1])
        }
        ctx.restore()
      }
    } catch (err) {
      // ignore
    }
    // Tile centers overlay: show computed tile centers as + markers when enabled
    try {
      const showTileCenters = (() => {
        try { return workerDebugRef.current?.showTileCenters === true } catch (e) { return false }
      })()
      if (showTileCenters && tileCenters.length > 0) {
        ctx.save()
        ctx.strokeStyle = 'rgba(255,100,100,0.75)'
        ctx.lineWidth = 1
        const markerSize = 4
        for (const clusterData of tileCenters) {
          for (const center of clusterData.centers) {
            // Project the 3D center position to 2D screen
            const projected = mapAndProject([center.x, center.y, 0])
            if (!projected) continue
            const sx = projected.x
            const sy = projected.y
            // Draw a small + marker
            ctx.beginPath()
            ctx.moveTo(sx - markerSize, sy)
            ctx.lineTo(sx + markerSize, sy)
            ctx.moveTo(sx, sy - markerSize)
            ctx.lineTo(sx, sy + markerSize)
            ctx.stroke()
          }
        }
        ctx.restore()
      }
    } catch (err) {
      // ignore
    }
    // record draw timing
    try {
      const drawMs = performance.now() - start
      const buf = drawTimesRef.current
      buf.push(drawMs)
      if (buf.length > 300) buf.shift()
    } catch (err) {}
  }, [hexPositions, infectionState.infections, textures, drawnHexRadius, screenWidth, screenHeight, mapAndProject, telemetry.fps, tileCenters])
  
  // Continuous evolution using web worker
  useEffect(() => {
    let animationId: number
    let lastTime = 0
    
    // Setup scratch canvas once
      // Only create scratch canvas when scratch overlay is enabled to avoid
      // unnecessary allocations when the effect is turned off.
      if (!scratchCanvasRef.current && workerDebugRef.current?.scratchEnabled) {
        const sc = document.createElement('canvas')
        sc.width = 64
        sc.height = 64
        const sctx = sc.getContext('2d')
        if (sctx) {
          // fill with transparent
          sctx.clearRect(0, 0, sc.width, sc.height)
          sctx.globalAlpha = 0.06
          for (let i = 0; i < 120; i++) {
            sctx.strokeStyle = `rgba(255,255,255,${Math.random() * 0.25})`
            sctx.lineWidth = Math.random() * 1.2
            sctx.beginPath()
            const x1 = Math.random() * sc.width
            const y1 = Math.random() * sc.height
            const x2 = x1 + (Math.random() - 0.5) * 12
            const y2 = y1 + (Math.random() - 0.5) * 12
            sctx.moveTo(x1, y1)
            sctx.lineTo(x2, y2)
            sctx.stroke()
          }
        }
        scratchCanvasRef.current = sc
      }

    const animate = (currentTime: number) => {
      // update sheen only when enabled to avoid unnecessary work
      if (workerDebugRef.current?.sheenEnabled) {
        sheenRef.current = (currentTime / 1000) % 10 // 10s loop
      } else {
        sheenRef.current = 0
      }
      // Throttle full redraws when nothing changed (camera or infection updates)
      const now = performance.now()
      const timeSinceLast = now - (lastDrawTimeRef.current || 0)
      // If camera changed recently or infections changed (generation advanced), draw immediately
      const gen = infectionState.generation
      const genChanged = gen !== lastDrawGenRef.current
      const hasVisualAnimation = !!workerDebugRef.current?.sheenEnabled || tilePulseRef.current.size > 0 || streamActiveRef.current
      const targetFrameMs = hasVisualAnimation ? activeFrameMs : idleFrameMs
      if (cameraDirtyRef.current || genChanged || timeSinceLast >= targetFrameMs) {
        draw()
        lastDrawTimeRef.current = now
        lastDrawGenRef.current = gen
        cameraDirtyRef.current = false
      }
      
  // Clamp a conservative minimum to avoid posting evolves too frequently (console spam + worker churn).
  // Previously the hard minimum was 100ms which allowed spamming during animation loops; raise to 1000ms.
  const evolveInterval = Math.max(1000, workerDebugRef.current?.evolveIntervalMs ?? 800)
          if (currentTime - lastTime >= evolveInterval && workerRef.current && workerDebugRef.current?.evolutionEnabled !== false && !modalOpen) {
        // If we're currently streaming a previous evolved state to the UI,
        // avoid posting another evolve to the worker to prevent overlapping runs.
        if (streamActiveRef.current) {
          // Skip posting this tick — don't advance lastTime so we'll try again soon
          try { if (workerDebugRef.current?.debugLogs) logger.debug('[HexGrid] Skipping evolve post because streaming is active') } catch (err) {}
        } else if (!photos || photos.length === 0) {
          // Skip sending evolve messages when no photos are loaded yet
          try { if (workerDebugRef.current?.debugLogs) logger.debug('[HexGrid] Skipping evolve post because no photos loaded') } catch (err) {}
          // Don't advance lastTime so we'll try again once photos are loaded
        } else {
          try { if (workerDebugRef.current?.debugLogs) logger.debug('[HexGrid] Posting evolve (animation-loop)', { currentTime, evolveInterval, generation: infectionStateRef.current.generation, infections: infectionStateRef.current.infections.size }) } catch (err) {}
          dlog('Sending evolve message to worker at time:', currentTime, 'Current gossip count:', infectionStateRef.current.infections.size)
          dlog('Photos being sent to worker:', photos?.length || 0, 'photos')
          // Convert Map to array for serialization
          const infectionsArray = Array.from(infectionStateRef.current.infections.entries())
          const stateToSend = {
            infections: infectionsArray,
            availableIndices: infectionStateRef.current.availableIndices,
            lastEvolutionTime: infectionStateRef.current.lastEvolutionTime,
            generation: infectionStateRef.current.generation
          }

          // Use memoized serializable photos to avoid deep-cloning and allocations every frame
          const serializablePhotos = serializablePhotosMemoRef.current ?? photos.map(p => ({
            id: p.id,
            title: p.title,
            alt: p.alt,
            imageUrl: p.imageUrl,
            thumbnailUrl: p.thumbnailUrl,
            category: p.category,
            shopUrl: p.shopUrl,
            location: p.location,
            description: p.description,
            videoUrl: p.videoUrl,
            isVideo: p.isVideo,
            velocity: p.velocity, // CRITICAL: Required for meritocratic system
            source: p.source,
            sourceUrl: p.sourceUrl,
            views: p.views,
            likes: p.likes,
            age_in_hours: p.age_in_hours
          }))

          dlog('Serializable photos created:', serializablePhotos.length, 'photos')
          if (photos.length > 0) {
            dlog('First photo object:', photos[0])
            dlog('First serializable photo:', serializablePhotos[0])
          }

          try {
            // Use centralized sendEvolve to ensure generation is preserved and serialized correctly
            sendEvolve(stateToSend, hexPositions, serializablePhotos, drawnHexRadius, 'animation-loop')
            if (workerDebugRef.current?.debugLogs) dlog('Posted evolve message to worker (via sendEvolve)')
          } catch (error) {
            logger.error('Failed to post message to worker:', error)
            dlog('Failed to post message to worker:', error)
          }
          lastTime = currentTime
        }
      }
      animationId = requestAnimationFrame(animate)
    }
    
    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [hexPositions, photos, effectiveHexRadius, draw, modalOpen])
  
  // DEBUG: Function to spawn a cluster at a specific hexagon index
  const spawnClusterAt = useCallback((centerIndex: number) => {
    if (!photos.length) return
    
    // GUARD: Validate the center index before spawning
    if (centerIndex < 0 || centerIndex >= hexPositions.length) {
      logger.error('spawnClusterAt: Invalid center index', centerIndex)
      return
    }
    
    blankNeighborCountGenerationRef.current = -1
    blankNeighborCountRef.current = new Map()
    setInfectionState(prevState => {
      const newInfections = new Map(prevState.infections)
      const newAvailableIndices = [...prevState.availableIndices]
      
      // Remove center index from available if it's there
      const centerAvailIndex = newAvailableIndices.indexOf(centerIndex)
      if (centerAvailIndex !== -1) {
        newAvailableIndices.splice(centerAvailIndex, 1)
      }
      
      // Choose random photo
      const randomPhoto = photos[Math.floor(Math.random() * photos.length)]
      
      // Decide cluster size: sample from a normal distribution (most small, some large)
      const maxCluster = Math.max(1, Math.floor(workerDebugRef.current?.spawnClusterMax || 3))
      // Box-Muller transform for approx normal(0,1)
      function gaussianRandom() {
        let u = 0, v = 0
        while (u === 0) u = Math.random()
        while (v === 0) v = Math.random()
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
      }
      // mean near 1.5, stddev proportional to maxCluster
      const mean = Math.max(1, maxCluster / 3)
      const stddev = Math.max(0.5, maxCluster / 3)
      let raw = Math.round(mean + gaussianRandom() * stddev)
      // clamp into [1, maxCluster]
      raw = Math.max(1, Math.min(maxCluster, raw))
      const clusterSize = raw
      
      // Start with center hexagon
      const clusterIndices = [centerIndex]
      
      // Add neighboring hexagons to form cluster
      const availableNeighbors: number[] = []
      const isSpherical = gridMetadataRef.current?.isSpherical ?? false
      const neighbors = getNeighbors(centerIndex, hexPositions, drawnHexRadius, isSpherical)
      
      for (const neighborIndex of neighbors) {
        if (!newInfections.has(neighborIndex) && newAvailableIndices.includes(neighborIndex)) {
          availableNeighbors.push(neighborIndex)
        }
      }
      
      // Shuffle available neighbors
      for (let i = availableNeighbors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = availableNeighbors[i]
        availableNeighbors[i] = availableNeighbors[j]
        availableNeighbors[j] = tmp
      }
      
      // Add hexagons to cluster (up to clusterSize - 1 more)
      for (let i = 1; i < clusterSize && availableNeighbors.length > 0; i++) {
        const nextIndex = availableNeighbors.pop()!
        clusterIndices.push(nextIndex)
        
        // Remove from available
        const availIndex = newAvailableIndices.indexOf(nextIndex)
        if (availIndex !== -1) {
          newAvailableIndices.splice(availIndex, 1)
        }
      }
      
      // Create infections for all hexagons in cluster
      for (const index of clusterIndices) {
        // GUARD: Validate each cluster member index
        if (index < 0 || index >= hexPositions.length) {
          logger.error('spawnClusterAt: Invalid cluster member index', index)
          continue
        }
        
        newInfections.set(index, {
          photo: randomPhoto,
          gridPosition: [0, 0], // Will be recalculated by optimization
          infectionTime: Date.now() / 1000,
          generation: prevState.generation + 1,
          uvBounds: calculateUvBoundsFromGridPosition(0, 0, 4, 4), // Will be recalculated by optimization
          // Slightly smaller scales and slower growth so clusters need more time to connect
          scale: 0.2 + Math.random() * 0.3,
          growthRate: 0.06 + Math.random() * 0.08,
          tilesX: 4,
          tilesY: 4
        })
      }
      
      dlog(`Spawned cluster of ${clusterIndices.length} hexagons with photo: ${randomPhoto.title}`)
      
      return {
        infections: newInfections,
        availableIndices: newAvailableIndices,
        lastEvolutionTime: prevState.lastEvolutionTime,
        generation: prevState.generation + 1
      }
    })
  }, [photos, hexPositions, effectiveHexRadius, dlog])
  
  // Handle mouse interaction with DEPTH-SORTED hit testing to fix click targeting
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    // Prevent click from firing after a double tap
    if (doubleTapRef.current.justDoubleTapped) {
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    
  const rect = canvas.getBoundingClientRect()
  // Account for potential CSS scaling of canvas: map client coordinates to canvas pixel space
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const x = (event.clientX - rect.left) * scaleX
  const y = (event.clientY - rect.top) * scaleY
    
    // CRITICAL FIX: Collect ALL hexagons under the click point, then sort by depth
    // This ensures we select the closest hexagon when multiple hexagons overlap in screen space
    type Candidate = { index: number; depth: number; isAntipodal: boolean; infection?: Infection }
    const candidates: Candidate[] = []
    
    // Pass 1: Find all hexagons that contain the click point (2D hit test)
    for (let i = 0; i < hexPositions.length; i++) {
      // Validate index bounds
      if (i < 0 || i >= hexPositions.length) continue
      
      const pos = projectedPositionsRef.current[i] || [hexPositions[i][0], hexPositions[i][1], 1, 0, 0]
      const infection = infectionStateRef.current.infections.get(i)
      const scale = pos[2] || 1
      const radius = drawnHexRadius * scale
      const projAngle = pos[3] || 0
      const depth = pos[4] || 0

      // Check primary side
      if (isPointInHexagon(x, y, [pos[0], pos[1], 0], radius, projAngle)) {
        candidates.push({ index: i, depth, isAntipodal: false, infection })
      }

      // If configured, also check the antipodal (inside) projection
      if (workerDebug.renderBothSides) {
        try {
          const anti = mapAndProject(hexPositions[i], true)
          const antiScale = anti.scale || 1
          const antiRadius = drawnHexRadius * antiScale
          const antiAngle = (anti as any).angle || 0
          const antiDepth = (anti as any).z || 0
          if (isPointInHexagon(x, y, [anti.x, anti.y, 0], antiRadius, antiAngle)) {
            candidates.push({ index: i, depth: antiDepth, isAntipodal: true, infection })
          }
        } catch (err) {
          // ignore projection errors
        }
      }
    }
    
    // Pass 2: Sort candidates by depth (closest first)
    // For outside view: smaller depth = closer (depth is camZ - z3)
    // For inside view: larger depth = closer (depth is z3, positive = in front)
    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        if (insideView) {
          // Inside view: larger Z = closer to camera
          return b.depth - a.depth
        } else {
          // Outside view: smaller depth = closer to camera
          return a.depth - b.depth
        }
      })
      
      // Pass 3: Take the first (closest) candidate
      const winner = candidates[0]
      // Re-fetch infection from ref using the winner's index to ensure we have the latest data
      const infection = infectionStateRef.current.infections.get(winner.index)
      
      if (workerDebugRef.current?.debugLogs) {
        dlog(`Click at (${x.toFixed(1)}, ${y.toFixed(1)}): Found ${candidates.length} candidates, selected index ${winner.index} (depth=${winner.depth.toFixed(2)}, antipodal=${winner.isAntipodal})`)
      }
      
      // Trigger action
      if (infection?.photo && onHexClick) {
        if (workerDebugRef.current?.debugLogs) {
          dlog(`Click: Opening photo for hex ${winner.index}: ${infection.photo.id} - ${infection.photo.title}`)
        }
        handleHexClick(infection.photo)
      } else if (!infection) {
        // Only allow spawning on explicitly empty cells (not ghost cells)
        dlog(`Spawning cluster at hexagon ${winner.index}${winner.isAntipodal ? ' (antipodal)' : ''}`)
        spawnClusterAt(winner.index)
      }
    }
  }, [hexPositions, effectiveHexRadius, handleHexClick, mapAndProject, workerDebug, drawnHexRadius, insideView, spawnClusterAt])
  
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <canvas
        ref={canvasRef}
        width={screenWidth}
        height={screenHeight}
        onClick={handleCanvasClick}
        onMouseMove={(e) => {
          const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
          // Map client coords into canvas pixel coordinates for hit-testing/hover
          const canvasEl = e.target as HTMLCanvasElement
          const scaleX = canvasEl.width / rect.width
          const scaleY = canvasEl.height / rect.height
          const x = (e.clientX - rect.left) * scaleX
          const y = (e.clientY - rect.top) * scaleY
          // drag-to-rotate handling (left mouse button drag)
          const isDragging = dragRef.current.active
          if (isDragging) {
            const now = performance.now()
            const dx = e.clientX - dragRef.current.startX
            const dy = e.clientY - dragRef.current.startY
            // sensitivity: degrees per pixel (scale with distance multiplier)
            const sensX = 0.25 * (camDistanceMultiplier || 1)
            const sensY = 0.25 * (camDistanceMultiplier || 1)
            // startYaw/startPitch are stored in display-space (respects invertYaw when written)
            const newDisplayYaw = dragRef.current.startYaw + dx * sensX
            const newPitch = dragRef.current.startPitch + dy * sensY
            const newYaw = invertYaw ? -newDisplayYaw : newDisplayYaw

            // velocity estimation for inertia (incremental movement in px/s)
            const deltaX = e.clientX - dragRef.current.lastX
            const deltaY = e.clientY - dragRef.current.lastY
            const dt = Math.max(1, now - dragRef.current.lastT)
            const vx = (deltaX / dt) * 1000 // px/s
            const vy = (deltaY / dt) * 1000 // px/s
            dragRef.current.vx = vx
            dragRef.current.vy = vy
            dragRef.current.lastX = e.clientX
            dragRef.current.lastY = e.clientY
            dragRef.current.lastT = now
            try { dlog('HexGrid: drag move', { dx, dy, deltaX, deltaY, newDisplayYaw, newYaw, newPitch, invertYaw }) } catch (err) {}

            // apply new yaw and pitch (clamp pitch to [-90,90])
            setCamYawDeg(newYaw)
            setCamPitchDeg(Math.max(-90, Math.min(90, newPitch)))
            // bump tick so projections recalc
            try { setCamOffsetTick((t) => t + 1) } catch (err) {}
            // prevent hover checks while dragging
            return
          }

          // mouse driven camera control (subtle offsets when not dragging)
          if (mouseCameraControl) {
            const nx = (x / rect.width) * 2 - 1 // -1..1
            const ny = (y / rect.height) * 2 - 1
            camOffsetRef.current.yaw = nx * 6 * (insideYawSens || 0.25) // small yaw offset in degrees
            camOffsetRef.current.pitch = -ny * 6 * (insidePitchSens || 1.0) // small pitch offset
            // bump tick so mapAndProject and other deps will update
            try { setCamOffsetTick((t) => t + 1) } catch (err) {}
          }
          // Find hovered hex using spatial candidate search to avoid O(N) scans
          let foundHover = false
          const candidates = findNearbyIndices(x, y, 2)
          for (const i of candidates) {
            const infection = infectionState.infections.get(i)
            if (!infection) continue
            const proj = projectedPositionsRef.current[i] || [hexPositions[i][0], hexPositions[i][1], 1, 0, 0]
            const radius = drawnHexRadius * proj[2]
            const projAngle = proj[3] || 0
            if (isPointInHexagon(x, y, [proj[0], proj[1], 0], radius, projAngle)) {
              setHoverInfo({ index: i, x: e.clientX, y: e.clientY })
              foundHover = true
              break
            }
            if (workerDebug.renderBothSides) {
              try {
                const anti = mapAndProject(hexPositions[i], true)
                const antiRadius = drawnHexRadius * (anti.scale || 1)
                const antiAngle = (anti as any).angle || 0
                if (isPointInHexagon(x, y, [anti.x, anti.y, 0], antiRadius, antiAngle)) {
                  setHoverInfo({ index: i, x: e.clientX, y: e.clientY })
                  foundHover = true
                  break
                }
              } catch (err) {
                // ignore
              }
            }
          }
          if (!foundHover) setHoverInfo(null)

          // DEV DEBUG: when debugLogs enabled, compare the hovered candidate to the
          // nearest-by-euclidean-distance hex among the same candidates. This highlights
          // mapping mismatches caused by incorrect approxCol/row calculations or the
          // inherent 'wiggle' stagger. Only run when debugLogs is enabled to avoid perf cost.
          try {
            if (workerDebugRef.current?.debugLogs) {
              let nearestIdx: number | null = null
              let nearestDist = Infinity
              for (const i of candidates) {
                const p = hexPositions[i]
                if (!p) continue
                const dx = p[0] - x
                const dy = p[1] - y
                const d = Math.hypot(dx, dy)
                if (d < nearestDist) { nearestDist = d; nearestIdx = i }
              }
              if (nearestIdx != null && hoverInfo && nearestIdx !== hoverInfo.index) {
                dlog('Hover mismatch: nearestByDist=', nearestIdx, 'hoverCandidate=', hoverInfo.index, { x, y, nearestDist })
              }
            }
          } catch (err) {
            // ignore debug failures
          }
          // Transient heat: boost batchPerFrame based on mouse movement speed
          try {
            const last = (canvasRef.current as any)?._lastMouse || {x: x, y: y, t: performance.now()}
            const now = performance.now()
            const dx = x - last.x
            const dy = y - last.y
            const dt = Math.max(1, now - last.t)
            const speed = Math.sqrt(dx*dx + dy*dy) / dt * 1000 // px/sec
            ;(canvasRef.current as any)._lastMouse = { x, y, t: now }

            if (speed > 40) {
              // Boost transient batchProportional to speed, capped
              const boost = Math.min(64, Math.floor(speed / 40) * 8)
              transientBatchRef.current = Math.max(transientBatchRef.current ?? 0, getEffectiveBatch() + boost)
              if (transientTimeoutRef.current) window.clearTimeout(transientTimeoutRef.current)
              transientTimeoutRef.current = window.setTimeout(() => {
                transientBatchRef.current = null
                transientTimeoutRef.current = null
              }, 350)
            }
          } catch (err) {
            // ignore
          }
          // mark interaction to suppress idle rotation
          try { lastInteractionRef.current = performance.now() } catch (err) {}
        }}
        onMouseDown={(e) => {
          // start drag on left button
          if (e.button !== 0) return
          dragRef.current.active = true
          dragRef.current.startX = e.clientX
          dragRef.current.lastX = e.clientX
          // store startYaw in display-space (so mouse movement matches slider direction)
          dragRef.current.startYaw = invertYaw ? -camYawDeg : camYawDeg
          // capture vertical start/pitch
          dragRef.current.startY = e.clientY
          dragRef.current.lastY = e.clientY
          dragRef.current.startPitch = camPitchDeg
          try { dlog('HexGrid: drag start', { startYaw: dragRef.current.startYaw, camYawDeg, startPitch: dragRef.current.startPitch, invertYaw }) } catch (err) {}
          dragRef.current.lastT = performance.now()
          dragRef.current.vx = 0
          dragRef.current.vy = 0
          // mark interaction to suppress idle rotation
          try { lastInteractionRef.current = performance.now() } catch (err) {}
        }}
        onMouseUp={(e) => {
          if (e.button !== 0) return
          // apply inertia based on last vx/vy
          const vx = dragRef.current.vx || 0
          const vy = dragRef.current.vy || 0
          try { dlog('HexGrid: drag up', { vx, vy, invertYaw }) } catch (err) {}
          dragRef.current.active = false
          dragRef.current.lastT = 0

          // apply a short inertia animation for both yaw and pitch
          const friction = 0.92 // friction per frame

          // Convert pixel/sec to degrees/frame-ish: use inside sensitivities to scale
          // Use conservative multipliers so inertia feels natural
          let velYaw = vx * 0.001 * (insideYawSens || 0.25) // deg per frame-ish
          let velPitch = vy * 0.001 * (insidePitchSens || 1.0) // deg per frame-ish

          if (invertYaw) velYaw = -velYaw

          const stepInertia = () => {
            // stop when both velocities are negligible
            if (Math.abs(velYaw) < 0.01 && Math.abs(velPitch) < 0.01) return
            setCamYawDeg((prev) => prev + velYaw)
            setCamPitchDeg((prev) => Math.max(-90, Math.min(90, prev + velPitch)))
            velYaw *= friction
            velPitch *= friction
            requestAnimationFrame(stepInertia)
          }
          requestAnimationFrame(stepInertia)
          try { lastInteractionRef.current = performance.now() } catch (err) {}
        }}
        onMouseLeave={() => {
          // stop drag if pointer leaves canvas
          dragRef.current.active = false
          try { lastInteractionRef.current = performance.now() } catch (err) {}
        }}
        onWheel={() => { try { lastInteractionRef.current = performance.now() } catch (err) {} }}
        onTouchStart={(e) => {
          try { lastInteractionRef.current = performance.now() } catch (err) {}
          
          const canvas = canvasRef.current
          if (!canvas) return
          
          const touches = e.touches
          
          // Double tap detection
          if (touches.length === 1) {
            const now = performance.now()
            const touch = touches[0]
            const tapX = touch.clientX
            const tapY = touch.clientY
            const timeSinceLastTap = now - doubleTapRef.current.lastTapTime
            const distanceFromLastTap = Math.hypot(
              tapX - doubleTapRef.current.lastTapX,
              tapY - doubleTapRef.current.lastTapY
            )
            
            // Check if this is a double tap (within 300ms and 50px)
            if (timeSinceLastTap < 300 && distanceFromLastTap < 50) {
              // Double tap detected - reset camera
              setCamYawDeg(-90)
              setCamPitchDeg(-12)
              handleCamDistanceChange(1)
              setYawMult(1)
              camOffsetRef.current = { yaw: 0, pitch: 0 }
              e.preventDefault()
              // Mark that we just double tapped to prevent click event
              doubleTapRef.current.justDoubleTapped = true
              setTimeout(() => {
                doubleTapRef.current.justDoubleTapped = false
              }, 300)
              // Reset double tap tracking (keep justDoubleTapped flag)
              doubleTapRef.current.lastTapTime = 0
              doubleTapRef.current.lastTapX = 0
              doubleTapRef.current.lastTapY = 0
              return
            }
            
            // Store tap info for next potential double tap
            doubleTapRef.current = { lastTapTime: now, lastTapX: tapX, lastTapY: tapY, justDoubleTapped: false }
          }
          
          // Pinch to zoom (two fingers)
          if (touches.length === 2) {
            const touch1 = touches[0]
            const touch2 = touches[1]
            const distance = Math.hypot(
              touch2.clientX - touch1.clientX,
              touch2.clientY - touch1.clientY
            )
            pinchRef.current = {
              active: true,
              initialDistance: distance,
              initialDistanceMultiplier: camDistanceMultiplier
            }
            // Cancel any active drag
            touchDragRef.current.active = false
            e.preventDefault()
            return
          }
          
          // Single finger drag to rotate
          if (touches.length === 1 && !pinchRef.current.active) {
            const touch = touches[0]
            touchDragRef.current.active = true
            touchDragRef.current.startX = touch.clientX
            touchDragRef.current.startY = touch.clientY
            touchDragRef.current.lastX = touch.clientX
            touchDragRef.current.lastY = touch.clientY
            // Store start yaw in display-space (respects invertYaw)
            touchDragRef.current.startYaw = invertYaw ? -camYawDeg : camYawDeg
            touchDragRef.current.startPitch = camPitchDeg
            touchDragRef.current.lastT = performance.now()
            touchDragRef.current.vx = 0
            touchDragRef.current.vy = 0
            e.preventDefault()
          }
        }}
        onTouchMove={(e) => {
          try { lastInteractionRef.current = performance.now() } catch (err) {}
          
          const canvas = canvasRef.current
          if (!canvas) return
          
          const touches = e.touches
          
          // Pinch to zoom
          if (pinchRef.current.active && touches.length === 2) {
            const touch1 = touches[0]
            const touch2 = touches[1]
            const currentDistance = Math.hypot(
              touch2.clientX - touch1.clientX,
              touch2.clientY - touch1.clientY
            )
            
            // Calculate zoom delta based on distance change
            const distanceDelta = currentDistance - pinchRef.current.initialDistance
            // Scale zoom sensitivity: 0.01 per pixel of pinch distance change
            const zoomDelta = distanceDelta * 0.01
            const newDistance = Math.max(0.02, Math.min(2.5, pinchRef.current.initialDistanceMultiplier + zoomDelta))
            handleCamDistanceChange(newDistance)
            
            e.preventDefault()
            return
          }
          
          // Single finger drag to rotate
          if (touchDragRef.current.active && touches.length === 1) {
            const touch = touches[0]
            const now = performance.now()
            const dx = touch.clientX - touchDragRef.current.startX
            const dy = touch.clientY - touchDragRef.current.startY
            
            // Use same sensitivity as mouse controls
            const sensX = 0.25 * (camDistanceMultiplier || 1)
            const sensY = 0.25 * (camDistanceMultiplier || 1)
            
            // Calculate new yaw/pitch
            const newDisplayYaw = touchDragRef.current.startYaw + dx * sensX
            const newYaw = invertYaw ? -newDisplayYaw : newDisplayYaw
            const newPitch = touchDragRef.current.startPitch + dy * sensY
            
            // Velocity estimation for potential inertia
            const deltaX = touch.clientX - touchDragRef.current.lastX
            const deltaY = touch.clientY - touchDragRef.current.lastY
            const dt = Math.max(1, now - touchDragRef.current.lastT)
            touchDragRef.current.vx = (deltaX / dt) * 1000 // px/s
            touchDragRef.current.vy = (deltaY / dt) * 1000 // px/s
            touchDragRef.current.lastX = touch.clientX
            touchDragRef.current.lastY = touch.clientY
            touchDragRef.current.lastT = now
            
            // Apply new yaw and pitch (clamp pitch to [-90, 90])
            setCamYawDeg(newYaw)
            setCamPitchDeg(Math.max(-90, Math.min(90, newPitch)))
            // Bump tick so projections recalc
            try { setCamOffsetTick((t) => t + 1) } catch (err) {}
            
            e.preventDefault()
          }
        }}
        onTouchEnd={(e) => {
          try { lastInteractionRef.current = performance.now() } catch (err) {}
          
          const touches = e.touches
          
          // End pinch gesture if no longer two fingers
          if (pinchRef.current.active && touches.length < 2) {
            pinchRef.current.active = false
          }
          
          // End drag gesture if no touches remain
          if (touchDragRef.current.active && touches.length === 0) {
            // Apply inertia similar to mouse drag
            const vx = touchDragRef.current.vx || 0
            const vy = touchDragRef.current.vy || 0
            
            touchDragRef.current.active = false
            touchDragRef.current.lastT = 0
            
            // Apply short inertia animation
            const friction = 0.92
            let velYaw = vx * 0.001 * (insideYawSens || 0.25)
            let velPitch = vy * 0.001 * (insidePitchSens || 1.0)
            
            if (invertYaw) velYaw = -velYaw
            
            const stepInertia = () => {
              if (Math.abs(velYaw) < 0.01 && Math.abs(velPitch) < 0.01) return
              setCamYawDeg((prev) => prev + velYaw)
              setCamPitchDeg((prev) => Math.max(-90, Math.min(90, prev + velPitch)))
              velYaw *= friction
              velPitch *= friction
              requestAnimationFrame(stepInertia)
            }
            requestAnimationFrame(stepInertia)
          }
        }}
        onTouchCancel={(e) => {
          try { lastInteractionRef.current = performance.now() } catch (err) {}
          // Cancel all active gestures
          touchDragRef.current.active = false
          pinchRef.current.active = false
        }}
        style={{ border: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', borderRadius: 8, boxShadow: '0 6px 20px rgba(2,6,23,0.6)' }}
      />
      {/* Debug toggle moved to top nav - in-component toggle removed */}

      {/* Narration Overlay */}
      <NarrationOverlay
        messages={narrationMessages}
        statsTracker={statsTrackerRef.current}
        isVisible={showNarration}
        onClose={() => uiStore.set({ showNarration: false })}
      />

      {/* Telemetry overlay (toggleable via nav 'Stats' button) */}
      {showStats && (
        // Place telemetry above the camera controls in the bottom-left and avoid nav overlap
        <div style={{ position: 'fixed', left: 12, bottom: 170, background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '8px 10px', borderRadius: 8, fontSize: 12, zIndex: 9999, maxWidth: 320 }} aria-hidden>
  <div style={{ fontWeight: 'bold', marginBottom: 6 }}>HexGrid Telemetry</div>
  <div style={{ display: 'flex', justifyContent: 'space-between' }}><div>Gossip</div><div style={{ fontVariantNumeric: 'tabular-nums' }}>{infectionState.infections.size}</div></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><div>Available</div><div style={{ fontVariantNumeric: 'tabular-nums' }}>{infectionState.availableIndices.length}</div></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><div>Generation</div><div style={{ fontVariantNumeric: 'tabular-nums' }}>{infectionState.generation}</div></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><div>Last Evolution</div><div style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(infectionState.lastEvolutionTime)}</div></div>
  <div style={{ display: 'flex', justifyContent: 'space-between' }}><div>Streaming</div><div style={{ fontVariantNumeric: 'tabular-nums', color: streamingActive ? '#7fffd4' : '#cfcfcf' }}>{streamingActive ? 'active' : 'idle'}</div></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><div>Tiles remaining</div><div style={{ fontVariantNumeric: 'tabular-nums' }}>{tilesRemaining}</div></div>
  <div style={{ display: 'flex', justifyContent: 'space-between' }}><div>Total tiles</div><div style={{ fontVariantNumeric: 'tabular-nums' }}>{totalHexagons}</div></div>
        <details style={{ marginTop: 6, color: '#ddd' }}>
          <summary style={{ cursor: 'pointer', outline: 'none' }}>Debug Snapshot</summary>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 6, fontSize: 11, color: '#e8eef8' }}>{JSON.stringify(workerDebug, null, 2)}</pre>
        </details>
        </div>
      )}

      {/* Small FPS / frame-time telemetry badge (always rendered but hidden behind showStats) */}
      {showStats && (
        <div style={{ position: 'fixed', right: 12, bottom: 12, background: 'rgba(0,0,0,0.7)', color: '#e8f4ff', padding: '8px 10px', borderRadius: 8, fontSize: 12, zIndex: 10000, minWidth: 120, textAlign: 'right' }} aria-hidden>
          <div style={{ fontWeight: '600', marginBottom: 4 }}>Telemetry</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><div>FPS</div><div style={{ fontVariantNumeric: 'tabular-nums' }}>{telemetry.fps}</div></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><div>avg ms</div><div style={{ fontVariantNumeric: 'tabular-nums' }}>{telemetry.avgMs}</div></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><div>last ms</div><div style={{ fontVariantNumeric: 'tabular-nums' }}>{telemetry.lastMs}</div></div>
          {lowResActive && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#ffd' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><div>Sampling</div><div style={{ fontVariantNumeric: 'tabular-nums' }}>{lowResSampleStepRef.current}</div></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><div>Min proj scale</div><div style={{ fontVariantNumeric: 'tabular-nums' }}>{(typeof window !== 'undefined' ? '' : '')}</div></div>
            </div>
          )}
        </div>
      )}

      {/* Camera controls (bottom-left) */}
      {cameraOpen && (
        <div style={{ position: 'fixed', left: 12, bottom: 12, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: 10, borderRadius: 8, fontSize: 13, zIndex: 9999, width: 300 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Camera</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div>Yaw</div>
            <input type="range" min={-180} max={180} value={(invertYaw ? -camYawDeg : camYawDeg) * yawMult} onChange={(e) => handleYawInputChange(Number(e.target.value) / Math.max(0.01, yawMult))} />
          </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>Pitch</div>
          <input type="range" min={-90} max={90} value={camPitchDeg} onChange={(e) => setCamPitchDeg(Number(e.target.value))} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ width: 80 }}>Distance</div>
          <input type="range" min={0.02} max={2.5} step={0.01} value={camDistanceMultiplier} onChange={(e) => handleCamDistanceChange(Number(e.target.value))} style={{ flex: 1, marginLeft: 8 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={mouseCameraControl} onChange={(e) => setMouseCameraControl(e.target.checked)} /> Mouse Camera</label>
          <button onClick={() => { setCamYawDeg(-90); setCamPitchDeg(-12); handleCamDistanceChange(1); setYawMult(1); camOffsetRef.current = { yaw: 0, pitch: 0 } }} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '6px 8px' }}>Reset</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={lowResActive} onChange={(e) => {
              const enable = e.target.checked
              try {
                // Cancel any ongoing streams before changing settings
                streamTokenRef.current += 1
                
                if (!enable) {
                  // disable: restore previous debug if present
                  if (prevDebugRef.current) {
                    setWorkerDebug(prevDebugRef.current)
                    try { if (workerRef.current) {
                      const infectionsArray = Array.from(infectionStateRef.current.infections.entries())
                      const stateToSend = { infections: infectionsArray, availableIndices: infectionStateRef.current.availableIndices, lastEvolutionTime: infectionStateRef.current.lastEvolutionTime, generation: infectionStateRef.current.generation }
                      sendEvolve(stateToSend, hexPositions, photos, drawnHexRadius, 'restore-debug')
                    } } catch (err) {}
                    prevDebugRef.current = null
                  }
                  setLowResActive(false)
                } else {
                  // enable: save current debug and apply low-res preset
                  prevDebugRef.current = workerDebug
                  const baseTile = Math.max(8, (workerDebug.tileSize ?? defaultHexRadius))
                  const preset = { ...workerDebug, tileSize: Math.min(128, Math.floor(baseTile * 3)), gridScale: 1 }
                  setWorkerDebug(preset)
                  try { if (workerRef.current) {
                    const infectionsArray = Array.from(infectionStateRef.current.infections.entries())
                    const stateToSend = { infections: infectionsArray, availableIndices: infectionStateRef.current.availableIndices, lastEvolutionTime: infectionStateRef.current.lastEvolutionTime, generation: infectionStateRef.current.generation }
                    sendEvolve(stateToSend, hexPositions, photos, drawnHexRadius, 'apply-gentle-preset')
                  } } catch (err) {}
                  setLowResActive(true)
                }
              } catch (err) {
                logger.error('Failed to toggle low-res mode', err)
              }
            }} /> Low-res mode
          </label>
          <div style={{ fontSize: 11, color: '#ccc' }}>Larger tiles, fewer hexes — better performance</div>
        </div>
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#cfd6df' }}>Last saved pitch</div>
          <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#fff' }}>{lastSavedPitch == null ? '—' : `${lastSavedPitch.toFixed(1)}°`}</div>
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button onClick={() => {
            try {
              const obj = { yaw: camYawDeg, pitch: camPitchDeg, distance: camDistanceMultiplier, unit: 'deg' }
              window.localStorage.setItem('hexgrid.camera', JSON.stringify(obj))
              setLastSavedPitch(camPitchDeg)
              try { logger.debug('HexGrid: Save now wrote hexgrid.camera', obj) } catch (err) {}
              try { setRawCameraJson(JSON.stringify(obj, null, 2)) } catch (err) {}
            } catch (err) { logger.warn('Failed to save camera', err) }
          }} style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', color: '#fff', border: '1px solid rgba(255,255,255,0.06)' }}>Save now</button>
          <div style={{ fontSize: 12, color: '#9fb0d6', alignSelf: 'center' }}>Click to force-save camera to storage</div>
        </div>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={showRawCamera} onChange={(e) => setShowRawCamera(e.target.checked)} /> Show saved camera JSON</label>
        </div>
        {showRawCamera && (
          <pre style={{ maxHeight: 160, overflow: 'auto', background: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 6, color: '#dfefff', fontSize: 12 }}>{rawCameraJson ?? 'No saved camera'}</pre>
        )}
        <div style={{ height: 8 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={insideView} onChange={(e) => setInsideView(e.target.checked)} /> Inside view</label>
          <div style={{ fontSize: 11, color: '#ccc' }}>Render from sphere center</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={invertYaw} onChange={(e) => setInvertYaw(e.target.checked)} /> Invert yaw</label>
          <div style={{ fontSize: 11, color: '#ccc' }}>Flip sign of yaw for rendering</div>
        </div>
        <div style={{ fontSize: 11, color: '#ddd', marginBottom: 6 }}>Inside view tuning</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 12, color: '#cfd6df' }}>
          <div style={{ color: '#ddd' }}>Yaw influence</div>
          <div style={{ fontVariantNumeric: 'tabular-nums' }}>{((yawMult ?? 0)).toFixed(2)}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 12, color: '#cfd6df' }}>
          <div style={{ color: '#ddd' }}>Effective yaw</div>
          <div style={{ fontVariantNumeric: 'tabular-nums' }}>{((invertYaw ? -camYawDeg : camYawDeg) * (yawMult ?? 0)).toFixed(1)}°</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ width: 80 }}>Focal</div>
          <input type="range" min={0.5} max={2.5} step={0.01} value={insideFocal} onChange={(e) => setInsideFocal(Number(e.target.value))} style={{ flex: 1, marginLeft: 8 }} />
        </div>
        {/* Idle rotation controls */}
        <div style={{ marginTop: 8, marginBottom: 6, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 8 }}>
          <div style={{ fontWeight: '600', marginBottom: 6 }}>Idle rotation</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={(workerDebug as any).idleRotationEnabled ?? true} onChange={(e) => { const v = e.target.checked; setWorkerDebug((prev) => { const next = { ...prev, idleRotationEnabled: v }; try { workerDebugRef.current = next } catch (err) {} ; return next }) }} /> Enable</label>
            <div style={{ fontSize: 12, color: '#ccc' }}>Auto-rotate when idle (3D only)</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 80 }}>Delay</div>
            <input type="range" min={500} max={15000} step={100} value={(workerDebug as any).idleRotationDelayMs ?? 3500} onChange={(e) => {
              const v = Number(e.target.value)
              setWorkerDebug((prev) => { const next = { ...prev, idleRotationDelayMs: v }; try { workerDebugRef.current = next } catch (err) {} ; return next })
            }} style={{ flex: 1 }} />
            <div style={{ width: 70, textAlign: 'right' }}>{(workerDebug as any).idleRotationDelayMs ?? 3500}ms</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 80 }}>Speed</div>
            <input type="range" min={0} max={60} step={0.5} value={(workerDebug as any).idleRotationDegPerSec ?? 6} onChange={(e) => {
              const v = Number(e.target.value)
              setWorkerDebug((prev) => { const next = { ...prev, idleRotationDegPerSec: v }; try { workerDebugRef.current = next } catch (err) {} ; return next })
            }} style={{ flex: 1 }} />
            <div style={{ width: 70, textAlign: 'right' }}>{(workerDebug as any).idleRotationDegPerSec ?? 6}°/s</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ width: 80 }}>Yaw sens</div>
          <input type="range" min={0.05} max={1.0} step={0.01} value={insideYawSens} onChange={(e) => setInsideYawSens(Number(e.target.value))} style={{ flex: 1, marginLeft: 8 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ width: 80 }}>Pitch sens</div>
          <input type="range" min={0.2} max={2.0} step={0.01} value={insidePitchSens} onChange={(e) => setInsidePitchSens(Number(e.target.value))} style={{ flex: 1, marginLeft: 8 }} />
        </div>
        </div>
      )}

      {/* Debug control panel (closable) */}
      {debugOpen && (
        <div id="hexgrid-debug-panel" role="dialog" aria-label="Hexgrid debug panel" style={{ position: 'fixed', top: 112, right: 12, background: 'rgba(0,0,0,0.8)', color: '#fff', padding: 12, borderRadius: 8, fontSize: 12, width: 420, boxShadow: '0 6px 18px rgba(0,0,0,0.6)', maxHeight: '80vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 'bold' }}>Worker Debug</div>
            <button aria-label="Close debug panel" onClick={() => setDebugOpen(false)} style={{ background: 'transparent', color: '#fff', border: 'none', fontSize: 16, cursor: 'pointer' }}>×</button>
          </div>
          
          {/* Pool Stats Overlay */}
          <div style={{ marginBottom: 12, padding: 8, background: getAccentRgba(0.1), borderRadius: 6, border: `1px solid ${getAccentRgba(0.2)}` }}>
            <PoolStatsOverlay isOpen={debugOpen} />
          </div>
          
          {/* Accent Color Picker */}
          <AccentColorPicker />
          
          {/* Evolution Enable/Disable Toggle - Prominent at top */}
          <div style={{ marginBottom: 12, padding: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>
              <input 
                type="checkbox" 
                checked={workerDebug.evolutionEnabled !== false} 
                onChange={(e) => setWorkerDebug({...workerDebug, evolutionEnabled: e.target.checked})} 
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <span style={{ color: workerDebug.evolutionEnabled !== false ? '#4ade80' : '#f87171' }}>
                {workerDebug.evolutionEnabled !== false ? 'Evolution Running' : 'Evolution Paused'}
              </span>
            </label>
            <div style={{ fontSize: 11, color: '#ccc', marginTop: 4, marginLeft: 24 }}>
              {workerDebug.evolutionEnabled !== false 
                ? 'Worker is actively evolving the grid. Uncheck to pause.' 
                : 'Evolution paused. Check to resume.'}
            </div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 4, marginLeft: 24 }}>
              Current generation: <span style={{ fontVariantNumeric: 'tabular-nums', color: '#fff' }}>{infectionState.generation}</span>
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, color: '#ccc' }}>Evolution interval (ms):</div>
              <input 
                type="number" 
                step="100" 
                min="100" 
                max="300000" 
                value={workerDebug.evolveIntervalMs ?? 60000} 
                onChange={(e) => setWorkerDebug({...workerDebug, evolveIntervalMs: Math.max(100, Number(e.target.value))})} 
                style={{ width: 80, marginLeft: 8 }} 
              />
            </div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 4, marginLeft: 24 }}>
              Min time between evolutions. Lower = faster (default: 60000ms)
            </div>
          </div>
          
          <div style={{ marginBottom: 6, maxHeight: '64vh', overflowY: 'auto', paddingRight: 6 }}>
            <label>miniLogGenerations: </label>
            <input type="number" value={workerDebug.miniLogGenerations} onChange={(e) => setWorkerDebug({...workerDebug, miniLogGenerations: Number(e.target.value)})} style={{ width: 60 }} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>spawnEnabled: </label>
            <input type="checkbox" checked={workerDebug.spawnEnabled} onChange={(e) => setWorkerDebug({...workerDebug, spawnEnabled: e.target.checked})} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>spawnRateMultiplier: </label>
            <input type="number" step="0.1" value={workerDebug.spawnRateMultiplier} onChange={(e) => setWorkerDebug({...workerDebug, spawnRateMultiplier: Number(e.target.value)})} style={{ width: 60 }} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>spawnClusterMax: </label>
            <input type="number" step="1" min={1} value={workerDebug.spawnClusterMax} onChange={(e) => setWorkerDebug({...workerDebug, spawnClusterMax: Math.max(1, Number(e.target.value))})} style={{ width: 60 }} />
          </div>
          
          <div style={{ marginTop: 8, marginBottom: 6, fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>Cell Death & Mutation</div>
          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={(workerDebug as any).enableCellDeath !== false} onChange={(e) => setWorkerDebug({...workerDebug, enableCellDeath: e.target.checked} as any)} />
              Enable Cell Death
            </label>
            <div style={{ fontSize: 11, color: '#ccc' }}>Allow fully surrounded cells to die and respawn for optimization</div>
          </div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 120 }}>Death probability</div>
            <input type="range" min={0} max={1.0} step={0.01} value={(workerDebug as any).cellDeathProbability ?? 0.05} onChange={(e) => setWorkerDebug({...workerDebug, cellDeathProbability: Number(e.target.value)} as any)} style={{ flex: 1 }} />
            <input type="number" step="0.01" min={0} max={1.0} value={(workerDebug as any).cellDeathProbability ?? 0.05} onChange={(e) => setWorkerDebug({...workerDebug, cellDeathProbability: Math.max(0, Math.min(1, Number(e.target.value)))} as any)} style={{ width: 64 }} />
          </div>
          <div style={{ fontSize: 11, color: '#ccc', marginBottom: 6 }}>Chance per evolution for fully surrounded cells to reset (0.05 = 5%)</div>
          
          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={(workerDebug as any).enableMutation !== false} onChange={(e) => setWorkerDebug({...workerDebug, enableMutation: e.target.checked} as any)} />
              Enable Mutation
            </label>
            <div style={{ fontSize: 11, color: '#ccc' }}>Allow dying cells to mutate into different photos</div>
          </div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 120 }}>Mutation probability</div>
            <input type="range" min={0} max={1.0} step={0.05} value={(workerDebug as any).mutationProbability ?? 0.3} onChange={(e) => setWorkerDebug({...workerDebug, mutationProbability: Number(e.target.value)} as any)} style={{ flex: 1 }} />
            <input type="number" step="0.05" min={0} max={1.0} value={(workerDebug as any).mutationProbability ?? 0.3} onChange={(e) => setWorkerDebug({...workerDebug, mutationProbability: Math.max(0, Math.min(1, Number(e.target.value)))} as any)} style={{ width: 64 }} />
          </div>
          <div style={{ fontSize: 11, color: '#ccc', marginBottom: 6 }}>Chance for dying cells to mutate into a new photo (0.3 = 30%)</div>
          
          <div style={{ marginTop: 8, marginBottom: 6, fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>Virility-Based Growth</div>
          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={(workerDebug as any).enableVirilityBoost !== false} onChange={(e) => setWorkerDebug({...workerDebug, enableVirilityBoost: e.target.checked} as any)} />
              Enable Virility Boost
            </label>
            <div style={{ fontSize: 11, color: '#ccc' }}>Photos with higher velocity (upvotes/engagement) infect neighbors faster</div>
          </div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 120 }}>Virility multiplier</div>
            <input type="range" min={0} max={3.0} step={0.1} value={(workerDebug as any).virilityMultiplier ?? 1.0} onChange={(e) => setWorkerDebug({...workerDebug, virilityMultiplier: Number(e.target.value)} as any)} style={{ flex: 1 }} />
            <input type="number" step="0.1" min={0} max={10.0} value={(workerDebug as any).virilityMultiplier ?? 1.0} onChange={(e) => setWorkerDebug({...workerDebug, virilityMultiplier: Math.max(0, Number(e.target.value))} as any)} style={{ width: 64 }} />
          </div>
          <div style={{ fontSize: 11, color: '#ccc', marginBottom: 6 }}>Multiplier for virility effect (1.0 = 100% velocity boost, 2.0 = 200% boost)</div>
          
          <div style={{ marginTop: 8, marginBottom: 6, fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>Annealing</div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 120 }}>Annealing rate</div>
            <input type="range" min={0.1} max={5.0} step={0.1} value={(workerDebug as any).annealingRate ?? 2.0} onChange={(e) => setWorkerDebug({...workerDebug, annealingRate: Number(e.target.value)} as any)} style={{ flex: 1 }} />
            <input type="number" step="0.1" min={0.1} max={10.0} value={(workerDebug as any).annealingRate ?? 2.0} onChange={(e) => setWorkerDebug({...workerDebug, annealingRate: Math.max(0.1, Number(e.target.value))} as any)} style={{ width: 64 }} />
          </div>
          <div style={{ fontSize: 11, color: '#ccc', marginBottom: 6 }}>Multiplier for cell death/churn to help escape local optima (1.0 = normal, 2.0 = 2x reorganization, 5.0 = rapid annealing)</div>
          
          <div style={{ marginTop: 8, marginBottom: 6, fontWeight: 'bold' }}>Glass</div>
          <div style={{ marginBottom: 6 }}>
            <label>sheenEnabled: </label>
            <input type="checkbox" checked={workerDebug.sheenEnabled} onChange={(e) => setWorkerDebug({...workerDebug, sheenEnabled: e.target.checked})} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>sheenSpeed (s): </label>
            <input type="number" step="1" value={workerDebug.sheenSpeed} onChange={(e) => setWorkerDebug({...workerDebug, sheenSpeed: Number(e.target.value)})} style={{ width: 60 }} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>sheenIntensity: </label>
            <input type="number" step="0.01" value={workerDebug.sheenIntensity} onChange={(e) => setWorkerDebug({...workerDebug, sheenIntensity: Number(e.target.value)})} style={{ width: 60 }} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>scratchEnabled: </label>
            <input type="checkbox" checked={workerDebug.scratchEnabled} onChange={(e) => setWorkerDebug({...workerDebug, scratchEnabled: e.target.checked})} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>translucencySmoothing: </label>
            <input type="number" step="0.01" value={workerDebug.translucencySmoothing} onChange={(e) => setWorkerDebug({...workerDebug, translucencySmoothing: Number(e.target.value)})} style={{ width: 60 }} />
          </div>
          <div style={{ marginTop: 8, marginBottom: 6, fontWeight: 'bold' }}>Reproduction</div>
          <div style={{ marginTop: 8, marginBottom: 6, fontWeight: 'bold' }}>Layout</div>
          <div style={{ marginBottom: 6 }}>
            <label>gridScale: </label>
            <input type="number" step="0.1" value={(workerDebug.gridScale ?? 1)} onChange={(e) => setWorkerDebug({...workerDebug, gridScale: Math.max(0.25, Number(e.target.value))})} style={{ width: 80 }} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>tileSize (px): </label>
            <input type="number" step="1" min={4} value={(workerDebug.tileSize ?? 12)} onChange={(e) => setWorkerDebug({...workerDebug, tileSize: Math.max(4, Number(e.target.value))})} style={{ width: 80 }} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>hexSpacing: </label>
            <input type="number" step="0.01" min={0.5} max={1.5} value={(workerDebug.hexSpacing ?? 1.0)} onChange={(e) => setWorkerDebug({...workerDebug, hexSpacing: Number(e.target.value)})} style={{ width: 80 }} />
            <div style={{ fontSize: 11, color: '#ccc' }}>Hex size multiplier (1.0 = perfect touching, {'<'}1.0 = gaps, {'>'}1.0 = overlap)</div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>sphericalDensity: </label>
            <input type="number" step="0.1" min={0.5} max={3.0} value={(workerDebug.sphericalDensity ?? 1.4)} onChange={(e) => setWorkerDebug({...workerDebug, sphericalDensity: Number(e.target.value)})} style={{ width: 80 }} />
            <div style={{ fontSize: 11, color: '#ccc' }}>Spherical grid density multiplier (1.0 = base, higher = more hexes)</div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>curve U (deg): </label>
            <input type="number" step="1" min={0} max={360} value={(workerDebug.curveUDeg ?? 0)} onChange={(e) => setWorkerDebug({...workerDebug, curveUDeg: Math.max(0, Math.min(360, Number(e.target.value)))})} style={{ width: 80 }} />
            <div style={{ fontSize: 11, color: '#ccc' }}>Horizontal wrap (0 = flat, 360 = full wrap)</div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>curve V (deg): </label>
            <input type="number" step="1" min={0} max={360} value={(workerDebug.curveVDeg ?? 0)} onChange={(e) => setWorkerDebug({...workerDebug, curveVDeg: Math.max(0, Math.min(360, Number(e.target.value)))})} style={{ width: 80 }} />
            <div style={{ fontSize: 11, color: '#ccc' }}>Vertical coverage (0 = flat, 360 = poles included)</div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>Mapping debug overlay: </label>
            <input type="checkbox" checked={showMappingDebug} onChange={(e) => setShowMappingDebug(e.target.checked)} />
            <div style={{ fontSize: 11, color: '#ccc' }}>When enabled, hover shows u/v, lon/lat, R and world coords for each hex.</div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>Pole scaling: </label>
            <input type="checkbox" checked={!!workerDebug.poleScaleEnabled} onChange={(e) => setWorkerDebug({...workerDebug, poleScaleEnabled: e.target.checked})} />
            <div style={{ fontSize: 11, color: '#ccc' }}>Shrink hexes near poles to reduce overlap when curveV is large.</div>
          </div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 120 }}>Pole min scale</div>
            <input type="range" min={0.05} max={1.0} step={0.01} value={(workerDebug.poleMinScale ?? 0.25)} onChange={(e) => setWorkerDebug({...workerDebug, poleMinScale: Number(e.target.value)})} style={{ flex: 1 }} />
            <input type="number" step="0.01" min={0.05} max={1.0} value={(workerDebug.poleMinScale ?? 0.25)} onChange={(e) => setWorkerDebug({...workerDebug, poleMinScale: Math.max(0.01, Number(e.target.value))})} style={{ width: 64 }} />
          </div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 120 }}>Pole power</div>
            <input type="range" min={0.1} max={2.0} step={0.01} value={(workerDebug.polePower ?? 0.9)} onChange={(e) => setWorkerDebug({...workerDebug, polePower: Number(e.target.value)})} style={{ flex: 1 }} />
            <input type="number" step="0.01" min={0.1} max={2.0} value={(workerDebug.polePower ?? 0.9)} onChange={(e) => setWorkerDebug({...workerDebug, polePower: Math.max(0.01, Number(e.target.value))})} style={{ width: 64 }} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>renderBothSides: </label>
            <input type="checkbox" checked={!!workerDebug.renderBothSides} onChange={(e) => setWorkerDebug({...workerDebug, renderBothSides: e.target.checked})} />
            <div style={{ fontSize: 11, color: '#ccc' }}>When enabled, draw antipodal copies so images appear on both sides of the sphere.</div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>debugLogs (worker): </label>
            <input type="checkbox" checked={!!workerDebug.debugLogs} onChange={(e) => setWorkerDebug({...workerDebug, debugLogs: e.target.checked})} />
            <div style={{ fontSize: 11, color: '#ccc' }}>Enable verbose logs from the worker (off by default).</div>
          </div>
          <div style={{ marginTop: 12, marginBottom: 6, fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>Autoplay</div>
          <div style={{ marginTop: 12, marginBottom: 6, fontWeight: 'bold' }}>Cluster Tiling</div>
          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!workerDebug.clusterPreserveAspect} onChange={(e) => setWorkerDebug({...workerDebug, clusterPreserveAspect: e.target.checked})} /> Preserve aspect
            </label>
            <div style={{ fontSize: 11, color: '#ccc' }}>When enabled, cluster bounding boxes preserve photo aspect when mapping to tile grid.</div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={workerDebug.clusterDynamicTiling !== false} onChange={(e) => setWorkerDebug({...workerDebug, clusterDynamicTiling: e.target.checked})} /> Dynamic tiling
            </label>
            <div style={{ fontSize: 11, color: '#ccc' }}>Calculate tilesX/tilesY based on cluster aspect ratio for better image alignment.</div>
          </div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 120 }}>Cluster anchor</div>
            <select value={workerDebug.clusterAnchor} onChange={(e) => setWorkerDebug({...workerDebug, clusterAnchor: e.target.value as any})}>
              <option value="center">center</option>
              <option value="min">min</option>
            </select>
            <div style={{ fontSize: 11, color: '#ccc' }}>Anchor used when fitting cluster bbox to tile grid.</div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!workerDebug.clusterGlobalAlign} onChange={(e) => setWorkerDebug({...workerDebug, clusterGlobalAlign: e.target.checked})} /> Global align
            </label>
            <div style={{ fontSize: 11, color: '#ccc' }}>When enabled, clusters snap to a global tile anchor to improve neighbor alignment.</div>
          </div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 120 }}>UV inset</div>
            <input type="number" step="0.005" min={0} max={0.25} value={(workerDebug.clusterUvInset ?? 0.0)} onChange={(e) => setWorkerDebug({...workerDebug, clusterUvInset: Math.max(0, Math.min(0.25, Number(e.target.value)))})} style={{ width: 80 }} />
            <div style={{ fontSize: 11, color: '#ccc' }}>Inset fraction applied to UV bounds (0=seamless, 0.01=1% gap for seam reduction).</div>
          </div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 120 }}>Cluster jitter</div>
            <input type="number" step="0.001" min={0} max={0.2} value={(workerDebug.clusterJitter ?? 0)} onChange={(e) => setWorkerDebug({...workerDebug, clusterJitter: Math.max(0, Math.min(0.2, Number(e.target.value)))})} style={{ width: 80 }} />
            <div style={{ fontSize: 11, color: '#ccc' }}>Small randomized offset applied before quantization to reduce regular grid artifacts.</div>
          </div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 120 }}>Adjacency</div>
            <select value={(workerDebug.clusterAdjacency as any) ?? 'rect'} onChange={(e) => setWorkerDebug({...workerDebug, clusterAdjacency: e.target.value as any})}>
              <option value="rect">rect (4-way)</option>
              <option value="hex">hex (6-way)</option>
            </select>
            <div style={{ fontSize: 11, color: '#ccc' }}>Tile adjacency used when resolving collisions (rect is raster-like).</div>
          </div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 120 }}>Scan mode</div>
            <select value={(workerDebug.clusterScanMode as any) ?? 'row'} onChange={(e) => setWorkerDebug({...workerDebug, clusterScanMode: e.target.value as any})}>
              <option value="row">row (L→R each row)</option>
              <option value="serpentine">serpentine (zig-zag)</option>
            </select>
            <div style={{ fontSize: 11, color: '#ccc' }}>Serpentine alternates direction each row (can look nicer).</div>
          </div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!workerDebug.clusterParityAware} onChange={(e) => setWorkerDebug({...workerDebug, clusterParityAware: e.target.checked})} /> Parity-aware
            </label>
            <div style={{ fontSize: 11, color: '#ccc' }}>When enabled, tile centers apply hex row parity offsets to follow hex staggering.</div>
          </div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!workerDebug.clusterHexLattice} onChange={(e) => setWorkerDebug({...workerDebug, clusterHexLattice: e.target.checked})} /> Hex lattice fast-path
            </label>
            <div style={{ fontSize: 11, color: '#ccc' }}>Direct row/col inference (parity-correct) instead of spatial nearest matching.</div>
          </div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!workerDebug.clusterParityUvShift} onChange={(e) => setWorkerDebug({...workerDebug, clusterParityUvShift: e.target.checked})} /> Parity UV shift
            </label>
            <div style={{ fontSize: 11, color: '#ccc' }}>Horizontally nudge odd rows' UVs by half a tile width to reduce alternating seams.</div>
          </div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 120 }}>Fill mode</div>
            <select value={(workerDebug.clusterFillMode as any) ?? 'contain'} onChange={(e) => setWorkerDebug({...workerDebug, clusterFillMode: e.target.value as any})}>
              <option value="contain">contain (fit)</option>
              <option value="cover">cover (fill/crop)</option>
            </select>
            <div style={{ fontSize: 11, color: '#ccc' }}>cover fills cluster bounds (cropping OK), contain fits whole image.</div>
          </div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 120 }}>Max tiles</div>
            <input type="number" step={1} min={1} max={1024} value={(workerDebug.clusterMaxTiles ?? 64)} onChange={(e) => setWorkerDebug({...workerDebug, clusterMaxTiles: Math.max(1, Math.min(1024, Number(e.target.value)))})} style={{ width: 100 }} />
            <div style={{ fontSize: 11, color: '#ccc' }}>Maximum tiles used when expanding the tile grid to cover a cluster.</div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!workerDebug.showTileLabels} onChange={(e) => setWorkerDebug({...workerDebug, showTileLabels: e.target.checked})} /> Show tile labels
            </label>
            <div style={{ fontSize: 11, color: '#ccc' }}>When enabled, grid coords are overlaid on each hex for debugging tile assignments.</div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!workerDebug.showTileCenters} onChange={(e) => setWorkerDebug({...workerDebug, showTileCenters: e.target.checked})} /> Show tile centers
            </label>
            <div style={{ fontSize: 11, color: '#ccc' }}>When enabled, computed tile centers are rendered as small + markers to validate parity-aware positioning.</div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>Queue limit (top N): </label>
            <input 
              type="number" 
              step="1" 
              min="1" 
              max="1000" 
              value={autoplayQueueLimit ?? 100} 
              onChange={(e) => {
                const newLimit = Math.max(1, Math.min(1000, Number(e.target.value)))
                if (onAutoplayQueueLimitChange) {
                  onAutoplayQueueLimitChange(newLimit)
                }
              }} 
              style={{ width: 80 }} 
            />
            <div style={{ fontSize: 11, color: '#ccc' }}>Number of top leaderboard items to include in autoplay queue (default: 100).</div>
          </div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 160 }}>Intermission (sec)</div>
            <input type="number" step={1} min={0} value={(workerDebug.intermissionDurationSec ?? 4)} onChange={(e) => setWorkerDebug({...workerDebug, intermissionDurationSec: Math.max(0, Number(e.target.value))})} style={{ width: 80 }} />
            <div style={{ fontSize: 11, color: '#ccc' }}>Seconds to pause between items during autodisplay (0 = no intermission).</div>
          </div>
          <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 160 }}>Photo duration (sec)</div>
            <input type="number" step={1} min={1} value={(workerDebug.photoDurationSec ?? 5)} onChange={(e) => setWorkerDebug({...workerDebug, photoDurationSec: Math.max(1, Number(e.target.value))})} style={{ width: 80 }} />
            <div style={{ fontSize: 11, color: '#ccc' }}>Default seconds to show photos/tweets in autodisplay when no explicit duration is available.</div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>reproThreshold3: </label>
            <input type="number" step="1" min={1} value={workerDebug.reproThreshold3} onChange={(e) => setWorkerDebug({...workerDebug, reproThreshold3: Math.max(1, Number(e.target.value))})} style={{ width: 60 }} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>reproChance3: </label>
            <input type="number" step="0.01" value={workerDebug.reproChance3} onChange={(e) => setWorkerDebug({...workerDebug, reproChance3: Number(e.target.value)})} style={{ width: 80 }} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>reproChance2: </label>
            <input type="number" step="0.01" value={workerDebug.reproChance2} onChange={(e) => setWorkerDebug({...workerDebug, reproChance2: Number(e.target.value)})} style={{ width: 80 }} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>reproChance1: </label>
            <input type="number" step="0.01" value={workerDebug.reproChance1} onChange={(e) => setWorkerDebug({...workerDebug, reproChance1: Number(e.target.value)})} style={{ width: 80 }} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>reproChance0: </label>
            <input type="number" step="0.01" value={workerDebug.reproChance0} onChange={(e) => setWorkerDebug({...workerDebug, reproChance0: Number(e.target.value)})} style={{ width: 80 }} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>reproPriorityMultiplier3: </label>
            <input type="number" step="0.1" value={workerDebug.reproPriorityMultiplier3} onChange={(e) => setWorkerDebug({...workerDebug, reproPriorityMultiplier3: Number(e.target.value)})} style={{ width: 80 }} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>sameNeighborBoostPerDeficit: </label>
            <input type="range" min={0} max={1.0} step={0.01} value={workerDebug.sameNeighborBoostPerDeficit ?? 0.35} onChange={(e) => setWorkerDebug({...workerDebug, sameNeighborBoostPerDeficit: Number(e.target.value)})} style={{ width: 160, verticalAlign: 'middle', marginLeft: 8 }} />
            <input type="number" step="0.01" min={0} max={2.0} value={workerDebug.sameNeighborBoostPerDeficit ?? 0.35} onChange={(e) => setWorkerDebug({...workerDebug, sameNeighborBoostPerDeficit: Math.max(0, Number(e.target.value))})} style={{ width: 80, marginLeft: 8 }} />
            <div style={{ fontSize: 11, color: '#ccc' }}>Per-deficit multiplier added to infection chance (e.g. 0.35 → ~1.7 boost at deficit=2)</div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label>streamMs (ms per tile): </label>
            <input type="number" step="1" value={workerDebug.streamMs} onChange={(e) => setWorkerDebug({...workerDebug, streamMs: Number(e.target.value)})} style={{ width: 80 }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>batchPerFrame: </label>
            <input type="range" min={0} max={64} step={1} value={workerDebug.batchPerFrame ?? 0} onChange={(e) => setWorkerDebug({...workerDebug, batchPerFrame: Number(e.target.value)})} style={{ width: '140px', verticalAlign: 'middle', marginLeft: 6 }} />
            <input type="number" min={0} max={8096} step={1} value={workerDebug.batchPerFrame ?? 0} onChange={(e) => setWorkerDebug({...workerDebug, batchPerFrame: Math.max(0, Number(e.target.value))})} style={{ width: 60, marginLeft: 8 }} />
            <div style={{ fontSize: 11, color: '#ccc', marginTop: 4 }}>0 = per-tile delay mode; {'>'}0 = apply N tiles per rAF</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', paddingTop: 8 }}>
            <button onClick={() => { setWorkerDebug({...workerDebug, miniLogGenerations: 20}) }}
              style={{ padding: '10px 12px', minWidth: 84, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))', color: '#fff', cursor: 'pointer' }}
              title="Reset mini-log generations"
            >Reset</button>
            <button
              onClick={() => {
                // Aggressive crowding preset
                const preset = {
                  ...workerDebug,
                  spawnEnabled: true,
                  spawnRateMultiplier: 4.0,
                  spawnClusterMax: 12,
                  reproThreshold3: 2,
                  reproChance3: 0.999,
                  reproChance2: 0.98,
                  reproChance1: 0.95,
                  reproChance0: 0.6,
                  reproPriorityMultiplier3: 6.0,
                  streamMs: 8,
                  batchPerFrame: 8,
                  evolveIntervalMs: 300 // faster evolves
                }
                // Update the ref so long-lived closures see the new debug right away.
                workerDebugRef.current = preset
                setWorkerDebug(preset)

                // Quick log for experiment tracking
                dlog('Applied aggressive Crowd preset: gridScale=', preset.gridScale, 'batchPerFrame=', preset.batchPerFrame, 'streamMs=', preset.streamMs)

                const postEvolve = () => {
                  try {
                    const dbg = preset
                    dlog('Applying Crowd preset to worker now:', dbg)
                    if (workerRef.current) {
                      const infectionsArray = Array.from(infectionStateRef.current.infections.entries())
                      const stateToSend = {
                        infections: infectionsArray,
                        availableIndices: infectionStateRef.current.availableIndices,
                        lastEvolutionTime: infectionStateRef.current.lastEvolutionTime,
                        generation: infectionStateRef.current.generation
                      }
                      sendEvolve(stateToSend, hexPositions, photos, drawnHexRadius, 'fps-fallback-step')
                      dlog('Crowd evolve posted')
                      return true
                    }
                  } catch (err) {
                    logger.error('Failed to apply Crowd preset to worker:', err)
                  }
                  return false
                }

                if (!postEvolve()) {
                  // Worker not ready yet — retry a few times
                  let attempts = 0
                  const tryInterval = setInterval(() => {
                    attempts++
                    if (postEvolve() || attempts >= 8) {
                      clearInterval(tryInterval)
                    }
                  }, 250)
                }
              }}
              style={{ marginLeft: 8, background: 'linear-gradient(90deg,#ff6b6b,#b22222)', color: '#fff', padding: '10px 12px', minWidth: 110, borderRadius: 10, border: 'none', boxShadow: '0 8px 22px rgba(178,34,34,0.18)' }}
            >
              Crowd the Space
            </button>
            <button
              onClick={() => {
                if (!animateRef.current.running) startCurveAnimation()
                else stopCurveAnimation()
              }}
              style={{ padding: '10px 12px', minWidth: 140, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: animateRef.current.running ? 'linear-gradient(90deg,#4b6cb7,#182848)' : 'linear-gradient(90deg,#6be5ff,#2b8cff)', color: '#fff', cursor: 'pointer' }}
            >
              {animateRef.current.running ? 'Stop Curve' : 'Animate Curve'}
            </button>
            <button
              onClick={() => {
                // Post the current debug options to the worker immediately and log for verification
                try {
                  // Prefer the ref which is kept up-to-date for long-lived closures so
                  // we always pick up the freshest settings (avoids race with setState).
                  const dbg = workerDebugRef.current ?? workerDebug
                  // Ensure the state and ref are synchronized so changes (like curveUDeg/curveVDeg)
                  // are definitely reflected in-memory before we persist them.
                  try {
                    workerDebugRef.current = dbg
                  } catch (err) {}
                  try {
                    // Update React state (harmless if same) so the persisted value is canonical
                    setWorkerDebug(dbg)
                  } catch (err) {}
                  // Explicitly persist current debug settings to localStorage
                  try {
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem('hexgrid.workerDebug', JSON.stringify(dbg))
                      try {
                        const verify = window.localStorage.getItem('hexgrid.workerDebug')
                        // Log the persisted value to help diagnose any persistence races
                        if (dbg.debugLogs) dlog('hexgrid.workerDebug persisted:', verify)
                      } catch (readErr) {
                        logger.warn('Failed to verify persisted debug settings:', readErr)
                      }
                    }
                  } catch (persistErr) {
                    logger.warn('Failed to persist debug settings:', persistErr)
                  }
                  if (dbg.debugLogs) dlog('Applying debug settings to worker now:', dbg)
                  if (workerRef.current) {
                    // Send a one-off evolve with current state so worker picks up debug options
                    const infectionsArray = Array.from(infectionStateRef.current.infections.entries())
                    const stateToSend = {
                      infections: infectionsArray,
                      availableIndices: infectionStateRef.current.availableIndices,
                      lastEvolutionTime: infectionStateRef.current.lastEvolutionTime,
                      generation: infectionStateRef.current.generation
                    }
                    sendEvolve(stateToSend, hexPositions, photos, drawnHexRadius, 'fps-fallback-final')
                    if (dbg.debugLogs) dlog('Evolve message posted to worker with debug:', dbg)
                    // Provide immediate UI feedback
                    setApplyStatus('applied')
                    if (applyTimeoutRef.current) window.clearTimeout(applyTimeoutRef.current)
                    applyTimeoutRef.current = window.setTimeout(() => setApplyStatus(null), 2000)
                  } else {
                    logger.warn('Worker not initialized yet; cannot apply debug settings')
                    setApplyStatus('failed')
                    if (applyTimeoutRef.current) window.clearTimeout(applyTimeoutRef.current)
                    applyTimeoutRef.current = window.setTimeout(() => setApplyStatus(null), 2000)
                  }
                } catch (err) {
                  logger.error('Failed to apply debug settings to worker:', err)
                  setApplyStatus('failed')
                  if (applyTimeoutRef.current) window.clearTimeout(applyTimeoutRef.current)
                  applyTimeoutRef.current = window.setTimeout(() => setApplyStatus(null), 2000)
                }
              }}
              style={{ padding: '10px 12px', minWidth: 140, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))', color: '#fff', cursor: 'pointer', position: 'relative' }}
            >
              Apply Debug Now
              {applyStatus === 'applied' && <span style={{ position: 'absolute', right: -6, top: -10, background: '#2ecc71', color: '#022', padding: '4px 8px', borderRadius: 8, fontSize: 11 }}>Applied</span>}
              {applyStatus === 'failed' && <span style={{ position: 'absolute', right: -6, top: -10, background: '#ff6b6b', color: '#220', padding: '4px 8px', borderRadius: 8, fontSize: 11 }}>Failed</span>}
            </button>
            <button
              onClick={() => {
                try {
                  if (!maxCrowdActive) {
                    // Activate max crowd: save previous debug and apply ultra-aggressive preset
                    prevDebugRef.current = workerDebug
                    const maxPreset = {
                      ...workerDebug,
                      spawnEnabled: true,
                      spawnRateMultiplier: 6.0,
                      spawnClusterMax: 20,
                      reproThreshold3: 2,
                      reproChance3: 0.9999,
                      reproChance2: 0.995,
                      reproChance1: 0.99,
                      reproChance0: 0.8,
                      reproPriorityMultiplier3: 8.0,
                      streamMs: 4,
                      evolveIntervalMs: 200
                    }
                    setWorkerDebug(maxPreset)
                    // post an evolve so worker picks it up immediately
                    if (workerRef.current) {
                      const infectionsArray = Array.from(infectionStateRef.current.infections.entries())
                      const stateToSend = {
                        infections: infectionsArray,
                        availableIndices: infectionStateRef.current.availableIndices,
                        lastEvolutionTime: infectionStateRef.current.lastEvolutionTime,
                        generation: infectionStateRef.current.generation
                      }
                      sendEvolve(stateToSend, hexPositions, photos, drawnHexRadius, 'apply-max-preset')
                    }
                    setMaxCrowdActive(true)
                  } else {
                    // Deactivate: restore previous debug
                    if (prevDebugRef.current) setWorkerDebug(prevDebugRef.current)
                    prevDebugRef.current = null
                    setMaxCrowdActive(false)
                  }
                } catch (err) {
                  logger.error('Failed to toggle Max Crowd:', err)
                }
              }}
              style={{ background: maxCrowdActive ? 'linear-gradient(90deg,#444,#333)' : 'linear-gradient(90deg,#ff9a4d,#ff4500)', color: '#fff', padding: '10px 12px', minWidth: 120, borderRadius: 10, border: 'none' }}
            >
              {maxCrowdActive ? 'Disable Max Crowd' : 'Max Crowd'}
            </button>
          </div>
        </div>
      )}
      {/* Hover metadata overlay */}
      {hoverInfo && (() => {
        const inf = infectionState.infections.get(hoverInfo.index)
        if (!inf) return null
        // Try to extract mapping debug info from projectedPositions if available
  const proj = projectedPositionsRef.current[hoverInfo.index] as any
    // projectedPositionsRef stores [x,y,scale,angle,z,mappingDebug]
    const mapping = proj && proj[5] && (proj[5] as any).mappingDebug ? (proj[5] as any).mappingDebug : null
        return (
          <div style={{ position: 'fixed', left: hoverInfo.x + 12, top: hoverInfo.y + 12, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '8px 10px', borderRadius: 6, pointerEvents: 'none', fontSize: 13, minWidth: 220 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{decodeHTMLEntities(inf.photo.title)}</div>
            {inf.photo.location && <div style={{ opacity: 0.85 }}>{inf.photo.location}</div>}
            {showMappingDebug && mapping && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#cfe7ff' }}>
                <div>u: {mapping.u.toFixed(4)} v: {mapping.v.toFixed(4)}</div>
                <div>lon: {(mapping.lon).toFixed(3)} rad lat: {(mapping.lat).toFixed(3)} rad</div>
                <div>R: {Number(mapping.R).toFixed(1)}</div>
                <div>world: x:{mapping.world.x.toFixed(1)} y:{mapping.world.y.toFixed(1)} z:{mapping.world.z.toFixed(1)}</div>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// 2D Drawing functions
// Helper: Convert UV bounds to source pixel rectangle with proper clamping
// Uses floor for start coordinates and calculates width/height to ensure
// adjacent tiles share exact pixel boundaries (no gaps or overlaps)
function uvBoundsToSrcRect(
  uvBounds: [number, number, number, number],
  img: HTMLImageElement
): { srcX: number; srcY: number; srcW: number; srcH: number } {
  const [minU, minV, maxU, maxV] = uvBounds
  const imgW = img.width
  const imgH = img.height

  // V=1.0 is top of texture in this codebase convention
  // Use floor for start coordinates to ensure pixel-perfect alignment
  const srcXStart = Math.floor(minU * imgW)
  const srcXEnd = Math.floor(maxU * imgW)
  const srcYStart = Math.floor((1 - maxV) * imgH)
  const srcYEnd = Math.floor((1 - minV) * imgH)
  
  // Calculate width/height from endpoints to ensure contiguity
  let srcX = srcXStart
  let srcW = srcXEnd - srcXStart
  let srcY = srcYStart
  let srcH = srcYEnd - srcYStart

  // Clamp to image bounds
  srcX = Math.max(0, Math.min(imgW - 1, srcX))
  srcY = Math.max(0, Math.min(imgH - 1, srcY))
  srcW = Math.max(1, Math.min(imgW - srcX, srcW))
  srcH = Math.max(1, Math.min(imgH - srcY, srcH))

  return { srcX, srcY, srcW, srcH }
}

function drawHexagon(
  ctx: CanvasRenderingContext2D,
  position: [number, number, number],
  radius: number,
  infection: Infection | undefined,
  textures: Map<string, HTMLImageElement>,
  index: number,
  blankNeighborCount: number,
  smoothedAlpha: number,
  sheenProgress: number,
  sheenIntensity: number,
  sheenEnabled: boolean,
  scratchEnabled: boolean,
  scratchCanvas: HTMLCanvasElement | null,
  seamBlend: number = 0,
  pulseProgress: number,
  flipH = false,
  flipV = false,
  angle = 0
) {
  const [x, y] = position
  
  ctx.save()
  ctx.translate(x, y)
  // Apply rotation so the tile aligns with local sphere tangent
  if (angle) ctx.rotate(angle)
  
  // Draw hexagon shape
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6 // Flat top
    const hx = Math.cos(angle) * radius
    const hy = Math.sin(angle) * radius
    
    if (i === 0) {
      ctx.moveTo(hx, hy)
    } else {
      ctx.lineTo(hx, hy)
    }
  }
  ctx.closePath()
  
  // smoothedAlpha provided by caller
  const neighborAlpha = smoothedAlpha

  if (infection) {
    // Draw infected hexagon with texture and glass overlay
    const texture = textures.get(infection.photo.id)
      if (texture) {
      // Clip to hexagon shape before drawing image
      ctx.clip()

      // Use helper to compute source rectangle with correct V-origin handling
      const inner = uvBoundsToSrcRect(infection.uvBounds, texture)

  // Apply neighbor-based translucency
  const prevAlpha = ctx.globalAlpha
  ctx.globalAlpha = neighborAlpha

      // Create a small composited image that blends an outer crop (which can
      // include neighboring pixels) with the inner inset crop. This reduces
      // hard seams when adjacent tiles don't match exactly. We reuse a
      // transient offscreen canvas attached to the function object to avoid
      // allocating each frame.
      const tmp: HTMLCanvasElement = (drawHexagon as any)._blendCanvas || ((drawHexagon as any)._blendCanvas = document.createElement('canvas'))
      const tmpCtx = tmp.getContext('2d')!
      const size = Math.max(2, Math.ceil(radius * 2))
      if (tmp.width !== size || tmp.height !== size) {
        tmp.width = size
        tmp.height = size
      }

      // Outer crop expands the inset UVs by seamBlend to include neighbor pixels.
      // Reduce expansion to 50% of seamBlend value for less aggressive blending
      const expand = Math.max(0, Math.min(0.25, (Number(seamBlend) || 0) * 0.5))
      const [minU, minV, maxU, maxV] = infection.uvBounds
      const outerMinU = Math.max(0, minU - expand)
      const outerMinV = Math.max(0, minV - expand)
      const outerMaxU = Math.min(1, maxU + expand)
      const outerMaxV = Math.min(1, maxV + expand)

      const outer = uvBoundsToSrcRect([outerMinU, outerMinV, outerMaxU, outerMaxV], texture)

      // Clear temp canvas
      tmpCtx.clearRect(0, 0, tmp.width, tmp.height)

      // Draw outer crop with modest alpha so edges blend (only if expand > 0)
      if (expand > 0 && outer.srcW > 0 && outer.srcH > 0) {
        // Reduce alpha further for subtler blending
        tmpCtx.globalAlpha = Math.max(0.08, Math.min(0.35, expand * 3))
        try {
          tmpCtx.drawImage(texture, outer.srcX, outer.srcY, outer.srcW, outer.srcH, 0, 0, tmp.width, tmp.height)
        } catch (err) {
          // fallback to inner-only if drawing fails
          tmpCtx.globalAlpha = 1
        }
      }

      // Draw inner (inset) crop fully opaque on top
      tmpCtx.globalAlpha = 1
      try {
        tmpCtx.drawImage(texture, inner.srcX, inner.srcY, inner.srcW, inner.srcH, 0, 0, tmp.width, tmp.height)
      } catch (err) {
        // If this fails, fall back to nothing; we'll draw fallback fill below
      }

      // Now draw the composed tmp canvas into the rotated/flipped context so
      // any existing rotation/flip logic remains unchanged.
      ctx.save()
      const snap = Math.round(angle / Math.PI) * Math.PI
      const rotateDelta = snap - angle
      if (rotateDelta) ctx.rotate(rotateDelta)
      if (flipH || flipV) {
        const sx = flipH ? -1 : 1
        const sy = flipV ? -1 : 1
        ctx.scale(sx, sy)
      }
      ctx.drawImage(tmp, -radius, -radius, radius * 2, radius * 2)
      ctx.restore()

      // Subtle emotion color tint overlay on textured tiles
      if (infection.photo.dominantColor) {
        ctx.globalCompositeOperation = 'source-atop'
        ctx.fillStyle = infection.photo.dominantColor
        ctx.globalAlpha = 0.15
        ctx.fill()
        ctx.globalAlpha = 1.0
        ctx.globalCompositeOperation = 'source-over'
      }

      // Restore alpha for overlays
      ctx.globalAlpha = 1.0

      // Glass overlay: subtle top highlight with animated sheen (guarded)
      if (sheenEnabled) {
        const sheenWidth = radius * 1.6
        const sheenX = ((sheenProgress * 0.6 + index * 0.13) % 1.0) * (radius * 2 + sheenWidth) - sheenWidth / 2 - radius
        const sheenGrad = ctx.createLinearGradient(sheenX, -radius, sheenX + sheenWidth, radius)
        sheenGrad.addColorStop(0, `rgba(255,255,255,0.00)`)
        sheenGrad.addColorStop(0.45, `rgba(255,255,255,${Math.max(0, sheenIntensity * 0.5)})`)
        sheenGrad.addColorStop(0.5, `rgba(255,255,255,${sheenIntensity})`)
        sheenGrad.addColorStop(0.55, `rgba(255,255,255,${Math.max(0, sheenIntensity * 0.5)})`)
        sheenGrad.addColorStop(1, `rgba(255,255,255,0.00)`)

        ctx.fillStyle = sheenGrad
        ctx.globalCompositeOperation = 'source-atop'
        ctx.fill()
      }

      // Slight inner darkening at edges to simulate depth
      ctx.fillStyle = 'rgba(0,0,0,0.06)'
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + Math.PI / 6
        const hx = Math.cos(angle) * (radius * 0.98)
        const hy = Math.sin(angle) * (radius * 0.98)
        if (i === 0) ctx.moveTo(hx, hy)
        else ctx.lineTo(hx, hy)
      }
      ctx.closePath()
      ctx.fill()

      // Scratch overlay for micro details (optional)
      if (scratchEnabled && scratchCanvas) {
        ctx.globalAlpha = 0.08
        ctx.globalCompositeOperation = 'source-atop'
        // Tile the scratch canvas slightly scaled
        const scale = (radius * 2) / scratchCanvas.width
        ctx.save()
        ctx.scale(scale, scale)
        ctx.drawImage(scratchCanvas, -radius / scale, -radius / scale)
        ctx.restore()
        ctx.globalCompositeOperation = 'source-over'
      }

      // Very subtle outer stroke to separate adjacent images (kept minimal)
      ctx.globalAlpha = 1.0
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 0.6
      ctx.stroke()
      ctx.globalAlpha = prevAlpha
    } else {
      // Fallback: use dominantColor if available, otherwise muted glass tile
      const dc = infection.photo.dominantColor
      if (dc) {
        ctx.clip()
        // Apply neighbor-based translucency
        const prevAlpha = ctx.globalAlpha
        ctx.globalAlpha = neighborAlpha

        // Fill with emotion color at moderate opacity
        ctx.fillStyle = dc
        ctx.globalAlpha = 0.7
        ctx.fill()
        ctx.globalAlpha = 1.0

        // Add radial gradient for depth (lighter center, darker edges)
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
        grad.addColorStop(0, 'rgba(255,255,255,0.15)')
        grad.addColorStop(1, 'rgba(0,0,0,0.2)')
        ctx.fillStyle = grad
        ctx.fill()

        // Glass overlay: sheen effect (same as textured tiles)
        if (sheenEnabled) {
          const sheenWidth = radius * 1.6
          const sheenX = ((sheenProgress * 0.6 + index * 0.13) % 1.0) * (radius * 2 + sheenWidth) - sheenWidth / 2 - radius
          const sheenGrad = ctx.createLinearGradient(sheenX, -radius, sheenX + sheenWidth, radius)
          sheenGrad.addColorStop(0, `rgba(255,255,255,0.00)`)
          sheenGrad.addColorStop(0.45, `rgba(255,255,255,${Math.max(0, sheenIntensity * 0.5)})`)
          sheenGrad.addColorStop(0.5, `rgba(255,255,255,${sheenIntensity})`)
          sheenGrad.addColorStop(0.55, `rgba(255,255,255,${Math.max(0, sheenIntensity * 0.5)})`)
          sheenGrad.addColorStop(1, `rgba(255,255,255,0.00)`)

          ctx.fillStyle = sheenGrad
          ctx.globalCompositeOperation = 'source-atop'
          ctx.fill()
        }

        // Slight inner darkening at edges to simulate depth
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = 'rgba(0,0,0,0.06)'
        ctx.beginPath()
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + Math.PI / 6
          const hx = Math.cos(angle) * (radius * 0.98)
          const hy = Math.sin(angle) * (radius * 0.98)
          if (i === 0) ctx.moveTo(hx, hy)
          else ctx.lineTo(hx, hy)
        }
        ctx.closePath()
        ctx.fill()

        // Scratch overlay for micro details (optional)
        if (scratchEnabled && scratchCanvas) {
          ctx.globalAlpha = 0.08
          ctx.globalCompositeOperation = 'source-atop'
          const scale = (radius * 2) / scratchCanvas.width
          ctx.save()
          ctx.scale(scale, scale)
          ctx.drawImage(scratchCanvas, -radius / scale, -radius / scale)
          ctx.restore()
          ctx.globalCompositeOperation = 'source-over'
        }

        // Subtle outer stroke
        ctx.globalAlpha = 1.0
        ctx.strokeStyle = 'rgba(255,255,255,0.04)'
        ctx.lineWidth = 0.6
        ctx.stroke()
        ctx.globalAlpha = prevAlpha
      } else {
        ctx.fillStyle = 'rgba(100,110,120,0.12)'
        ctx.fill()
      }
    }
  } else {
    // Draw uninfected hexagon as a translucent glass tile with no border
    // Create a subtle frosted gradient
    const grad = ctx.createLinearGradient(-radius, -radius, radius, radius)
    grad.addColorStop(0, 'rgba(255,255,255,0.06)')
    grad.addColorStop(1, 'rgba(255,255,255,0.01)')

    ctx.fillStyle = grad
    ctx.fill()

    // Add a faint inner sheen to sell the glass effect
    ctx.fillStyle = 'rgba(255,255,255,0.02)'
    ctx.beginPath()
    ctx.moveTo(-radius * 0.6, -radius * 0.9)
    ctx.quadraticCurveTo(-radius * 0.2, -radius * 0.4, radius * 0.6, -radius * 0.2)
    ctx.lineTo(radius * 0.6, -radius * 0.6)
    ctx.quadraticCurveTo(0, -radius * 0.8, -radius * 0.6, -radius * 0.9)
    ctx.closePath()
    ctx.fill()

    // No cyberpunk stroke - keep edges soft. Optionally add a hairline highlight.
    ctx.strokeStyle = 'rgba(255,255,255,0.02)'
    ctx.lineWidth = 0.4
    ctx.stroke()
  }
  // Pulse glow for newly added/updated tiles
  if (pulseProgress > 0) {
    // Simple pulse glow: fade out and expand around the hexagon
    const glowAlpha = (1 - pulseProgress) * 0.28
    const glowRadius = radius * (1 + pulseProgress * 0.6)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6
      const hx = Math.cos(a) * glowRadius
      const hy = Math.sin(a) * glowRadius
      if (i === 0) ctx.moveTo(hx, hy)
      else ctx.lineTo(hx, hy)
    }
    ctx.closePath()
    const pulseColor = infection?.photo.dominantColor
    if (pulseColor && pulseColor.length >= 7 && pulseColor[0] === '#') {
      const r = parseInt(pulseColor.slice(1, 3), 16)
      const g = parseInt(pulseColor.slice(3, 5), 16)
      const b = parseInt(pulseColor.slice(5, 7), 16)
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${glowAlpha})`
    } else {
      ctx.fillStyle = `rgba(180, 220, 255, ${glowAlpha})`
    }
    ctx.fill()
    ctx.restore()
  }

  ctx.restore()
}

// Hit test for a flat-top hexagon. Works in the hex's local (unrotated) space.
function isPointInHexagon(px: number, py: number, position: [number, number, number], radius: number, angle = 0): boolean {
  const [hx, hy] = position
  // rotate point into hex local space by -angle
  const cosA = Math.cos(-angle)
  const sinA = Math.sin(-angle)
  const dxRaw = px - hx
  const dyRaw = py - hy
  const dx = dxRaw * cosA - dyRaw * sinA
  const dy = dxRaw * sinA + dyRaw * cosA

  // Bounding box quick-reject using hex's circumscribed rectangle
  if (Math.abs(dx) > radius * 1.0 || Math.abs(dy) > radius * Math.sqrt(3) / 2) return false

  // Use flat-top hexagon math: hexagon with radius R has width = 2*R and height = sqrt(3)*R
  // Convert to first sextant using absolute symmetry
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)

  const w = radius * 2
  const h = Math.sqrt(3) * radius

  // If point is in central rectangle region, it's inside
  if (ax <= radius && ay <= (h / 2)) return true

  // Otherwise check the upper-right triangle region of the hex
  // Compute distance from the triangle's center line
  const dxTri = ax - radius
  const maxDy = (-Math.sqrt(3) * dxTri) + (h / 2)
  return ay <= maxDy
}
function generatePixelScreen(cols: number, rows: number, hexRadius: number): [number, number, number][] {
  const positions: [number, number, number][] = []
  
  // GUARD: Validate input parameters to prevent invalid hexagons
  if (!Number.isFinite(cols) || !Number.isFinite(rows) || !Number.isFinite(hexRadius)) {
    logger.error('generatePixelScreen: Invalid input parameters', { cols, rows, hexRadius })
    return positions
  }
  
  if (cols <= 0 || rows <= 0 || hexRadius <= 0) {
    logger.error('generatePixelScreen: Parameters must be positive', { cols, rows, hexRadius })
    return positions
  }
  
  const sqrt3 = Math.sqrt(3)
  // Use perfect hexagonal packing math
  const horizontalSpacing = sqrt3 * hexRadius
  const verticalSpacing = 1.5 * hexRadius
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Base position
      let x = col * horizontalSpacing
      const y = row * verticalSpacing
      
      // Apply the "wiggle" offset for odd rows to maintain hexagonal packing
      if (row % 2 !== 0) {
        x += horizontalSpacing * 0.5
      }
      
      // Position is guaranteed valid by input validation
      positions.push([x, y, 0])
    }
  }
  
  // No centering needed for canvas - positions are already in canvas coordinates
  return positions
}

// Generate hexagons directly in spherical space for compact 3D packing
function generateSphericalHexGrid(
  targetCount: number, 
  screenWidth: number, 
  screenHeight: number,
  curveUDeg: number,
  curveVDeg: number,
  densityMultiplier: number = 1.4,
  hexRadius: number  // The actual hex radius used for drawing
): { positions: [number, number, number][], metadata: { cols: number, rows: number, isSpherical: true } } {
  const positions: [number, number, number][] = []
  
  const sqrt3 = Math.sqrt(3)
  
  // Calculate grid dimensions based on hex radius and screen size
  // Use the SAME spacing math as the flat grid for consistency
  const baseHorizontalSpacing = sqrt3 * hexRadius
  const baseVerticalSpacing = 1.5 * hexRadius
  
  // Calculate how many hexes fit based on actual hex size
  const baseCols = Math.ceil(screenWidth / baseHorizontalSpacing)
  const baseRows = Math.ceil(screenHeight / baseVerticalSpacing)
  
  // Apply density multiplier to get more/fewer hexes
  const cols = Math.ceil(baseCols * Math.sqrt(densityMultiplier))
  const rows = Math.ceil(baseRows * Math.sqrt(densityMultiplier))
  
  const deg2rad = Math.PI / 180
  
  // Use the same spacing for generation (already calculated above)
  const verticalSpacing = baseVerticalSpacing
  const horizontalSpacing = baseHorizontalSpacing
  
  // Generate positions directly in lat/lon space with proper hexagonal offsets
  // Apply adaptive density based on latitude to naturally handle pole convergence
  for (let row = 0; row < rows; row++) {
    // Use vertical spacing for proper hex packing
    const y = row * verticalSpacing
    
    // Calculate latitude for this row to determine if we're near a pole
    const v = y / Math.max(1, screenHeight)
    
    // Clamp v to [0, 1] range
    if (v < 0 || v > 1) continue
    
    const lat = (v - 0.5) * (curveVDeg * deg2rad)
    
    // Natural pole density reduction: fewer hexes per row near poles
    // This is more physically accurate for spherical surfaces
    const latFactor = Math.max(0.3, Math.abs(Math.cos(lat)))
    const effectiveColsForRow = Math.max(3, Math.round(cols * latFactor))
    
    // CRITICAL: Calculate hex offset based on the base spacing (not per-row spacing)
    // This ensures proper nesting at all latitudes
    const hexOffsetX = horizontalSpacing * 0.5
    
    for (let col = 0; col < effectiveColsForRow; col++) {
      // Start with evenly distributed positions in screen space
      let x = col * horizontalSpacing
      
      // Apply hexagonal offset for odd rows in SCREEN SPACE
      // This ensures hexagons nestle properly between rows below
      if (row % 2 !== 0) {
        x += hexOffsetX
      }
      
      // Wrap/clamp x to screen bounds
      // For full 360° wrap, hexes can exceed screen width and will wrap in projection
      // For partial coverage, clamp to screen
      if (Math.abs(curveUDeg) < 359) {
        x = Math.max(0, Math.min(screenWidth, x))
      }
      
      positions.push([x, y, 0])
    }
  }
  
  return { positions, metadata: { cols, rows, isSpherical: true } }
}

// Initialize the infection system with seed infections
type LoggerType = typeof logger
function initializeInfectionSystem(
  positions: [number, number, number][], 
  photos: Photo[], 
  hexRadius: number, 
  initialClusterMax = 3,
  loggerParam: LoggerType = logger,
  isSpherical: boolean = false
): InfectionSystemState {
  const logger = loggerParam
  // GUARD: Validate inputs to prevent creating invalid infections
  if (!positions || positions.length === 0) {
    logger.error('initializeInfectionSystem: No valid positions provided')
    return {
      infections: new Map(),
      availableIndices: [],
      lastEvolutionTime: 0,
      generation: 0
    }
  }
  
  if (!photos || photos.length === 0) {
    logger.error('initializeInfectionSystem: No photos provided')
    return {
      infections: new Map(),
      availableIndices: Array.from({ length: positions.length }, (_, i) => i),
      lastEvolutionTime: 0,
      generation: 0
    }
  }
  
  const availableIndices = Array.from({ length: positions.length }, (_, i) => i)
  const infections: Map<number, Infection> = new Map()
  
  // Meritocratic growth rate mapping (same as worker)
  const minGrowthRate = 0.05
  const maxGrowthRate = 0.20
  
  // Start with multiple infection seeds for better cluster formation
  const numSeeds = Math.min(photos.length, Math.max(5, Math.floor(positions.length / 30)))
  
  logger.log(`Initializing gossip system: ${positions.length} hexagons, ${photos.length} photos, spawning ${numSeeds} seeds (cluster max ${initialClusterMax})`)
  
  // Helper gaussian sampler (Box-Muller)
  function gaussianRandom() {
    let u = 0, v = 0
    // Clamp to prevent extreme values from near-zero random numbers
    while (u === 0) u = Math.max(1e-10, Math.random())
    while (v === 0) v = Math.max(1e-10, Math.random())
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  }

  for (let seed = 0; seed < numSeeds; seed++) {
    if (availableIndices.length === 0) break

    // pick a random center for this seed
    const centerAvailPos = Math.floor(Math.random() * availableIndices.length)
    const seedIndex = availableIndices.splice(centerAvailPos, 1)[0]
    
    // GUARD: Validate the seed index before using it
    if (seedIndex < 0 || seedIndex >= positions.length) {
      logger.error('initializeInfectionSystem: Invalid seed index', seedIndex)
      continue
    }
    
    const photo = photos[seed % photos.length]

    // Determine cluster size sampled from approx-normal distribution, clamped
    const maxCluster = Math.max(1, Math.floor(initialClusterMax))
    const mean = Math.max(1, maxCluster / 2)
    const stddev = Math.max(0.5, maxCluster / 3)
    let raw = Math.round(mean + gaussianRandom() * stddev)
    raw = Math.max(1, Math.min(maxCluster, raw))
    const clusterSize = raw

    const clusterIndices = [seedIndex]

    // Collect available neighbors to expand cluster
    const neighbors = getNeighbors(seedIndex, positions, hexRadius, isSpherical)
    const availableNeighbors: number[] = []
    for (const n of neighbors) {
      if (!infections.has(n) && availableIndices.includes(n)) availableNeighbors.push(n)
    }

    // Shuffle availableNeighbors
    for (let i = availableNeighbors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = availableNeighbors[i]
      availableNeighbors[i] = availableNeighbors[j]
      availableNeighbors[j] = tmp
    }

    for (let i = 1; i < clusterSize && availableNeighbors.length > 0; i++) {
      const next = availableNeighbors.pop()!
      clusterIndices.push(next)
      const ai = availableIndices.indexOf(next)
      if (ai !== -1) availableIndices.splice(ai, 1)
    }

    // Map photo's velocity to growthRate using tunable min/max range
    const velocity = photo.velocity ?? 0.5
    const normalizedVelocity = Math.max(0.1, Math.min(1.0, velocity)) // Clamp to [0.1, 1.0]
    // Map velocity [0.1, 1.0] to growthRate [minGrowthRate, maxGrowthRate]
    const mappedGrowthRate = minGrowthRate + (normalizedVelocity - 0.1) * (maxGrowthRate - minGrowthRate) / 0.9

    for (const idx of clusterIndices) {
      // GUARD: Validate each cluster index before creating an infection
      if (idx < 0 || idx >= positions.length) {
        logger.error('initializeInfectionSystem: Invalid cluster index', idx)
        continue
      }
      
      infections.set(idx, {
        photo,
        gridPosition: [0, 0], // Will be optimized later
        infectionTime: 0,
        generation: 0,
        uvBounds: calculateUvBoundsFromGridPosition(0, 0, 4, 4),
        scale: 0.4 + Math.random() * 0.9,
        growthRate: mappedGrowthRate, // Use meritocratic growth rate from velocity mapping
        tilesX: 4,
        tilesY: 4
      })
    }
  }
  
  logger.log(`Initialized ${infections.size} gossip entries`)
  
  return {
    infections,
    availableIndices,
    lastEvolutionTime: 0,
    generation: 0
  }
}

// Evolve the infection system continuously
function evolveInfectionSystem(
  prevState: InfectionSystemState, 
  positions: [number, number, number][], 
  photos: Photo[], 
  hexRadius: number,
  currentTime: number,
  debug?: any
): InfectionSystemState {
  const { infections, availableIndices, generation } = prevState
  const newInfections = new Map(infections)
  const newAvailableIndices = [...availableIndices]
  const newGeneration = generation + 1

  // Use tighter locality ranges so photos grow by contacting nearby neighbors
  const neighborRange = hexRadius * 2.2
  const bridgeRange = hexRadius * 2.6
  const competitionRange = hexRadius * 2.8
  
  // Meritocratic growth rate mapping (same as worker)
  const minGrowthRate = debug?.minGrowthRate ?? 0.05
  const maxGrowthRate = debug?.maxGrowthRate ?? 0.20
  
  // Process new infections for this generation
  const newInfectionCandidates: Map<number, Infection> = new Map()
  
  // Analyze current connected components to prioritize bridge-building
  const photoClusters = new Map<Photo, number[][]>() // photo -> array of components
  for (const [index, infection] of newInfections) {
    if (!photoClusters.has(infection.photo)) {
      photoClusters.set(infection.photo, [])
    }
  }
  
  // Find connected components for each photo
  for (const [photo, components] of photoClusters) {
    const photoIndices = Array.from(newInfections.entries())
      .filter(([_, infection]) => infection.photo.id === photo.id)
      .map(([index, _]) => index)
    
    if (photoIndices.length === 0) continue
    
    const visited = new Set<number>()
    const photoComponents: number[][] = []
    
    for (const startIndex of photoIndices) {
      if (visited.has(startIndex)) continue
      
      const component: number[] = []
      const queue = [startIndex]
      visited.add(startIndex)
      
      while (queue.length > 0) {
        const currentIndex = queue.shift()!
        component.push(currentIndex)
        
        for (const otherIndex of photoIndices) {
          if (visited.has(otherIndex)) continue
          
          const currentPos = positions[currentIndex]
          const otherPos = positions[otherIndex]
          const distance = Math.sqrt(
            Math.pow(currentPos[0] - otherPos[0], 2) + 
            Math.pow(currentPos[1] - otherPos[1], 2)
          )
          
          if (distance <= hexRadius * 2.1) {
            visited.add(otherIndex)
            queue.push(otherIndex)
          }
        }
      }
      
      photoComponents.push(component)
    }
    
    photoClusters.set(photo, photoComponents)
  }
  
  // Find hexagons that can be infected this generation
  for (const [infectedIndex, infection] of newInfections) {
    if (infection.generation !== generation) continue
    
    const infectedPos = positions[infectedIndex]
    
    // Find neighboring hexagons that could be infected
    for (let i = 0; i < newAvailableIndices.length; i++) {
      const candidateIndex = newAvailableIndices[i]
      const candidatePos = positions[candidateIndex]
      
      const distance = Math.sqrt(
        Math.pow(infectedPos[0] - candidatePos[0], 2) + 
        Math.pow(infectedPos[1] - candidatePos[1], 2)
      )
      
    if (distance <= neighborRange) {
        // Count infected neighbors
        let infectedNeighbors = 0
        let samePhotoNeighbors = 0
        let differentPhotoNeighbors = 0
        
        for (const [otherIndex, otherInfection] of newInfections) {
          if (otherIndex === infectedIndex) continue
          const otherPos = positions[otherIndex]
          const neighborDist = Math.sqrt(
            Math.pow(candidatePos[0] - otherPos[0], 2) + 
            Math.pow(candidatePos[1] - otherPos[1], 2)
          )
          if (neighborDist <= neighborRange) {
            infectedNeighbors++
            if (otherInfection.photo.id === infection.photo.id) {
              samePhotoNeighbors++
            } else {
              differentPhotoNeighbors++
            }
          }
        }
        
        // Prioritize infecting with the same photo to connect components
        let chosenPhoto = infection.photo
        let infectionPriority = 1.0
        
        // If this hexagon would connect multiple same-photo components, prioritize it highly
        const components = photoClusters.get(infection.photo) || []
        if (components.length > 1) {
          let connectedComponents = 0
          for (const component of components) {
            for (const compIndex of component) {
              const compPos = positions[compIndex]
              const compDist = Math.sqrt(
                Math.pow(candidatePos[0] - compPos[0], 2) + 
                Math.pow(candidatePos[1] - compPos[1], 2)
              )
              if (compDist <= bridgeRange) {
                connectedComponents++
                break
              }
            }
          }
          if (connectedComponents >= 2) {
            infectionPriority = 3.0 // Triple priority for bridge hexagons
            chosenPhoto = infection.photo
          }
        }
        
        // Enhanced infection rules with bridge-building priority
        const mutationChance = 0.1 // Reduced mutation chance
        
        // Find dominant photo among neighbors, but prioritize same-photo connections
        let dominantPhoto = infection.photo
        let maxNeighbors = samePhotoNeighbors // Start with same-photo count
        
        if (samePhotoNeighbors === 0) {
          // If no same-photo neighbors, look for dominant different photo
          const photoCounts = new Map<string, number>()
          
          for (const [otherIndex, otherInfection] of newInfections) {
            if (otherIndex === infectedIndex) continue
            const otherPos = positions[otherIndex]
            const neighborDist = Math.sqrt(
              Math.pow(candidatePos[0] - otherPos[0], 2) + 
              Math.pow(candidatePos[1] - otherPos[1], 2)
            )
            if (neighborDist <= neighborRange) {
              const photoId = otherInfection.photo.id
              photoCounts.set(photoId, (photoCounts.get(photoId) || 0) + 1)
              
              if (photoCounts.get(photoId)! > maxNeighbors) {
                maxNeighbors = photoCounts.get(photoId)!
                dominantPhoto = otherInfection.photo
              }
            }
          }
          
          if (Math.random() < mutationChance && dominantPhoto && dominantPhoto.id !== infection.photo.id) {
            chosenPhoto = dominantPhoto
          } else if (Math.random() < 0.03) { // Reduced random mutation
            chosenPhoto = photos[Math.floor(Math.random() * photos.length)]
          }
        }
        
  // Use live-configurable reproduction parameters from debug (passed in)
  const t3 = Math.max(1, Math.floor(debug?.reproThreshold3 ?? 3))
  const chance3 = debug?.reproChance3 ?? 0.98
  const chance2 = debug?.reproChance2 ?? 0.85
  const chance1 = debug?.reproChance1 ?? 0.6
  const chance0 = debug?.reproChance0 ?? 0.15
  const priorityMul3 = debug?.reproPriorityMultiplier3 ?? 3.0

        // Base infection chance determined by how many infected neighbors exist
        let baseInfectionChance: number
        if (infectedNeighbors >= t3) {
          baseInfectionChance = chance3
          infectionPriority *= priorityMul3
        } else if (infectedNeighbors === 2) {
          baseInfectionChance = chance2
        } else if (infectedNeighbors === 1) {
          baseInfectionChance = chance1
        } else {
          baseInfectionChance = chance0
        }

        // Make it easier to infect a candidate that currently has fewer same-photo neighbors.
        // Rationale: isolated spots (few same-photo neighbors) should be easier to capture so
        // small fragments can grow and connect. We apply a smooth multiplier that is larger
        // when samePhotoNeighbors is lower. The factor is clamped to avoid runaway probabilities.
        const MAX_NEIGHBORS = 6
        // When samePhotoNeighbors == 0 -> boostFactor ~ 1.7 ; ==1 -> ~1.35 ; >=2 -> ~1.0
  const sameNeighborDeficit = Math.max(0, 2 - samePhotoNeighbors)
  // Use the live debug override passed into this evolution step, or a sane default.
  const perDeficit = Number(debug?.sameNeighborBoostPerDeficit ?? 0.35)
  const sameNeighborBoost = 1 + (perDeficit * sameNeighborDeficit)

        // Combine base chance, priority and same-neighbor boost. Clamp final chance to [0, 0.9999].
        let finalInfectionChance = baseInfectionChance * infectionPriority * sameNeighborBoost
        finalInfectionChance = Math.max(0, Math.min(0.9999, finalInfectionChance))

        const shouldInfect = Math.random() < finalInfectionChance
        
        if (shouldInfect && !newInfectionCandidates.has(candidateIndex)) {
          const tilesX = 4
          const tilesY = 4
          const uvBounds = calculateUvBoundsFromGridPosition(0, 0, tilesX, tilesY)
          newInfectionCandidates.set(candidateIndex, {
            photo: chosenPhoto,
            gridPosition: [0, 0], // Will be optimized later
            infectionTime: currentTime,
            generation: newGeneration,
            uvBounds: uvBounds,
            scale: infection.scale * (0.7 + Math.random() * 0.6),
            growthRate: infection.growthRate * (0.8 + Math.random() * 0.4),
            tilesX: tilesX,
            tilesY: tilesY
          })
        }
      }
    }
  }
  
  // Targeted long-range jumps to connect disconnected components without scattering
  const jumpChance = 0.05
  if (Math.random() < jumpChance && newAvailableIndices.length > 0 && newInfections.size > 0) {
    // Prioritize jumps that would connect same-photo components
    let bestJumpTarget = -1
    let bestJumpScore = 0
    
    for (const targetIndex of newAvailableIndices) {
      const targetPos = positions[targetIndex]
      let score = 0
      
      // Check if this jump would connect multiple components of the same photo
      for (const [photo, components] of photoClusters) {
        if (components.length <= 1) continue // No need to connect if already connected
        
        let connectedComponents = 0
        for (const component of components) {
          for (const compIndex of component) {
            const compPos = positions[compIndex]
            const dist = Math.sqrt(
              Math.pow(targetPos[0] - compPos[0], 2) + 
              Math.pow(targetPos[1] - compPos[1], 2)
            )
            if (dist <= bridgeRange) {
              connectedComponents++
              break
            }
          }
        }
        
        if (connectedComponents >= 2) {
          score += connectedComponents * 10 // High score for bridge jumps
        }
      }
      
      if (score > bestJumpScore) {
        bestJumpScore = score
        bestJumpTarget = targetIndex
      }
    }
    
    if (bestJumpTarget !== -1 && bestJumpScore > 0) {
      // Use the best bridge jump
      const jumpTargetIndex = bestJumpTarget
      // Find the most common photo among nearby components
      const targetPos = positions[jumpTargetIndex]
      const nearbyPhotos = new Map<string, number>()
      
      for (const [photo, components] of photoClusters) {
        for (const component of components) {
          for (const compIndex of component) {
            const compPos = positions[compIndex]
            const dist = Math.sqrt(
              Math.pow(targetPos[0] - compPos[0], 2) + 
              Math.pow(targetPos[1] - compPos[1], 2)
            )
            if (dist <= bridgeRange * 1.2) {
              nearbyPhotos.set(photo.id, (nearbyPhotos.get(photo.id) || 0) + component.length)
            }
          }
        }
      }
      
      let bestPhoto = photos[0]
      let maxCount = 0
      for (const [photoId, count] of nearbyPhotos) {
        if (count > maxCount) {
          maxCount = count
          bestPhoto = photos.find(p => p.id === photoId) || photos[0]
        }
      }
      
      // Map photo's velocity to growthRate using tunable min/max range
      const velocity = bestPhoto.velocity ?? 0.5
      const normalizedVelocity = Math.max(0.1, Math.min(1.0, velocity)) // Clamp to [0.1, 1.0]
      // Map velocity [0.1, 1.0] to growthRate [minGrowthRate, maxGrowthRate]
      const mappedGrowthRate = minGrowthRate + (normalizedVelocity - 0.1) * (maxGrowthRate - minGrowthRate) / 0.9
      
      const tilesX = 4
      const tilesY = 4
      const uvBounds = calculateUvBoundsFromGridPosition(0, 0, tilesX, tilesY)
      const jumpSourceInfection: Infection = {
        photo: bestPhoto,
        gridPosition: [0, 0], // Will be optimized later
        infectionTime: currentTime,
        generation: newGeneration,
        uvBounds: uvBounds,
        scale: 0.3 + Math.random() * 0.5,
        growthRate: mappedGrowthRate, // Use meritocratic growth rate from velocity mapping
        tilesX: tilesX,
        tilesY: tilesY
      }
      if (jumpSourceInfection) {
        const targetPos = positions[jumpTargetIndex]
        
        let validJump = true
        for (const [existingIndex] of newInfections) {
          const existingPos = positions[existingIndex]
          const jumpDist = Math.sqrt(
            Math.pow(targetPos[0] - existingPos[0], 2) + 
            Math.pow(targetPos[1] - existingPos[1], 2)
          )
          if (jumpDist < neighborRange) {
            validJump = false
            break
          }
        }
        
        if (validJump) {
          newInfectionCandidates.set(jumpTargetIndex, jumpSourceInfection)
        }
      }
    }
  }
  
  // Targeted spawning near existing clusters to fill small gaps without scattering
  const maxConcurrentImages = Math.min(photos.length, Math.floor(positions.length / 80))
  if (newInfections.size < maxConcurrentImages && newAvailableIndices.length > 0) {
    const numSpawns = Math.min(3, newAvailableIndices.length)
    const shuffledCandidates = [...newAvailableIndices]
    for (let i = shuffledCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = shuffledCandidates[i]
      shuffledCandidates[i] = shuffledCandidates[j]
      shuffledCandidates[j] = tmp
    }

    const sampleLimit = Math.min(shuffledCandidates.length, 240)
    const spawnOptions: Array<{ index: number; photo: Photo; score: number }> = []

    for (let i = 0; i < sampleLimit; i++) {
      const candidateIndex = shuffledCandidates[i]
      const candidatePos = positions[candidateIndex]
      const photoCounts = new Map<string, { photo: Photo; count: number }>()

      for (const [otherIndex, infection] of newInfections) {
        const otherPos = positions[otherIndex]
        const dist = Math.sqrt(
          Math.pow(candidatePos[0] - otherPos[0], 2) +
          Math.pow(candidatePos[1] - otherPos[1], 2)
        )
        if (dist <= neighborRange) {
          const key = infection.photo.id
          const existing = photoCounts.get(key)
          if (existing) existing.count += 1
          else photoCounts.set(key, { photo: infection.photo, count: 1 })
        }
      }

      if (photoCounts.size === 0) continue

      let bestPhoto: Photo | null = null
      let bestCount = 0
      for (const { photo, count } of photoCounts.values()) {
        if (count > bestCount) {
          bestPhoto = photo
          bestCount = count
        }
      }

      if (bestPhoto && bestCount >= 2) {
        spawnOptions.push({ index: candidateIndex, photo: bestPhoto, score: bestCount })
      }
    }

    spawnOptions.sort((a, b) => b.score - a.score)
    const spawnsToApply = Math.min(numSpawns, spawnOptions.length)

    for (let i = 0; i < spawnsToApply; i++) {
      const { index, photo } = spawnOptions[i]
      if (newInfectionCandidates.has(index)) continue

      const velocity = photo.velocity ?? 0.5
      const normalizedVelocity = Math.max(0.1, Math.min(1.0, velocity))
      const mappedGrowthRate = minGrowthRate + (normalizedVelocity - 0.1) * (maxGrowthRate - minGrowthRate) / 0.9

      const tilesX = 4
      const tilesY = 4
      const uvBounds = calculateUvBoundsFromGridPosition(0, 0, tilesX, tilesY)
      newInfectionCandidates.set(index, {
        photo,
        gridPosition: [0, 0], // Will be optimized later
        infectionTime: currentTime,
        generation: newGeneration,
        uvBounds: uvBounds,
        scale: 0.25 + Math.random() * 0.5,
        growthRate: mappedGrowthRate,
        tilesX: tilesX,
        tilesY: tilesY
      })

      const removeIndex = newAvailableIndices.indexOf(index)
      if (removeIndex !== -1) newAvailableIndices.splice(removeIndex, 1)
    }
  }
  
  // Apply new infections
  for (const [index, infection] of newInfectionCandidates) {
    newInfections.set(index, infection)
    const removeIndex = newAvailableIndices.indexOf(index)
    if (removeIndex !== -1) {
      newAvailableIndices.splice(removeIndex, 1)
    }
  }
  
  // More aggressive competition to optimize connections
  const competitionChance = 0.04 // Occasional takeovers keep things dynamic without fragmenting groups
  if (Math.random() < competitionChance && newInfections.size > 1) {
    const infectionEntries = Array.from(newInfections.entries())
    const targetIndex = infectionEntries[Math.floor(Math.random() * infectionEntries.length)][0]
    const currentInfection = newInfections.get(targetIndex)!
    
    const nearbyInfections: Array<[number, Infection]> = []
    const targetPos = positions[targetIndex]
    
    for (const [otherIndex, otherInfection] of newInfections) {
      if (otherIndex === targetIndex) continue
      const otherPos = positions[otherIndex]
      const dist = Math.sqrt(
        Math.pow(targetPos[0] - otherPos[0], 2) + 
        Math.pow(targetPos[1] - otherPos[1], 2)
      )
  if (dist <= competitionRange) {
        nearbyInfections.push([otherIndex, otherInfection])
      }
    }
    
    if (nearbyInfections.length > 0) {
      const [competitorIndex, competitorInfection] = nearbyInfections[Math.floor(Math.random() * nearbyInfections.length)]
      
      // Competition favors connecting same-photo components
      const currentComponents = (photoClusters.get(currentInfection.photo) || []).length
      const competitorComponents = (photoClusters.get(competitorInfection.photo) || []).length
      
      const currentStrength = (10 - currentInfection.generation) + Math.random() * 5 + (currentComponents === 1 ? 2 : 0)
      const competitorStrength = (10 - competitorInfection.generation) + Math.random() * 5 + (competitorComponents === 1 ? 2 : 0)
      
      if (competitorStrength > currentStrength) {
        newInfections.set(targetIndex, {
          ...competitorInfection,
          infectionTime: currentTime,
          generation: newGeneration,
          scale: competitorInfection.scale * 0.9,
          growthRate: competitorInfection.growthRate * 1.1
        })
      }
    }
  }
  
  // Conway's Game of Life style death rule - hexagons die if they have no similar images near them
  // Only apply death rule after generation 3 to allow initial infections to establish
  if (newGeneration >= 3) {
    const deathIndices: number[] = []
    for (const [index, infection] of newInfections) {
      const pos = positions[index]
      let samePhotoNeighbors = 0
      
      // Count neighbors with the same photo
      for (const [otherIndex, otherInfection] of newInfections) {
        if (otherIndex === index) continue
        
        const otherPos = positions[otherIndex]
        const distance = Math.sqrt(
          Math.pow(pos[0] - otherPos[0], 2) + 
          Math.pow(pos[1] - otherPos[1], 2)
        )
        
        if (distance <= hexRadius * 2.1 && otherInfection.photo.id === infection.photo.id) {
          samePhotoNeighbors++
        }
      }
      
      // Die if no same-photo neighbors (like Conway's underpopulation)
      // But allow very young infections (generation < 3) to survive
      if (samePhotoNeighbors === 0 && infection.generation < newGeneration - 2) {
        deathIndices.push(index)
      }
    }
    
    // Remove dead hexagons
    for (const deadIndex of deathIndices) {
      newInfections.delete(deadIndex)
      newAvailableIndices.push(deadIndex)
    }
  }
  
  // Conway's Game of Life style birth rule - empty hexagons spring to life when surrounded by enough similar images
  // Only apply birth rule after generation 2 to allow initial spread
  if (newGeneration >= 2) {
    const birthCandidates: Map<number, {photo: Photo, neighborCount: number}> = new Map()
    
    for (const availableIndex of newAvailableIndices) {
      const pos = positions[availableIndex]
      const photoNeighborCounts = new Map<string, {photo: Photo, count: number}>()
      
      // Count infected neighbors by photo type
      for (const [infectedIndex, infection] of newInfections) {
        const infectedPos = positions[infectedIndex]
        const distance = Math.sqrt(
          Math.pow(pos[0] - infectedPos[0], 2) + 
          Math.pow(pos[1] - infectedPos[1], 2)
        )
        
        if (distance <= hexRadius * 2.1) {
          const photoId = infection.photo.id
          if (!photoNeighborCounts.has(photoId)) {
            photoNeighborCounts.set(photoId, {photo: infection.photo, count: 0})
          }
          photoNeighborCounts.get(photoId)!.count++
        }
      }
      
      // Find the photo with the most neighbors (must have at least 2 for birth)
      let bestPhoto: Photo | null = null
      let maxNeighbors = 0
      
      for (const {photo, count} of photoNeighborCounts.values()) {
        if (count >= 2 && count > maxNeighbors) { // Need at least 2 neighbors for birth
          maxNeighbors = count
          bestPhoto = photo
        }
      }
      
      // If we found a photo with enough neighbors, mark for birth
      if (bestPhoto) {
        birthCandidates.set(availableIndex, {photo: bestPhoto, neighborCount: maxNeighbors})
      }
    }
    
    // Apply births
    for (const [index, {photo}] of birthCandidates) {
      // Check if this photo already has infections to inherit properties from
      const existingInfections = Array.from(newInfections.values()).filter(i => i.photo.id === photo.id)
      let inheritedGrowthRate = 0.08 + Math.random() * 0.12 // Default fallback
      
      if (existingInfections.length > 0) {
        inheritedGrowthRate = existingInfections[0].growthRate // Inherit meritocratic growth rate
      } else {
        // No existing infections - map photo velocity to growthRate
        const velocity = photo.velocity ?? 0.5
        const normalizedVelocity = Math.max(0.1, Math.min(1.0, velocity))
        inheritedGrowthRate = minGrowthRate + (normalizedVelocity - 0.1) * (maxGrowthRate - minGrowthRate) / 0.9
      }
      
      const tilesX = 4
      const tilesY = 4
      const uvBounds = calculateUvBoundsFromGridPosition(0, 0, tilesX, tilesY)
      newInfections.set(index, {
        photo,
        gridPosition: [0, 0], // Will be optimized later
        infectionTime: currentTime,
        generation: newGeneration,
        uvBounds: uvBounds,
        scale: 0.3 + Math.random() * 0.4,
        growthRate: inheritedGrowthRate, // Use meritocratic growth rate
        tilesX: tilesX,
        tilesY: tilesY
      })
      
      // Remove from available indices
      const removeIndex = newAvailableIndices.indexOf(index)
      if (removeIndex !== -1) {
        newAvailableIndices.splice(removeIndex, 1)
      }
    }
  }
  
  return {
    infections: newInfections,
    availableIndices: newAvailableIndices,
    lastEvolutionTime: currentTime,
    generation: newGeneration
  }
}

// Helper function to get neighboring hex indices
// IMPORTANT: hexRadius parameter should be the base grid spacing (effectiveHexRadius),
// not the drawn radius (drawnHexRadius = effectiveHexRadius * hexSpacing).
// The grid topology is determined by base spacing, not visual spacing.
// For spherical grids with variable density, uses distance-based neighbor finding.
function inferGridDimensions(
  positions: [number, number, number][],
  hexRadius: number
): { cols: number; rows: number } {
  const total = positions.length
  if (total === 0) return { cols: 0, rows: 0 }

  // Use tolerance so floating point noise in y values does not split the first row
  const tolerance = Math.max(1e-4, hexRadius * 0.2)
  const firstRowY = positions[0][1]
  let cols = 0

  for (let i = 0; i < total; i++) {
    const [, y] = positions[i]
    if (Math.abs(y - firstRowY) <= tolerance) cols++
    else break
  }

  if (cols <= 0) cols = total
  const rows = Math.max(1, Math.ceil(total / cols))
  return { cols, rows }
}

function getNeighbors(
  index: number, 
  positions: [number, number, number][], 
  hexRadius: number,
  isSpherical: boolean = false
): number[] {
  // For spherical grids with variable row lengths, use distance-based approach
  if (isSpherical) {
    const neighbors: number[] = []
    const currentPos = positions[index]
    if (!currentPos) return neighbors
    
    // Search radius: slightly more than the expected neighbor distance
    // In spherical grids, neighbors are at varying distances due to latitude effects
    const sqrt3 = Math.sqrt(3)
    const maxNeighborDist = sqrt3 * hexRadius * 1.5 // generous threshold
    
    // Brute force search (could be optimized with spatial partitioning if needed)
    for (let i = 0; i < positions.length; i++) {
      if (i === index) continue
      const pos = positions[i]
      const dx = pos[0] - currentPos[0]
      const dy = pos[1] - currentPos[1]
      const dist = Math.sqrt(dx * dx + dy * dy)
      
      if (dist <= maxNeighborDist) {
        neighbors.push(i)
      }
    }
    
    // Return the closest 6 neighbors (hexagons have 6 neighbors)
    neighbors.sort((a, b) => {
      const posA = positions[a]
      const posB = positions[b]
      const distA = Math.hypot(posA[0] - currentPos[0], posA[1] - currentPos[1])
      const distB = Math.hypot(posB[0] - currentPos[0], posB[1] - currentPos[1])
      return distA - distB
    })
    
    return neighbors.slice(0, 6)
  }
  
  // Original grid-topology-based approach for flat hexagonal grids
  const neighbors: number[] = []
  if (index < 0 || index >= positions.length) return neighbors

  const { cols, rows } = inferGridDimensions(positions, hexRadius)
  if (cols <= 0 || rows <= 0) return neighbors

  // Convert linear index to row/col coordinates
  const row = Math.floor(index / cols)
  const col = index % cols

  // Define the 6 possible neighbor directions for flat-top hexagons
  // Directions depend on whether the row is even or odd due to the offset
  const isEvenRow = row % 2 === 0
  const directions = isEvenRow ? [
    [0, -1],   // North
    [1, -1],   // Northeast
    [1, 0],    // Southeast
    [0, 1],    // South
    [-1, 0],   // Southwest
    [-1, -1]   // Northwest
  ] : [
    [0, -1],   // North
    [1, 0],    // Northeast
    [1, 1],    // Southeast
    [0, 1],    // South
    [-1, 1],   // Southwest
    [-1, 0]    // Northwest
  ]

  // Check each possible neighbor position
  for (const [dCol, dRow] of directions) {
    const neighborRow = row + dRow
    const neighborCol = col + dCol

    // Check bounds
    if (neighborRow >= 0 && neighborRow < rows && neighborCol >= 0 && neighborCol < cols) {
      const neighborIndex = neighborRow * cols + neighborCol
      if (neighborIndex >= 0 && neighborIndex < positions.length) {
        neighbors.push(neighborIndex)
      }
    }
  }

  return neighbors
}

// Calculate UV bounds for a tile based on its grid position within a tilesX x tilesY grid
// V=1.0 represents the top of the texture in this codebase
function calculateUvBoundsFromGridPosition(
  gridCol: number,
  gridRow: number,
  tilesX: number,
  tilesY: number
): [number, number, number, number] {
  const minU = gridCol / tilesX
  const maxU = (gridCol + 1) / tilesX
  // V=1 is top, so row 0 maps to top (maxV=1, minV=1-1/tilesY)
  const minV = 1 - (gridRow + 1) / tilesY
  const maxV = 1 - gridRow / tilesY
  return [minU, minV, maxU, maxV]
}

// Continuous optimization to improve image arrangements and create contiguous clusters
function optimizeImageArrangements(
  infections: Map<number, Infection>,
  positions: [number, number, number][],
  hexRadius: number,
  isSpherical: boolean = false
) {
  // Group infections by photo to identify clusters
  const photoClusters = new Map<Photo, number[]>()
  for (const [index, infection] of infections) {
    if (!photoClusters.has(infection.photo)) {
      photoClusters.set(infection.photo, [])
    }
    photoClusters.get(infection.photo)!.push(index)
  }

  // For each photo, assign grid positions to connected components
  for (const [photo, indices] of photoClusters) {
    if (indices.length === 0) continue

    // Find connected components for this photo
    const components = findConnectedComponents(indices, positions, hexRadius)

    for (const componentIndices of components) {
      if (componentIndices.length === 0) continue

      // Assign Grid Positions and Calculate Cluster Size (BFS/Flood-Fill)
      // Get the index of the top-left-most hexagon to be the origin [0, 0]
      const originIndex = componentIndices.reduce((bestIndex, currentIndex) => {
        const [bestX, bestY] = positions[bestIndex]
        const [currentX, currentY] = positions[currentIndex]
        if (currentY < bestY || (currentY === bestY && currentX < bestX)) {
          return currentIndex
        }
        return bestIndex
      }, componentIndices[0])

      let maxCol = 0
      let maxRow = 0
      const queue = [originIndex]
      const visited = new Set<number>([originIndex])
      const gridMap = new Map<number, [number, number]>([[originIndex, [0, 0]]]) // Map: index -> [col, row]

      // BFS to assign grid positions
      while (queue.length > 0) {
        const currentIndex = queue.shift()!
        const [currentCol, currentRow] = gridMap.get(currentIndex)!
        
        maxCol = Math.max(maxCol, currentCol)
        maxRow = Math.max(maxRow, currentRow)
        
        const neighbors = getNeighbors(currentIndex, positions, hexRadius, isSpherical)
        
        for (const neighborIndex of neighbors) {
          // Only consider neighbors that are part of the same photo component
          if (!visited.has(neighborIndex) && componentIndices.includes(neighborIndex)) {
            visited.add(neighborIndex)
            queue.push(neighborIndex)
            
            // Assign a simple, relative grid position
            const neighborPos = positions[neighborIndex]
            const currentPos = positions[currentIndex]
            
            // Calculate rough offset in terms of tiles
            const dx = neighborPos[0] - currentPos[0]
            const dy = neighborPos[1] - currentPos[1]
            
            let newCol = currentCol
            let newRow = currentRow
            
            if (Math.abs(dx) > Math.abs(dy)) {
              // Mostly horizontal movement
              newCol += (dx > 0 ? 1 : -1)
            } else {
              // Mostly vertical movement
              newRow += (dy > 0 ? 1 : -1)
            }
            
            // Ensure uniqueness by checking if position is already taken
            let attempts = 0
            while (Array.from(gridMap.values()).some(([c, r]) => c === newCol && r === newRow) && attempts < 6) {
              // Try adjacent positions
              const directions = [[1,0], [-1,0], [0,1], [0,-1], [1,1], [-1,-1]]
              const [dc, dr] = directions[attempts % directions.length]
              newCol = currentCol + dc
              newRow = currentRow + dr
              attempts++
            }
            
            gridMap.set(neighborIndex, [newCol, newRow])
          }
        }
      }

      // Apply the new UV and Grid Data
      const clusterTilesX = maxCol + 1
      const clusterTilesY = maxRow + 1

      for (const index of componentIndices) {
        const [gridCol, gridRow] = gridMap.get(index)!
        
        const existingInfection = infections.get(index)!
        const uvBounds = calculateUvBoundsFromGridPosition(gridCol, gridRow, clusterTilesX, clusterTilesY)
        infections.set(index, {
          ...existingInfection,
          gridPosition: [gridCol, gridRow],
          tilesX: clusterTilesX,
          tilesY: clusterTilesY,
          uvBounds: uvBounds
        })
      }
    }
  }

  // Try to connect disconnected components by swapping with different-image hexagons
  for (const [photo, indices] of photoClusters) {
    if (indices.length < 2) continue // Skip single hexagons

    // Find connected components for this photo
    const components = findConnectedComponents(indices, positions, hexRadius)

    if (components.length <= 1) continue // Already contiguous

    // Try to connect disconnected components by swapping with different-image hexagons
    const maxSwaps = 3 // Limit swaps per photo per optimization cycle

    for (let swap = 0; swap < maxSwaps; swap++) {
      // Find the best swap opportunity
      let bestSwap: {fromIndex: number, toIndex: number, score: number} | null = null

      // For each disconnected component
      for (const component of components) {
        for (const compIndex of component) {
          const compPos = positions[compIndex]

          // Look for nearby different-image hexagons that could help connect components
          for (const [otherIndex, otherInfection] of infections) {
            if (otherInfection.photo.id === photo.id) continue // Same photo, skip

            const otherPos = positions[otherIndex]
            const distance = Math.sqrt(
              Math.pow(compPos[0] - otherPos[0], 2) +
              Math.pow(compPos[1] - otherPos[1], 2)
            )

            if (distance > hexRadius * 3) continue // Too far away

            // Calculate how much this swap would improve contiguity
            const currentContiguity = calculatePhotoContiguity(photo, indices, positions, hexRadius)
            const swappedContiguity = calculateSwappedContiguity(
              photo, indices, positions, hexRadius, compIndex, otherIndex, infections
            )

            const improvement = swappedContiguity - currentContiguity

            if (improvement > 0 && (!bestSwap || improvement > bestSwap.score)) {
              bestSwap = {fromIndex: compIndex, toIndex: otherIndex, score: improvement}
            }
          }
        }
      }

      // Execute the best swap if found
      if (bestSwap) {
        const infection1 = infections.get(bestSwap.fromIndex)!
        const infection2 = infections.get(bestSwap.toIndex)!

        // Swap photos
        infections.set(bestSwap.fromIndex, {
          ...infection1,
          photo: infection2.photo,
          gridPosition: infection1.gridPosition
        })
        infections.set(bestSwap.toIndex, {
          ...infection2,
          photo: infection1.photo,
          gridPosition: infection2.gridPosition
        })

        // Update the cluster indices
        const fromClusterIndex = indices.indexOf(bestSwap.fromIndex)
        const toClusterIndex = indices.indexOf(bestSwap.toIndex)

        if (fromClusterIndex !== -1) indices[fromClusterIndex] = bestSwap.toIndex
        if (toClusterIndex !== -1) indices[toClusterIndex] = bestSwap.fromIndex
      }
    }
  }

  // Also do some random exploration swaps to prevent local optima
  if (Math.random() < 0.1) {
    const allIndices = Array.from(infections.keys())
    if (allIndices.length >= 2) {
      const idx1 = allIndices[Math.floor(Math.random() * allIndices.length)]
      const idx2 = allIndices[Math.floor(Math.random() * allIndices.length)]

      if (idx1 !== idx2) {
        const infection1 = infections.get(idx1)!
        const infection2 = infections.get(idx2)!

        // Random swap
        infections.set(idx1, {
          ...infection1,
          photo: infection2.photo,
          gridPosition: infection1.gridPosition
        })
        infections.set(idx2, {
          ...infection2,
          photo: infection1.photo,
          gridPosition: infection2.gridPosition
        })
      }
    }
  }
}

// Find connected components for a set of indices
function findConnectedComponents(indices: number[], positions: [number, number, number][], hexRadius: number): number[][] {
  const components: number[][] = []
  const visited = new Set<number>()

  for (const startIndex of indices) {
    if (visited.has(startIndex)) continue

    const component: number[] = []
    const queue = [startIndex]
    visited.add(startIndex)

    while (queue.length > 0) {
      const currentIndex = queue.shift()!
      component.push(currentIndex)

      for (const otherIndex of indices) {
        if (visited.has(otherIndex)) continue

        const currentPos = positions[currentIndex]
        const otherPos = positions[otherIndex]
        const distance = Math.sqrt(
          Math.pow(currentPos[0] - otherPos[0], 2) +
          Math.pow(currentPos[1] - otherPos[1], 2)
        )

        if (distance <= hexRadius * 2.1) {
          visited.add(otherIndex)
          queue.push(otherIndex)
        }
      }
    }

    components.push(component)
  }

  return components
}

// Calculate overall contiguity score for a photo's hexagons
function calculatePhotoContiguity(
  photo: Photo,
  indices: number[],
  positions: [number, number, number][],
  hexRadius: number
): number {
  let totalScore = 0

  for (const index of indices) {
    const pos = positions[index]
    let connections = 0

    for (const otherIndex of indices) {
      if (otherIndex === index) continue

      const otherPos = positions[otherIndex]
      const distance = Math.sqrt(
        Math.pow(pos[0] - otherPos[0], 2) +
        Math.pow(pos[1] - otherPos[1], 2)
      )

      if (distance <= hexRadius * 2.1) {
        connections++
      }
    }

    totalScore += connections
  }

  return totalScore
}

// Calculate contiguity score after a hypothetical swap
function calculateSwappedContiguity(
  photo: Photo,
  indices: number[],
  positions: [number, number, number][],
  hexRadius: number,
  fromIndex: number,
  toIndex: number,
  infections: Map<number, Infection>
): number {
  // Create a temporary copy of indices with the swap
  const tempIndices = [...indices]
  const fromPos = tempIndices.indexOf(fromIndex)
  const toPos = tempIndices.indexOf(toIndex)

  if (fromPos !== -1) tempIndices[fromPos] = toIndex
  if (toPos !== -1) tempIndices[toPos] = fromIndex

  return calculatePhotoContiguity(photo, tempIndices, positions, hexRadius)
}

// Calculate overall arrangement quality for a cluster
function calculateClusterQuality(
  indices: number[],
  positions: [number, number, number][],
  hexRadius: number
): number {
  let totalScore = 0
  
  for (const index of indices) {
    totalScore += calculateContiguityScore(index, indices, positions, hexRadius)
  }
  
  // Bonus for having hexagons in a compact rectangular arrangement
  const clusterPositions = indices.map(i => positions[i])
  const minX = Math.min(...clusterPositions.map(p => p[0]))
  const maxX = Math.max(...clusterPositions.map(p => p[0]))
  const minY = Math.min(...clusterPositions.map(p => p[1]))
  const maxY = Math.max(...clusterPositions.map(p => p[1]))
  
  const boundingWidth = maxX - minX
  const boundingHeight = maxY - minY
  const expectedArea = indices.length * hexRadius * hexRadius * Math.sqrt(3) / 2
  const actualArea = boundingWidth * boundingHeight
  
  // Compactness bonus
  const compactness = expectedArea / Math.max(actualArea, expectedArea)
  totalScore *= (1 + compactness)
  
  return totalScore
}

// Calculate contiguity score for a hexagon within its cluster
function calculateContiguityScore(
  targetIndex: number,
  clusterIndices: number[],
  positions: [number, number, number][],
  hexRadius: number
): number {
  const targetPos = positions[targetIndex]
  let score = 0
  
  for (const otherIndex of clusterIndices) {
    if (otherIndex === targetIndex) continue
    
    const otherPos = positions[otherIndex]
    const distance = Math.sqrt(
      Math.pow(targetPos[0] - otherPos[0], 2) + 
      Math.pow(targetPos[1] - otherPos[1], 2)
    )
    
    // More generous contiguity scoring
    const maxDistance = hexRadius * 4.0 // Consider neighbors up to 4 hexes away
    if (distance <= maxDistance) {
      // Closer neighbors contribute exponentially more
      const normalizedDistance = distance / maxDistance
      score += Math.pow(1 - normalizedDistance, 2) // Quadratic falloff
    }
  }
  
  return score
}

// Update grid positions for connected components
function updateConnectedComponentGridPositions(
  infections: Map<number, Infection>,
  positions: [number, number, number][],
  hexRadius: number
) {
  const photoClusters = new Map<Photo, number[]>()
  for (const [index, infection] of infections) {
    if (!photoClusters.has(infection.photo)) {
      photoClusters.set(infection.photo, [])
    }
    photoClusters.get(infection.photo)!.push(index)
  }

  for (const [photo, indices] of photoClusters) {
    if (indices.length === 0) continue

    if (indices.length === 1) {
      // Single hexagon - show the entire image
      const infection = infections.get(indices[0])
      if (infection) {
        const uvBounds = calculateUvBoundsFromGridPosition(0, 0, 1, 1)
        infections.set(indices[0], {
          ...infection,
          gridPosition: [0, 0],
          tilesX: 1,
          tilesY: 1,
          scale: 1.0, // Full scale for single hexagons
          uvBounds: uvBounds
        })
      }
      continue
    }

    // Find connected components for this photo (handles clusters that may have gaps)
    const components = findConnectedComponents(indices, positions, hexRadius)

    // Process each connected component separately
    for (const componentIndices of components) {
      if (componentIndices.length === 0) continue

      const clusterSize = componentIndices.length

      // SPECIAL CASE: Small clusters use full image
      if (clusterSize <= 2) {
        const fullImageUvBounds: [number, number, number, number] = [0, 0, 1, 1]
        const scaleFactor = Math.max(0.9, Math.min(clusterSize / 4, 2.0))
        
        for (const index of componentIndices) {
          const infection = infections.get(index)
          if (!infection) continue
          
          infections.set(index, {
            ...infection,
            gridPosition: [0, 0],
            tilesX: 1,
            tilesY: 1,
            scale: scaleFactor,
            uvBounds: fullImageUvBounds
          })
        }
        continue // Skip to next component
      }

      // 2D BOUNDING BOX MAPPING: Map each hex's actual position within the cluster
      // This properly handles the hexagonal stagger without forcing a square grid
      
      // Calculate bounding box of hex CENTER POINTS
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const index of componentIndices) {
        const pos = positions[index]
        if (pos[0] < minX) minX = pos[0]
        if (pos[0] > maxX) maxX = pos[0]
        if (pos[1] < minY) minY = pos[1]
        if (pos[1] > maxY) maxY = pos[1]
      }

      // CRITICAL FIX: Expand bounding box by hex physical dimensions
      // Hexagons have size beyond their center points - account for their full area
      const sqrt3 = Math.sqrt(3)
      const hexWidth = sqrt3 * hexRadius  // Full width of a flat-top hexagon
      const hexHeight = 2 * hexRadius     // Full height of a flat-top hexagon
      
      // Margin is half the hex dimensions (distance from center to edge)
      const marginX = hexWidth / 2
      const marginY = hexHeight / 2
      
      // Effective bounds include the physical space of boundary hexagons
      const effectiveMinX = minX - marginX
      const effectiveMaxX = maxX + marginX
      const effectiveMinY = minY - marginY
      const effectiveMaxY = maxY + marginY
      
      const clusterWidth = Math.max(effectiveMaxX - effectiveMinX, 1) // Avoid division by zero
      const clusterHeight = Math.max(effectiveMaxY - effectiveMinY, 1)
      const aspectRatio = clusterWidth / clusterHeight

      // Calculate tile grid dimensions based on cluster's actual aspect ratio
      // CRITICAL: Grid must be large enough to give each hex a unique tile slot
      // No artificial ceiling - let the grid scale with cluster complexity
      let tilesX = Math.round(Math.sqrt(clusterSize * aspectRatio))
      let tilesY = Math.round(Math.sqrt(clusterSize / aspectRatio))

      // Ensure we have AT LEAST enough tiles for all hexes
      // This is the fundamental requirement: tilesX * tilesY >= clusterSize
      if (tilesX * tilesY < clusterSize) {
        if (aspectRatio > 1) {
          // Wider cluster - increase height to accommodate
          tilesY = Math.ceil(clusterSize / tilesX)
        } else {
          // Taller cluster - increase width to accommodate
          tilesX = Math.ceil(clusterSize / tilesY)
        }
      }
      
      // Only clamp to minimum of 1 (no maximum cap)
      tilesX = Math.max(1, tilesX)
      tilesY = Math.max(1, tilesY)

      // Smooth grid sizing: search for a tile arrangement that matches the aspect ratio
      // while minimizing nearly-empty trailing rows/columns. Keeps clusters visually coherent.
      const targetRatio = aspectRatio > 0 ? aspectRatio : 1
      let bestTilesX = tilesX
      let bestTilesY = tilesY
      let bestScore = Number.POSITIVE_INFINITY

      const maxScan = Math.max(tilesY + 6, Math.ceil(Math.sqrt(clusterSize) * 2))
      for (let candidateY = 1; candidateY <= maxScan; candidateY++) {
        const candidateX = Math.max(1, Math.ceil(clusterSize / candidateY))
        const totalTiles = candidateX * candidateY
        if (totalTiles < clusterSize) continue

        const ratio = candidateX / candidateY
        const ratioScore = Math.abs(Math.log((ratio + 1e-6) / (targetRatio + 1e-6)))

        const leftover = totalTiles - clusterSize
        const leftoverScore = leftover / totalTiles

        const remainder = clusterSize % candidateX
        const rowPenalty = candidateY > 1 ? remainder / candidateX : 0

        const candidateScore = ratioScore * 1.2 + leftoverScore * 1.0 + rowPenalty * 0.8

        if (candidateScore < bestScore - 1e-6) {
          bestScore = candidateScore
          bestTilesX = candidateX
          bestTilesY = candidateY
        }
      }

      tilesX = bestTilesX
      tilesY = bestTilesY

      // SEQUENTIAL MAPPING: Sort hexes spatially and assign tiles sequentially
      // This guarantees each hex gets a unique tile with no repetition
      
      // Step 1: Create array of hex data with spatial positions for sorting
      const hexData: Array<{
        index: number
        infection: typeof infections extends Map<any, infer T> ? T : never
        pos: [number, number, number]
        normX: number
        normY: number
      }> = []
      
      for (const index of componentIndices) {
        const infection = infections.get(index)
        if (!infection) continue

        const pos = positions[index]
        
        // Normalize position within the EFFECTIVE bounding box (includes hex physical size)
        const normX = (pos[0] - effectiveMinX) / clusterWidth
        // CRITICAL: Invert Y-axis so top of cluster maps to top of image (row 0)
        const normY = (effectiveMaxY - pos[1]) / clusterHeight
        
        hexData.push({ index, infection, pos, normX, normY })
      }
      
      // Step 2: Sort hexes spatially (top-left to bottom-right, row-major order)
      // Primary sort by Y (top to bottom), secondary by X (left to right)
      // Use a generous row tolerance so visually aligned hexes stay together
      const rowTolerance = hexRadius * 0.8
      hexData.sort((a, b) => {
        const yDiff = a.pos[1] - b.pos[1]
        if (Math.abs(yDiff) > rowTolerance) return yDiff // Different rows
        return a.pos[0] - b.pos[0] // Same row, sort by column
      })
      
      // Step 3: Assign tiles sequentially (0, 1, 2, 3, ...) in sorted order
      for (let i = 0; i < hexData.length; i++) {
        const { index, infection } = hexData[i]
        
        // Convert sequential index to grid position
        const tileRow = Math.floor(i / tilesX)
        const tileCol = i % tilesX
        
        // Calculate UV bounds for this tile
        const uvBounds = calculateUvBoundsFromGridPosition(tileCol, tileRow, tilesX, tilesY)
        const scaleFactor = Math.min(clusterSize / 4, 2.0)
        
        infections.set(index, {
          ...infection,
          gridPosition: [tileCol, tileRow],
          tilesX: tilesX,
          tilesY: tilesY,
          scale: scaleFactor,
          uvBounds: uvBounds
        })
      }
    }
  }
}
export default HexGrid;
