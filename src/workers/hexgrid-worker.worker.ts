/// <reference lib="webworker" />

// Hexgrid web worker - clean, defensive implementation
// Features:
// - centroid-based cohesion bias (workerDebug.cohesionBoost)
// - conservative post-optimization merge (opt-in via workerDebug.enableMerges)
// - evolution throttling (workerDebug.evolutionIntervalMs)
// - defensive guards and error reporting via postMessage({type:'error', ...})

import {
  getGridBounds as _getGridBounds,
  distanceBetween as _distanceBetween,
  calculateUvBoundsFromGridPosition as _calculateUvBoundsFromGridPosition,
  calculateContiguity as _calculateContiguity,
  calculatePhotoContiguity as _calculatePhotoContiguity,
} from './hexgrid-math'

export interface Photo { id: string; title?: string; alt?: string; imageUrl?: string; velocity?: number }
export interface Infection { photo: Photo; gridPosition: [number, number]; infectionTime: number; generation: number; uvBounds: [number, number, number, number]; scale: number; growthRate?: number; tilesX?: number; tilesY?: number }
export interface InfectionSystemState { infections: Map<number, Infection>; availableIndices: number[]; lastEvolutionTime: number; generation: number; tileCenters?: Array<{ photoId: string; clusterIndex: number; centers: Array<{ x: number; y: number; col: number; row: number }> }> }

const WORKER_ID = Math.random().toString(36).substring(7)
console.log('[hexgrid-worker] loaded id=', WORKER_ID)

const workerDebug: any = {
  cohesionBoost: 6.0,  // BOOSTED: strongly favor growth near cluster centroids to build larger regions
  enableMerges: true,   // ENABLED: merge small fragments into nearby larger clusters
  mergeSmallComponentsThreshold: 20,  // INCREASED: merge clusters of 20 hexes or fewer
  mergeLogs: false,
  evolutionIntervalMs: 30000,
  debugLogs: false,
  enableCellDeath: true,  // ENABLED: allow fully surrounded cells to die and respawn with better positioning
  cellDeathProbability: 0.05,  // 5% chance per evolution for fully surrounded cells to reset
  enableMutation: true,  // ENABLED: allow dying cells to mutate into different photos
  mutationProbability: 0.3,  // 30% chance for a dying cell to respawn as a different photo
  enableVirilityBoost: true,  // ENABLED: boost infection rate based on photo velocity/upvotes
  virilityMultiplier: 1.0,  // Multiplier for virility effect (1.0 = normal, higher = more impact)
  annealingRate: 2.0,  // Multiplier for death/churn rates to help system escape local optima (1.0 = normal, higher = more reorganization)
  enableEntropyDecay: true,  // ENABLED: entropy decay - successful/dominant photos decay over time to allow new dominance
  entropyDecayBaseRate: 0.02,  // Base decay rate per generation (2% for highly dominant photos)
  entropyDominanceThreshold: 0.15,  // Territory share threshold to be considered "dominant" (15%)
  entropySuccessVelocityThreshold: 50,  // Velocity threshold to be considered "successful" (only successful photos decay)
  entropyTimeMultiplier: 0.1  // Multiplier for time-as-dominant effect (0.1 = each generation as dominant adds 10% to decay rate)
}

// Tuning flags for cluster tiling behaviour
workerDebug.clusterPreserveAspect = true // when true, preserve cluster aspect ratio when mapping to tile grid
workerDebug.clusterDynamicTiling = true // when true, calculate tilesX/tilesY dynamically based on cluster aspect ratio
workerDebug.clusterAnchor = 'center' // 'center' or 'min' (used during aspect correction)
workerDebug.clusterGlobalAlign = false // when true, clusters snap to global tile anchor for better neighbor alignment
workerDebug.clusterUvInset = 0.0 // shrink UVs slightly to allow texture filtering/edge blending (0..0.5)
workerDebug.clusterJitter = 0.0 // small (0..0.5) fractional jitter applied to normalized coords before quantization
// adjacency mode for cluster tiling: 'hex' (6-way) or 'rect' (4-way). 'rect' gives raster-like, cohesive images
workerDebug.clusterAdjacency = 'rect'
// maximum number of tiles to allocate for a cluster when dynamically expanding (cap)
workerDebug.clusterMaxTiles = 128
// whether to 'contain' (fit whole image within cluster bounds) or 'cover' (fill cluster and allow cropping)
workerDebug.clusterFillMode = 'contain'
// scan order for filling tiles: 'row' = left->right each row, 'serpentine' = zig-zag per row
workerDebug.clusterScanMode = 'row'
// when true, compute tile centers using hex-row parity offsets so ordering follows hex staggering
workerDebug.clusterParityAware = true
// when true, include computed tile centers in evolved message for debug visualization
workerDebug.showTileCenters = false
// when true, enable direct hex lattice mapping fast-path (parity-correct row/col inference)
workerDebug.clusterHexLattice = true
// when true, horizontally nudge odd rows' UV sampling by half a tile width to compensate
// for physical hex center staggering (attempts to eliminate visible half-hex seams)
workerDebug.clusterParityUvShift = true
// when true, compact gaps in each row of the hex lattice for more contiguous image tiles
workerDebug.clusterCompactGaps = true

const cache: any = { neighborMap: new Map<number, number[]>(), gridBounds: null, photoClusters: new Map<string, number[]>(), connectedComponents: new Map<string, number[][]>(), gridPositions: new Map<number, [number, number]>(), lastInfectionCount: 0, lastGeneration: -1, isSpherical: false, cacheReady: false }
// Track dominance history for entropy decay: photoId -> generations as dominant
const dominanceHistory: Map<string, number> = new Map()

function safePostError(err: unknown) { try { self.postMessage({ type: 'error', error: err instanceof Error ? err.message : String(err) }) } catch (e) {} }

function getGridBounds(positions: [number, number, number][]) {
  if (cache.gridBounds) return cache.gridBounds
  const bounds = _getGridBounds(positions)
  cache.gridBounds = bounds
  return bounds
}

function distanceBetween(
  a: [number, number, number],
  b: [number, number, number],
  bounds: { width: number; height: number },
  isSpherical: boolean
) {
  return _distanceBetween(a, b, bounds, isSpherical)
}

function getNeighborsCached(index: number, positions: [number, number, number][], hexRadius: number): number[] {
  // Immediate return if cached - no blocking
  if (cache.neighborMap.has(index)) {
    const cached = cache.neighborMap.get(index)!
    if (Array.isArray(cached)) return cached
    // Invalid cache entry - clear it and recompute
    cache.neighborMap.delete(index)
  }
  
  // Validate inputs before computation
  if (!positions || !Array.isArray(positions) || positions.length === 0) {
    console.warn('[getNeighborsCached] Invalid positions array, returning empty')
    return []
  }
  if (typeof index !== 'number' || index < 0 || index >= positions.length) {
    console.warn('[getNeighborsCached] Invalid index', index, 'for positions length', positions.length)
    return []
  }
  if (typeof hexRadius !== 'number' || hexRadius <= 0) {
    console.warn('[getNeighborsCached] Invalid hexRadius', hexRadius)
    return []
  }
  
  const out: number[] = []
  const pos = positions[index]
  if (!pos) {
    console.warn('[getNeighborsCached] No position at index', index)
    return out
  }
  
  try {
    const bounds = getGridBounds(positions)
    const threshold = Math.sqrt(3) * hexRadius * 1.15
    const isSpherical = !!cache.isSpherical
    
    // Fast path: check only nearby candidates (≈6 neighbors for hex grid)
    // For hex grids, each hex has at most 6 neighbors
    // Limit search to reduce O(n²) to O(n)
    const maxNeighbors = 10 // Safety margin for irregular grids
    
    for (let j = 0; j < positions.length; j++) {
      if (j === index) continue
      const p2 = positions[j]
      if (!p2) continue
      const d = distanceBetween(pos, p2, bounds, isSpherical)
      if (d <= threshold) {
        out.push(j)
        // Early exit if we found enough neighbors
        if (out.length >= maxNeighbors) break
      }
    }
    
    cache.neighborMap.set(index, out)
  } catch (e) {
    console.error('[getNeighborsCached] Error computing neighbors:', e)
    return []
  }
  
  return out
}

// Calculate UV bounds for a tile based on its grid position within a tilesX x tilesY grid
// V=1.0 represents the top of the texture in this codebase
function calculateUvBoundsFromGridPosition(
  gridCol: number,
  gridRow: number,
  tilesX: number,
  tilesY: number
): [number, number, number, number] {
  return _calculateUvBoundsFromGridPosition(gridCol, gridRow, tilesX, tilesY)
}

function findConnectedComponents(indices: number[], positions: [number, number, number][], hexRadius: number): number[][] {
  // Immediate synchronous check - if this doesn't log, the function isn't being called or is blocked
  const startMarker = performance.now()
  console.log('[findConnectedComponents] FUNCTION ENTERED - indices.length=', indices.length, 'positions.length=', positions.length, 'hexRadius=', hexRadius, 'marker=', startMarker)
  
  // Validate inputs immediately
  if (!indices || !Array.isArray(indices)) {
    console.error('[findConnectedComponents] Invalid indices:', indices)
    return []
  }
  if (!positions || !Array.isArray(positions)) {
    console.error('[findConnectedComponents] Invalid positions:', positions)
    return []
  }
  if (typeof hexRadius !== 'number' || hexRadius <= 0) {
    console.error('[findConnectedComponents] Invalid hexRadius:', hexRadius)
    return []
  }
  
  console.log('[findConnectedComponents] About to enter try block')
  
  // Add immediate log after try block entry to confirm execution reaches here
  let tryBlockEntered = false
  try {
    tryBlockEntered = true
    console.log('[findConnectedComponents] ✅ TRY BLOCK ENTERED - marker=', performance.now() - startMarker, 'ms')
    console.log('[findConnectedComponents] Inside try block - Starting with', indices.length, 'indices')
    const set = new Set(indices); 
    const visited = new Set<number>(); 
    const comps: number[][] = []
    let componentCount = 0
    for (const start of indices) {
      if (visited.has(start)) continue
      componentCount++
      console.log('[findConnectedComponents] Starting component', componentCount, 'from index', start)
      const q = [start]; 
      visited.add(start); 
      const comp: number[] = []
      let iterations = 0
      const maxIterations = indices.length * 10 // Safety limit
      while (q.length > 0) {
        iterations++
        if (iterations > maxIterations) {
          console.error('[findConnectedComponents] Safety limit reached! indices=', indices.length, 'component=', componentCount, 'iterations=', iterations)
          break
        }
        if (iterations % 100 === 0) {
          console.log('[findConnectedComponents] Component', componentCount, 'iteration', iterations, 'queue length', q.length)
        }
        const cur = q.shift()!
        if (cur === undefined || cur === null) {
          console.error('[findConnectedComponents] Invalid cur value:', cur)
          break
        }
        comp.push(cur)
        try {
          const neighbors = getNeighborsCached(cur, positions, hexRadius)
          if (!Array.isArray(neighbors)) {
            console.error('[findConnectedComponents] getNeighborsCached returned non-array:', typeof neighbors, neighbors)
            continue
          }
          for (const n of neighbors) {
            if (typeof n !== 'number' || isNaN(n)) {
              console.error('[findConnectedComponents] Invalid neighbor index:', n, 'type:', typeof n)
              continue
            }
            if (!visited.has(n) && set.has(n)) { 
              visited.add(n); 
              q.push(n) 
            }
          }
        } catch (e) {
          console.error('[findConnectedComponents] Error getting neighbors for index', cur, ':', e)
          continue
        }
      }
      console.log('[findConnectedComponents] Component', componentCount, 'complete:', comp.length, 'nodes,', iterations, 'iterations')
      comps.push(comp)
    }
    console.log('[findConnectedComponents] Complete:', comps.length, 'components found')
    const elapsed = performance.now() - startMarker
    console.log('[findConnectedComponents] ✅ RETURNING - elapsed=', elapsed, 'ms, components=', comps.length)
    return comps
  } catch (e) {
    const elapsed = performance.now() - startMarker
    console.error('[findConnectedComponents] ERROR after', elapsed, 'ms:', e, 'indices.length=', indices.length, 'tryBlockEntered=', tryBlockEntered)
    // If we never entered the try block, something is seriously wrong
    if (!tryBlockEntered) {
      console.error('[findConnectedComponents] CRITICAL: Try block never entered! This suggests a hang before try block.')
    }
    throw e
  } finally {
    const elapsed = performance.now() - startMarker
    if (elapsed > 1000) {
      console.warn('[findConnectedComponents] ⚠️ Function took', elapsed, 'ms to complete')
    }
  }
}

function calculatePhotoCentroids(
  infections: Map<number, Infection>,
  positions: [number, number, number][],
  hexRadius: number
) {
  try {
    console.log('[calculatePhotoCentroids] Starting with', infections.size, 'infections')
    const byPhoto = new Map<string, number[]>()
    for (const [idx, inf] of infections) { 
      if (!inf || !inf.photo) continue
      const arr = byPhoto.get(inf.photo.id) || []; 
      arr.push(idx); 
      byPhoto.set(inf.photo.id, arr) 
    }
    console.log('[calculatePhotoCentroids] Grouped into', byPhoto.size, 'photos')
    const centroids = new Map<string, [number, number][]>()
    let photoNum = 0
    for (const [photoId, inds] of byPhoto) {
      photoNum++
      console.log('[calculatePhotoCentroids] Processing photo', photoNum, '/', byPhoto.size, 'photoId=', photoId, 'indices=', inds.length)
      try {
        console.log('[calculatePhotoCentroids] About to call findConnectedComponents with', inds.length, 'indices')
        const callStartTime = performance.now()
        let comps: number[][]
        try {
          // Add a pre-call validation to ensure we're not calling with invalid data
          if (!inds || inds.length === 0) {
            console.warn('[calculatePhotoCentroids] Empty indices array, skipping findConnectedComponents')
            comps = []
          } else if (!positions || positions.length === 0) {
            console.warn('[calculatePhotoCentroids] Empty positions array, skipping findConnectedComponents')
            comps = []
          } else {
            comps = findConnectedComponents(inds, positions, hexRadius)
            const callElapsed = performance.now() - callStartTime
            console.log('[calculatePhotoCentroids] findConnectedComponents RETURNED with', comps.length, 'components after', callElapsed, 'ms')
          }
        } catch (e) {
          const callElapsed = performance.now() - callStartTime
          console.error('[calculatePhotoCentroids] findConnectedComponents threw error after', callElapsed, 'ms:', e)
          // Return empty components on error to allow evolution to continue
          comps = []
        }
        console.log('[calculatePhotoCentroids] findConnectedComponents returned', comps.length, 'components')
        console.log('[calculatePhotoCentroids]   Found', comps.length, 'components for photo', photoId)
        const cs: [number, number][] = []
        for (const comp of comps) {
          let sx = 0, sy = 0
          for (const i of comp) { const p = positions[i]; if (p) { sx += p[0]; sy += p[1] } }
          if (comp.length > 0) cs.push([sx / comp.length, sy / comp.length])
        }
        centroids.set(photoId, cs)
      } catch (e) {
        console.error('[calculatePhotoCentroids] Error processing photo', photoId, ':', e)
        centroids.set(photoId, [])
      }
    }
    console.log('[calculatePhotoCentroids] Completed, returning', centroids.size, 'photo centroids')
    return centroids
  } catch (e) {
    console.error('[calculatePhotoCentroids] FATAL ERROR:', e)
    throw e
  }
}

function calculateContiguity(indices: number[], positions: [number, number, number][], hexRadius: number) {
  const getNeighbors = (index: number) => getNeighborsCached(index, positions, hexRadius)
  return _calculateContiguity(indices, positions, hexRadius, getNeighbors)
}

// Assign cluster-aware grid positions so each hex in a cluster shows a different part of the image
// Returns tile centers for debug visualization when workerDebug.showTileCenters is enabled
function assignClusterGridPositions(
  infections: Map<number, Infection>,
  positions: [number, number, number][],
  hexRadius: number
): Array<{ photoId: string; clusterIndex: number; centers: Array<{ x: number; y: number; col: number; row: number }> }> {
  const debugCenters: Array<{ photoId: string; clusterIndex: number; centers: Array<{ x: number; y: number; col: number; row: number }> }> = []
  
  try {
    console.log('[assignClusterGridPositions] Starting with', infections.size, 'infections')
    
    // Group infections by photo
    const byPhoto = new Map<string, number[]>()
    for (const [idx, inf] of infections) {
      if (!inf || !inf.photo) continue
      const arr = byPhoto.get(inf.photo.id) || []
      arr.push(idx)
      byPhoto.set(inf.photo.id, arr)
    }
    
    console.log('[assignClusterGridPositions] Processing', byPhoto.size, 'unique photos')
    
    // Cluster size analytics
    let totalClusters = 0
    let clusterSizes: number[] = []
    
    // Process each photo's clusters
    for (const [photoId, indices] of byPhoto) {
      // Find connected components (separate clusters of the same photo)
      const components = findConnectedComponents(indices, positions, hexRadius)
      
      totalClusters += components.length
      for (const comp of components) {
        if (comp && comp.length > 0) clusterSizes.push(comp.length)
      }
      
      console.log('[assignClusterGridPositions] Photo', photoId.substring(0, 8), 'has', components.length, 'clusters, sizes:', components.map(c => c.length).join(','))
      
      // Process each cluster separately
      let clusterIndex = 0
      for (const cluster of components) {
        if (!cluster || cluster.length === 0) continue

        // Get the tiling configuration from the first infection in the cluster
        const firstInf = infections.get(cluster[0])
        if (!firstInf) continue

        // --- Hex lattice mapping fast-path -------------------------------------------------
        // If enabled, derive tile coordinates directly from inferred axial-like row/col indices
        // instead of using normalized bounding boxes + spatial nearest matching. This produces
        // contiguous, parity-correct tiling where adjacent hexes map to adjacent UV tiles.
        if (workerDebug.clusterHexLattice) {
          try {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
            for (const idx of cluster) {
              const p = positions[idx]; if (!p) continue
              if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]
              if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]
            }
            const clusterWidth = Math.max(0, maxX - minX)
            const clusterHeight = Math.max(0, maxY - minY)

            // Infer spacings from hexRadius (flat-top hex layout):
            const horizSpacing = Math.sqrt(3) * hexRadius
            const vertSpacing = 1.5 * hexRadius

            // Build lattice coordinates (rowIndex, colIndex) respecting row parity offset.
            const latticeCoords = new Map<number, { row: number; col: number }>()
            let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity
            for (const id of cluster) {
              const p = positions[id]; if (!p) continue
              const rowF = (p[1] - minY) / vertSpacing
              const row = Math.round(rowF)
              // Row parity offset: odd rows in generatePixelScreen are shifted +0.5 * horizSpacing.
              const rowOffset = (row % 2 === 1) ? (horizSpacing * 0.5) : 0
              const colF = (p[0] - (minX + rowOffset)) / horizSpacing
              const col = Math.round(colF)
              latticeCoords.set(id, { row, col })
              if (row < minRow) minRow = row; if (row > maxRow) maxRow = row
              if (col < minCol) minCol = col; if (col > maxCol) maxCol = col
            }

            const latticeRows = maxRow - minRow + 1
            const latticeCols = maxCol - minCol + 1

            // Initial tile grid matches lattice extents.
            let tilesX = latticeCols
            let tilesY = latticeRows

            // If we have more hexes than lattice cells due to rounding collisions, expand.
            const rawTileCount = tilesX * tilesY
            if (cluster.length > rawTileCount) {
              // Simple expansion: grow columns while respecting max cap.
              const MAX_TILES = typeof workerDebug.clusterMaxTiles === 'number' && workerDebug.clusterMaxTiles > 0 ? Math.floor(workerDebug.clusterMaxTiles) : 128
              while (tilesX * tilesY < cluster.length && tilesX * tilesY < MAX_TILES) {
                if (tilesX <= tilesY) tilesX++; else tilesY++
              }
            }

            console.log('[assignClusterGridPositions][hex-lattice] cluster', photoId.substring(0,8), 'size', cluster.length,
              'latticeCols', latticeCols, 'latticeRows', latticeRows, 'tilesX', tilesX, 'tilesY', tilesY)

            // Build optional serpentine ordering for assignment uniqueness (not strictly needed since lattice mapping is direct)
            const serpentine = (workerDebug.clusterScanMode === 'serpentine')

            // Assign each infection a gridPosition derived from lattice coordinates compressed into tile grid domain.
            // Enhancement: compact gaps in each row for more contiguous image mapping
            const compactGaps = workerDebug.clusterCompactGaps !== false
            
            // Build row-by-row column mapping to handle gaps
            const rowColMap = new Map<number, Map<number, number>>() // row -> (oldCol -> newCol)
            if (compactGaps) {
              for (let row = minRow; row <= maxRow; row++) {
                const colsInRow = Array.from(latticeCoords.entries())
                  .filter(([_, lc]) => lc.row === row)
                  .map(([_, lc]) => lc.col)
                  .sort((a, b) => a - b)
                
                const colMap = new Map<number, number>()
                colsInRow.forEach((oldCol, newIdx) => {
                  colMap.set(oldCol, newIdx)
                })
                rowColMap.set(row, colMap)
              }
            }
            
            // Collision detection: track which tiles are occupied
            const tileOccupancy = new Map<string, number>() // "col,row" -> nodeId
            const tileKey = (c: number, r: number) => `${c},${r}`
            
            for (const id of cluster) {
              const inf = infections.get(id); if (!inf) continue
              const lc = latticeCoords.get(id); if (!lc) continue
              
              let gridCol = compactGaps && rowColMap.has(lc.row) 
                ? (rowColMap.get(lc.row)!.get(lc.col) ?? (lc.col - minCol))
                : (lc.col - minCol)
              let gridRow = lc.row - minRow
              
              if (serpentine && (gridRow % 2 === 1)) {
                gridCol = (tilesX - 1) - gridCol
              }
              
              // Clamp to valid range
              if (gridCol < 0) gridCol = 0; if (gridCol >= tilesX) gridCol = tilesX - 1
              if (gridRow < 0) gridRow = 0; if (gridRow >= tilesY) gridRow = tilesY - 1

              // Collision resolution: if tile is occupied, find nearest free tile
              const key = tileKey(gridCol, gridRow)
              if (tileOccupancy.has(key)) {
                const nodePos = positions[id]
                let bestCol = gridCol, bestRow = gridRow
                let bestDist = Infinity
                
                // Search in expanding radius for free tile
                for (let radius = 1; radius <= Math.max(tilesX, tilesY); radius++) {
                  let found = false
                  for (let dc = -radius; dc <= radius; dc++) {
                    for (let dr = -radius; dr <= radius; dr++) {
                      if (Math.abs(dc) !== radius && Math.abs(dr) !== radius) continue // Only check perimeter
                      const testCol = gridCol + dc
                      const testRow = gridRow + dr
                      if (testCol < 0 || testCol >= tilesX || testRow < 0 || testRow >= tilesY) continue
                      const testKey = tileKey(testCol, testRow)
                      if (!tileOccupancy.has(testKey)) {
                        // Calculate distance to this tile's center
                        const tileU = (testCol + 0.5) / tilesX
                        const tileV = (testRow + 0.5) / tilesY
                        const tileCenterX = minX + tileU * clusterWidth
                        const tileCenterY = minY + tileV * clusterHeight
                        const dist = Math.hypot(nodePos[0] - tileCenterX, nodePos[1] - tileCenterY)
                        if (dist < bestDist) {
                          bestDist = dist
                          bestCol = testCol
                          bestRow = testRow
                          found = true
                        }
                      }
                    }
                  }
                  if (found) break
                }
                gridCol = bestCol
                gridRow = bestRow
              }
              
              tileOccupancy.set(tileKey(gridCol, gridRow), id)

              // Optionally support vertical anchor flip
              if (workerDebug.clusterAnchor === 'max') {
                gridRow = Math.max(0, tilesY - 1 - gridRow)
              }

              let uvBounds = calculateUvBoundsFromGridPosition(gridCol, gridRow, tilesX, tilesY)
              const inset = Math.max(0, Math.min(0.49, Number(workerDebug.clusterUvInset) || 0))
              if (inset > 0) {
                const u0 = uvBounds[0], v0 = uvBounds[1], u1 = uvBounds[2], v1 = uvBounds[3]
                const du = (u1 - u0) * inset
                const dv = (v1 - v0) * inset
                uvBounds = [u0 + du, v0 + dv, u1 - du, v1 - dv]
              }
              // Optional parity UV shift: shift odd rows horizontally by half a tile width in UV space.
              // Enhanced: use precise hex geometry for sub-pixel accuracy
              if (workerDebug.clusterParityUvShift && (gridRow % 2 === 1)) {
                // Use actual lattice row parity from hex geometry, not tile row
                const hexRowParity = lc.row % 2
                const shift = hexRowParity === 1 ? 0.5 / tilesX : 0
                let u0 = uvBounds[0] + shift
                let u1 = uvBounds[2] + shift
                // Wrap within [0,1]
                if (u0 >= 1) u0 -= 1
                if (u1 > 1) u1 -= 1
                // Guard against pathological wrapping inversion (should not occur with shift<tileWidth)
                if (u1 < u0) {
                  // If inverted due to wrapping edge case, clamp instead of wrap
                  u0 = Math.min(u0, 1 - (1 / tilesX))
                  u1 = Math.min(1, u0 + (1 / tilesX))
                }
                uvBounds = [u0, uvBounds[1], u1, uvBounds[3]]
              }
              infections.set(id, { ...inf, gridPosition: [gridCol, gridRow], uvBounds, tilesX, tilesY })
            }

            // Advance cluster index and continue to next cluster (skip legacy logic)
            clusterIndex++
            continue
          } catch (e) {
            console.warn('[assignClusterGridPositions][hex-lattice] failed, falling back to legacy path:', e)
            // fall through to existing (spatial) logic
          }
        }

        // Find the bounding box of this cluster in grid space first
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
        for (const idx of cluster) {
          const pos = positions[idx]
          if (!pos) continue
          minX = Math.min(minX, pos[0])
          maxX = Math.max(maxX, pos[0])
          minY = Math.min(minY, pos[1])
          maxY = Math.max(maxY, pos[1])
        }

        const clusterWidth = Math.max(0, maxX - minX)
        const clusterHeight = Math.max(0, maxY - minY)
        
        console.log('[assignClusterGridPositions] Cluster bounds:', { 
          photoId: photoId.substring(0, 8), 
          clusterIndex, 
          hexCount: cluster.length,
          minX: minX.toFixed(2), 
          maxX: maxX.toFixed(2), 
          minY: minY.toFixed(2), 
          maxY: maxY.toFixed(2),
          width: clusterWidth.toFixed(2), 
          height: clusterHeight.toFixed(2)
        })
        
        // Calculate optimal tilesX and tilesY based on cluster aspect ratio
        // This ensures the tile grid matches the spatial layout of the cluster
        const clusterAspect = clusterHeight > 0 ? clusterWidth / clusterHeight : 1.0
        const targetTileCount = 16 // Target ~16 tiles total for good image distribution
        
        console.log('[assignClusterGridPositions] Cluster aspect:', clusterAspect.toFixed(3), '(width/height)')
        
        let tilesX: number
        let tilesY: number
        
        if (cluster.length === 1) {
          // Single hexagon: use 1x1
          tilesX = 1
          tilesY = 1
        } else if (workerDebug.clusterDynamicTiling !== false) {
          // Dynamic tiling: match cluster aspect ratio
          // sqrt(tilesX * tilesY) = sqrt(targetTileCount)
          // tilesX / tilesY = clusterAspect
          // => tilesX = clusterAspect * tilesY
          // => clusterAspect * tilesY * tilesY = targetTileCount
          // => tilesY = sqrt(targetTileCount / clusterAspect)
          tilesY = Math.max(1, Math.round(Math.sqrt(targetTileCount / clusterAspect)))
          tilesX = Math.max(1, Math.round(clusterAspect * tilesY))
          
          // Clamp to reasonable range
          tilesX = Math.max(1, Math.min(8, tilesX))
          tilesY = Math.max(1, Math.min(8, tilesY))
        } else {
          // Fallback to fixed tiling from infection config
          tilesX = Math.max(1, firstInf.tilesX || 4)
          tilesY = Math.max(1, firstInf.tilesY || 4)
        }

        // If the cluster contains more hexes than tiles, expand the tile grid
        // to avoid many hexes mapping to the same UV tile (which causes repeating
        // image patches). Preserve the tile aspect ratio but scale up the total
        // tile count to be at least cluster.length, clamped to a safe maximum.
        try {
          const currentTileCount = tilesX * tilesY
          const requiredTiles = Math.max(currentTileCount, cluster.length)
          const MAX_TILES = typeof workerDebug.clusterMaxTiles === 'number' && workerDebug.clusterMaxTiles > 0 ? Math.max(1, Math.floor(workerDebug.clusterMaxTiles)) : 64
          const targetTiles = Math.min(requiredTiles, MAX_TILES)

          if (targetTiles > currentTileCount) {
            // preserve aspect ratio roughly: ratio = tilesX / tilesY
            const ratio = tilesX / Math.max(1, tilesY)
            // compute new tilesY from targetTiles and ratio
            let newTilesY = Math.max(1, Math.round(Math.sqrt(targetTiles / Math.max(1e-9, ratio))))
            let newTilesX = Math.max(1, Math.round(ratio * newTilesY))
            // if rounding produced fewer tiles than needed, bump progressively
            while (newTilesX * newTilesY < targetTiles) {
              if (newTilesX <= newTilesY) newTilesX++
              else newTilesY++
              if (newTilesX * newTilesY >= MAX_TILES) break
            }
            // clamp to reasonable maxima
            newTilesX = Math.max(1, Math.min(16, newTilesX))
            newTilesY = Math.max(1, Math.min(16, newTilesY))
            tilesX = newTilesX
            tilesY = newTilesY
            console.log('[assignClusterGridPositions] Expanded tile grid to', tilesX, 'x', tilesY, '=', tilesX * tilesY, 'tiles')
          }
        } catch (e) {
          // if anything goes wrong, keep original tilesX/tilesY
        }

        console.log('[assignClusterGridPositions] Final tile dimensions:', tilesX, 'x', tilesY, '=', tilesX * tilesY, 'tiles for', cluster.length, 'hexes')

        // Single-hex or degenerate clusters: assign a deterministic tile so single hexes don't all use [0,0]
        if (cluster.length === 1 || clusterWidth < 1e-6 || clusterHeight < 1e-6) {
          const idx = cluster[0]
          const inf = infections.get(idx)
          if (!inf) continue
          // Deterministic hash from index to pick a tile
          const h = (idx * 2654435761) >>> 0
          const gridCol = h % tilesX
          let gridRow = ((h >>> 8) % tilesY)
          // If configured, allow anchoring to the bottom of the image (flip vertical tile index)
          if (workerDebug.clusterAnchor === 'max') {
            gridRow = Math.max(0, tilesY - 1 - gridRow)
          }
          const uvBounds = calculateUvBoundsFromGridPosition(gridCol, gridRow, tilesX, tilesY)
          infections.set(idx, { ...inf, gridPosition: [gridCol, gridRow], uvBounds })
          continue
        }

        // Optionally preserve aspect ratio when mapping cluster to tile grid
        const preserveAspect = !!workerDebug.clusterPreserveAspect
        let normMinX = minX, normMinY = minY, normWidth = clusterWidth, normHeight = clusterHeight

        if (preserveAspect) {
          const clusterAspect = clusterWidth / clusterHeight
          const tileAspect = tilesX / tilesY
          const fillMode = workerDebug.clusterFillMode || 'contain'
          if (fillMode === 'contain') {
            // current behavior: pad shorter dimension so the whole image fits (no cropping)
            if (clusterAspect > tileAspect) {
              const effectiveHeight = clusterWidth / tileAspect
              const pad = effectiveHeight - clusterHeight
              if (workerDebug.clusterAnchor === 'min') {
                normMinY = minY
              } else {
                normMinY = minY - pad / 2
              }
              normHeight = effectiveHeight
            } else if (clusterAspect < tileAspect) {
              const effectiveWidth = clusterHeight * tileAspect
              const pad = effectiveWidth - clusterWidth
              if (workerDebug.clusterAnchor === 'min') {
                normMinX = minX
              } else {
                normMinX = minX - pad / 2
              }
              normWidth = effectiveWidth
            }
          } else {
            // 'cover' mode: scale so tile grid fully covers cluster bounds, allowing cropping
            if (clusterAspect > tileAspect) {
              // cluster is wider than tile grid: scale width down (crop left/right)
              const effectiveWidth = clusterHeight * tileAspect
              const crop = clusterWidth - effectiveWidth
              if (workerDebug.clusterAnchor === 'min') {
                normMinX = minX + crop // crop from right
              } else {
                normMinX = minX + crop / 2
              }
              normWidth = effectiveWidth
            } else if (clusterAspect < tileAspect) {
              // cluster is taller than tile grid: scale height down (crop top/bottom)
              const effectiveHeight = clusterWidth / tileAspect
              const crop = clusterHeight - effectiveHeight
              if (workerDebug.clusterAnchor === 'min') {
                normMinY = minY + crop
              } else {
                normMinY = minY + crop / 2
              }
              normHeight = effectiveHeight
            }
          }
        }

        // Assign grid positions using preferred-quantized -> nearest-free strategy
        // Guard tiny normalized dimensions to avoid degenerate quantization
        // This produces contiguous tiling for clusters and avoids many hexes
        // quantizing into the same UV tile.
        try {
          const clusterSet = new Set(cluster)

          // Helper: tile bounds check
          const inTileBounds = (c: number, r: number) => c >= 0 && c < tilesX && r >= 0 && r < tilesY

          // Tile occupancy map key
          const tileKey = (c: number, r: number) => `${c},${r}`

          // Pre-allocate occupancy map and assignment map
          const occupied = new Map<string, boolean>()
          const assignment = new Map<number, [number, number]>()

          // Choose origin by cluster centroid (closest hex to centroid)
          let cx = 0, cy = 0
          for (const id of cluster) { const p = positions[id]; cx += p[0]; cy += p[1] }
          cx /= cluster.length; cy /= cluster.length
          let originIndex = cluster[0]
          let bestD = Infinity
          for (const id of cluster) {
            const p = positions[id]
            const d = Math.hypot(p[0] - cx, p[1] - cy)
            if (d < bestD) { bestD = d; originIndex = id }
          }

          // Tile-first scanline assignment: build tiles in row-major order, then pick nearest unassigned node
          const startCol = Math.floor(tilesX / 2)
          const startRow = Math.floor(tilesY / 2)

          // Ensure normalized dims aren't tiny
          const MIN_NORM = 1e-6
          if (normWidth < MIN_NORM) normWidth = MIN_NORM
          if (normHeight < MIN_NORM) normHeight = MIN_NORM

          // Build tile list in row-major or serpentine order depending on config
          const tiles: [number, number][] = []
          const scanMode = (workerDebug.clusterScanMode || 'row')
          for (let r = 0; r < tilesY; r++) {
            if (scanMode === 'serpentine' && (r % 2 === 1)) {
              // right-to-left on odd rows for serpentine
              for (let c = tilesX - 1; c >= 0; c--) tiles.push([c, r])
            } else {
              for (let c = 0; c < tilesX; c++) tiles.push([c, r])
            }
          }

          // Helper: compute tile center in cluster-space
          const parityAware = !!workerDebug.clusterParityAware

          // compute physical horizontal offset for hex parity from cluster geometry
          const hexSpacingFactor = Number(workerDebug.hexSpacing) || 1
          // initial fallback spacing based on configured hexRadius
          let realHorizSpacing = Math.sqrt(3) * hexRadius * hexSpacingFactor

          // Try to infer horizontal spacing from actual node positions in the cluster.
          // Group nodes into approximate rows and measure adjacent x-deltas.
          try {
            const rowBuckets = new Map<number, number[]>()
            for (const id of cluster) {
              const p = positions[id]
              if (!p) continue
              // ratio across normalized height
              const ratio = (p[1] - normMinY) / Math.max(1e-9, normHeight)
              let r = Math.floor(ratio * tilesY)
              r = Math.max(0, Math.min(tilesY - 1, r))
              const arr = rowBuckets.get(r) || []
              arr.push(p[0])
              rowBuckets.set(r, arr)
            }
            const diffs: number[] = []
            for (const xs of rowBuckets.values()) {
              if (!xs || xs.length < 2) continue
              xs.sort((a, b) => a - b)
              for (let i = 1; i < xs.length; i++) diffs.push(xs[i] - xs[i - 1])
            }
            if (diffs.length > 0) {
              diffs.sort((a, b) => a - b)
              const mid = Math.floor(diffs.length / 2)
              realHorizSpacing = diffs.length % 2 === 1 ? diffs[mid] : ((diffs[mid - 1] + diffs[mid]) / 2)
              if (!isFinite(realHorizSpacing) || realHorizSpacing <= 0) realHorizSpacing = Math.sqrt(3) * hexRadius * hexSpacingFactor
            }
          } catch (e) {
            // fallback to default computed spacing
            realHorizSpacing = Math.sqrt(3) * hexRadius * hexSpacingFactor
          }

          // tile center calculation: simple regular grid, no parity offset
          // The hex positions already have natural staggering, so tile centers should be regular
          const tileCenter = (col: number, row: number) => {
            const u = (col + 0.5) / tilesX
            const v = (row + 0.5) / tilesY
            const x = normMinX + u * normWidth
            const y = normMinY + v * normHeight
            return [x, y]
          }

          console.log('[assignClusterGridPositions] Normalized bounds for tiling:', {
            normMinX: normMinX.toFixed(2),
            normMinY: normMinY.toFixed(2),
            normWidth: normWidth.toFixed(2),
            normHeight: normHeight.toFixed(2),
            preserveAspect,
            fillMode: workerDebug.clusterFillMode
          })

          // SPATIAL assignment: each hex gets the tile whose center is spatially nearest
          // This guarantees perfect alignment between hex positions and tile centers
          // Build centers map first
          const centers: { t: [number, number]; x: number; y: number }[] = []
          for (let r = 0; r < tilesY; r++) for (let c = 0; c < tilesX; c++) {
            const [x, y] = tileCenter(c, r)
            centers.push({ t: [c, r], x, y })
          }

          // Optionally collect centers for debug visualization
          if (workerDebug.showTileCenters) {
            debugCenters.push({
              photoId,
              clusterIndex,
              centers: centers.map(c => ({ x: c.x, y: c.y, col: c.t[0], row: c.t[1] }))
            })
          }

          // Assign each hex to its nearest tile center (purely spatial)
          // Log a few examples to verify the mapping
          const assignmentSamples: Array<{nodeId: number, nodeX: number, nodeY: number, tileCol: number, tileRow: number, centerX: number, centerY: number, dist: number}> = []
          
          for (const nodeId of cluster) {
            const nodePos = positions[nodeId]
            if (!nodePos) continue
            
            let nearestTile: [number, number] = centers[0].t
            let nearestDist = Infinity
            let nearestCenter: {x: number, y: number} = centers[0]
            
            for (const c of centers) {
              const dist = Math.hypot(nodePos[0] - c.x, nodePos[1] - c.y)
              if (dist < nearestDist) {
                nearestDist = dist
                nearestTile = c.t
                nearestCenter = c
              }
            }
            
            assignment.set(nodeId, nearestTile)
            occupied.set(tileKey(nearestTile[0], nearestTile[1]), true)
            
            // Sample first few for debugging
            if (assignmentSamples.length < 5) {
              assignmentSamples.push({
                nodeId,
                nodeX: nodePos[0],
                nodeY: nodePos[1],
                tileCol: nearestTile[0],
                tileRow: nearestTile[1],
                centerX: nearestCenter.x,
                centerY: nearestCenter.y,
                dist: nearestDist
              })
            }
          }

          console.log('[assignClusterGridPositions] Spatially assigned', cluster.length, 'hexes to nearest tile centers')
          console.log('[assignClusterGridPositions] Sample assignments:', assignmentSamples.map(s => 
            `node#${s.nodeId} at (${s.nodeX.toFixed(1)},${s.nodeY.toFixed(1)}) → tile[${s.tileCol},${s.tileRow}] center(${s.centerX.toFixed(1)},${s.centerY.toFixed(1)}) dist=${s.dist.toFixed(1)}`
          ).join('\n  '))

          // Optional: Neighborhood-aware refinement to reduce visual seams
          // For each hex, check if its neighbors suggest a better tile assignment for visual continuity
          if (workerDebug.clusterNeighborAware !== false) {
            const maxIterations = 3 // Multiple passes to propagate improvements
            for (let iter = 0; iter < maxIterations; iter++) {
              let adjustments = 0
              for (const nodeId of cluster) {
                const currentTile = assignment.get(nodeId)
                if (!currentTile) continue
                
                // Get neighbors within this cluster
                const neighbors = getNeighborsCached(nodeId, positions, hexRadius)
                const clusterNeighbors = neighbors.filter(n => clusterSet.has(n) && assignment.has(n))
                if (clusterNeighbors.length === 0) continue
                
                // Collect neighbor tiles and compute centroid
                const neighborTiles: Array<[number, number]> = []
                for (const n of clusterNeighbors) {
                  const nt = assignment.get(n)
                  if (nt) neighborTiles.push(nt)
                }
                
                if (neighborTiles.length === 0) continue
                
                // Compute average neighbor tile position
                let avgCol = 0, avgRow = 0
                for (const [c, r] of neighborTiles) {
                  avgCol += c
                  avgRow += r
                }
                avgCol /= neighborTiles.length
                avgRow /= neighborTiles.length
                
                // Find the tile closest to the neighbor average that's spatially near this node
                const nodePos = positions[nodeId]
                if (!nodePos) continue
                
                let bestAlternative: [number, number] | null = null
                let bestScore = Infinity
                
                // Consider tiles in a local neighborhood around current tile
                const searchRadius = 2
                for (let dc = -searchRadius; dc <= searchRadius; dc++) {
                  for (let dr = -searchRadius; dr <= searchRadius; dr++) {
                    const candidateCol = Math.max(0, Math.min(tilesX - 1, currentTile[0] + dc))
                    const candidateRow = Math.max(0, Math.min(tilesY - 1, currentTile[1] + dr))
                    const candidate: [number, number] = [candidateCol, candidateRow]
                    
                    // Score: distance to neighbor tile average + spatial distance to tile center
                    const tileDist = Math.hypot(candidateCol - avgCol, candidateRow - avgRow)
                    const [cx, cy] = tileCenter(candidateCol, candidateRow)
                    const spatialDist = Math.hypot(nodePos[0] - cx, nodePos[1] - cy)
                    const score = tileDist * 0.7 + spatialDist * 0.3
                    
                    if (score < bestScore) {
                      bestScore = score
                      bestAlternative = candidate
                    }
                  }
                }
                
                // If we found a better tile and it's different from current, update
                if (bestAlternative && (bestAlternative[0] !== currentTile[0] || bestAlternative[1] !== currentTile[1])) {
                  assignment.set(nodeId, bestAlternative)
                  adjustments++
                }
              }
              
              if (adjustments === 0) break // Converged
              console.log('[assignClusterGridPositions] Neighbor-aware refinement iteration', iter + 1, ':', adjustments, 'adjustments')
            }
          }

          // Finally write assignments back into infections with UV bounds/inset
          const inset = Math.max(0, Math.min(0.49, Number(workerDebug.clusterUvInset) || 0))
          for (const id of cluster) {
            const inf = infections.get(id)
            if (!inf) continue
            let assignedTile = assignment.get(id) || [0, 0]
            // Support bottom anchoring: flip the vertical tile index when 'max' is configured
            if (workerDebug.clusterAnchor === 'max') {
              assignedTile = [assignedTile[0], Math.max(0, tilesY - 1 - assignedTile[1])]
            }
            let uvBounds = calculateUvBoundsFromGridPosition(assignedTile[0], assignedTile[1], tilesX, tilesY)
            if (inset > 0) {
              const u0 = uvBounds[0], v0 = uvBounds[1], u1 = uvBounds[2], v1 = uvBounds[3]
              const du = (u1 - u0) * inset
              const dv = (v1 - v0) * inset
              uvBounds = [u0 + du, v0 + dv, u1 - du, v1 - dv]
            }
            infections.set(id, { ...inf, gridPosition: [assignedTile[0], assignedTile[1]], uvBounds, tilesX, tilesY })
          }
          console.log('[assignClusterGridPositions] Assigned grid positions to', cluster.length, 'hexes in cluster (BFS)')
        } catch (e) {
          console.error('[assignClusterGridPositions] BFS assignment failed, falling back to quantization', e)
          // fallback: leave previous behavior (quantization) to avoid breaking
        }
        clusterIndex++
      }
    }
    
    // Log cluster statistics
    if (clusterSizes.length > 0) {
      clusterSizes.sort((a, b) => b - a) // descending
      const avgSize = clusterSizes.reduce((sum, s) => sum + s, 0) / clusterSizes.length
      const medianSize = clusterSizes[Math.floor(clusterSizes.length / 2)]
      const maxSize = clusterSizes[0]
      const smallClusters = clusterSizes.filter(s => s <= 3).length
      console.log('[assignClusterGridPositions] CLUSTER STATS: total=', totalClusters, 'avg=', avgSize.toFixed(1), 'median=', medianSize, 'max=', maxSize, 'small(≤3)=', smallClusters, '/', totalClusters, '(', (100 * smallClusters / totalClusters).toFixed(0), '%)')
    }
    
    console.log('[assignClusterGridPositions] Complete')
  } catch (e) {
    console.error('[assignClusterGridPositions] Error:', e)
  }
  
  return debugCenters
}

function postOptimizationMerge(infections: Map<number, Infection>, positions: [number, number, number][], hexRadius: number, debug = false) {
  try {
    if (!workerDebug || !workerDebug.enableMerges) { if (debug && workerDebug.mergeLogs) console.log('[merge] disabled'); return }
    const threshold = typeof workerDebug.mergeSmallComponentsThreshold === 'number' ? workerDebug.mergeSmallComponentsThreshold : 3
    const byPhoto = new Map<string, number[]>()
    for (const [idx, inf] of infections) { const arr = byPhoto.get(inf.photo.id) || []; arr.push(idx); byPhoto.set(inf.photo.id, arr) }
    let merges = 0
    for (const [photoId, inds] of byPhoto) {
      const comps = findConnectedComponents(inds, positions, hexRadius)
      const small = comps.filter(c => c.length > 0 && c.length <= threshold)
      const big = comps.filter(c => c.length > threshold)
      if (small.length === 0 || big.length === 0) continue
      const bounds = getGridBounds(positions)
      for (const s of small) {
        let best: number[] | null = null; let bestD = Infinity
        for (const b of big) {
          let sx = 0, sy = 0, bx = 0, by = 0
          for (const i of s) { const p = positions[i]; if (p) { sx += p[0]; sy += p[1] } }
          for (const i of b) { const p = positions[i]; if (p) { bx += p[0]; by += p[1] } }
          const scx = sx / s.length, scy = sy / s.length, bcx = bx / b.length, bcy = by / b.length
          const dx = Math.abs(scx - bcx)
          const dy = Math.abs(scy - bcy)
          let effDx = dx
          let effDy = dy
          if (cache.isSpherical && bounds.width > 0 && bounds.height > 0) {
            if (effDx > bounds.width / 2) effDx = bounds.width - effDx
            if (effDy > bounds.height / 2) effDy = bounds.height - effDy
          }
          const d = Math.sqrt(effDx * effDx + effDy * effDy)
          if (d < bestD) { bestD = d; best = b }
        }
        if (!best) continue
        const recipientId = infections.get(best[0])?.photo.id
        if (!recipientId) continue
        const before = calculateContiguity(best, positions, hexRadius)
        const after = calculateContiguity([...best, ...s], positions, hexRadius)
        if (after > before + 1) {
          for (const idx of s) { const inf = infections.get(idx); if (!inf) continue; infections.set(idx, { ...inf, photo: infections.get(best[0])!.photo }) }
          merges++
          if (debug && workerDebug.mergeLogs) console.log(`[merge] moved ${s.length} -> ${recipientId}`)
        }
      }
    }
  } catch (e) { if (debug) console.warn('[merge] failed', e) }
}

function normalizePrevState(prevState: any) : { infections: Map<number, Infection>, availableIndices: number[], generation?: number } {
  try {
    if (!prevState) return { infections: new Map<number, Infection>(), availableIndices: [] }
    let infectionsMap: Map<number, Infection>
    if (prevState.infections instanceof Map) {
      infectionsMap = prevState.infections
    } else if (Array.isArray(prevState.infections)) {
      try { infectionsMap = new Map<number, Infection>(prevState.infections) } catch (e) { infectionsMap = new Map<number, Infection>() }
    } else if (typeof prevState.infections === 'object' && prevState.infections !== null && typeof prevState.infections.entries === 'function') {
      try { infectionsMap = new Map<number, Infection>(Array.from(prevState.infections.entries())) } catch (e) { infectionsMap = new Map<number, Infection>() }
    } else {
      infectionsMap = new Map<number, Infection>()
    }
    const available = Array.isArray(prevState.availableIndices) ? prevState.availableIndices : []
    return { infections: infectionsMap, availableIndices: available, generation: prevState.generation }
  } catch (e) {
    safePostError(e)
    return { infections: new Map<number, Infection>(), availableIndices: [] }
  }
}

function evolveInfectionSystem(prevState: any, positions: [number, number, number][], photos: Photo[], hexRadius: number, currentTime: number, debug = false): InfectionSystemState | null {
  try {
    console.log('[evolve] Step 1: Validating positions...')
    if (!positions || positions.length === 0) {
      safePostError(new Error('positions required for evolve'))
      return null
    }
    console.log('[evolve] Step 2: Normalizing state...')
    const normalized = normalizePrevState(prevState)
    const infectionsMap: Map<number, Infection> = normalized.infections
    const availableSet = new Set<number>(Array.isArray(normalized.availableIndices) ? normalized.availableIndices : [])
    console.log('[evolve] Step 3: Cleaning infections...')
    for (const [idx, inf] of infectionsMap) { if (!inf || !inf.photo) { infectionsMap.delete(idx); availableSet.add(idx) } }

    console.log('[evolve] Step 4: Calculating centroids...')
  const centroids = calculatePhotoCentroids(infectionsMap, positions, hexRadius)
    console.log('[evolve] Step 5: Creating new state copies...')
    const newInfections = new Map(infectionsMap)
    const newAvailable = new Set(availableSet)
    const generation = (prevState && typeof prevState.generation === 'number') ? prevState.generation + 1 : 0

    console.log('[evolve] Step 6: Growth step - processing', infectionsMap.size, 'infections...')
    // Skip growth step if we have no infections or no photos
    if (infectionsMap.size === 0 || photos.length === 0) {
      console.log('[evolve]   Skipping growth - no infections or no photos')
    } else {
      // Cell death step: allow fully surrounded cells to die and respawn for optimization
      if (workerDebug.enableCellDeath && typeof workerDebug.cellDeathProbability === 'number') {
        // Apply annealing rate to base death probability
        const annealingRate = typeof workerDebug.annealingRate === 'number' && workerDebug.annealingRate > 0 
          ? workerDebug.annealingRate 
          : 1.0
        const baseDeathProb = Math.max(0, Math.min(1, workerDebug.cellDeathProbability * annealingRate))
        const mutationEnabled = !!workerDebug.enableMutation
        const baseMutationProb = mutationEnabled && typeof workerDebug.mutationProbability === 'number' 
          ? Math.max(0, Math.min(1, workerDebug.mutationProbability)) 
          : 0
        let deathCount = 0
        let mutationCount = 0
        let invaderExpulsions = 0
        
        // Calculate cluster sizes for mutation scaling
        const clusterSizes = new Map<string, number>()
        for (const [_, inf] of infectionsMap) {
          clusterSizes.set(inf.photo.id, (clusterSizes.get(inf.photo.id) || 0) + 1)
        }
        
        for (const [idx, inf] of infectionsMap) {
          const neighbors = getNeighborsCached(idx, positions, hexRadius)
          const totalNeighbors = neighbors.length
          
          // Count neighbors with the same photo (affinity)
          const samePhotoNeighbors = neighbors.filter(n => {
            const nInf = newInfections.get(n)
            return nInf && nInf.photo.id === inf.photo.id
          })
          
          // Calculate affinity ratio: 1.0 = all same photo, 0.0 = none same photo
          const affinityRatio = totalNeighbors > 0 ? samePhotoNeighbors.length / totalNeighbors : 0
          
          // Count hostile (different photo) neighbors and diversity
          const hostileNeighbors = totalNeighbors - samePhotoNeighbors.length
          const hostileRatio = totalNeighbors > 0 ? hostileNeighbors / totalNeighbors : 0
          
          // Calculate diversity: how many unique different photo types surround this cell
          const uniqueHostilePhotos = new Set<string>()
          for (const n of neighbors) {
            const nInf = newInfections.get(n)
            if (nInf && nInf.photo.id !== inf.photo.id) {
              uniqueHostilePhotos.add(nInf.photo.id)
            }
          }
          const diversityCount = uniqueHostilePhotos.size
          const maxDiversity = 6 // hex grid max neighbors
          const diversityRatio = diversityCount / maxDiversity
          
          // Affinity-adjusted death probability with boundary pressure:
          // - High affinity (well-integrated) = low death rate
          // - Low affinity (invader) = high death rate
          // - Partial hostile neighbors = MUCH higher death rate (boundary warfare)
          // - Solitary cells = VERY high death rate
          // 
          // Base formula: deathProb = baseDeathProb * (1 - affinityRatio)^2
          // Boundary pressure: if 1-5 hostile neighbors, apply exponential penalty
          let affinityPenalty = Math.pow(1 - affinityRatio, 2)
          
          // Solitary cell penalty: cells with 0-1 same neighbors are extremely vulnerable
          // Diversity amplifies this: being alone among many different photos is worst case
          if (samePhotoNeighbors.length <= 1) {
            // Base 10x penalty, increased by diversity: 2-6 different neighbors = 1.5x-3x additional multiplier
            // Formula: 10 × (1 + diversityRatio × 2)
            // 1 hostile type: 10x penalty
            // 3 hostile types (50% diversity): 20x penalty  
            // 6 hostile types (100% diversity): 30x penalty
            const diversityPenalty = 1 + diversityRatio * 2
            affinityPenalty *= (10 * diversityPenalty)
          }
          
          // Boundary warfare multiplier: cells partially surrounded by enemies are in danger
          if (hostileNeighbors > 0 && hostileNeighbors < totalNeighbors) {
            // Peak danger at 50% hostile (3/6 neighbors): apply up to 4x multiplier
            // Formula: 1 + 3 * sin(hostileRatio * π) creates a bell curve peaking at 0.5
            const boundaryPressure = 1 + 3 * Math.sin(hostileRatio * Math.PI)
            affinityPenalty *= boundaryPressure
          }
          
          const adjustedDeathProb = Math.min(1, baseDeathProb * affinityPenalty)
          
          // Calculate mutation probability based on cluster size and virility
          // Larger, more popular clusters spawn more mutations
          let mutationProb = baseMutationProb
          if (mutationEnabled && photos.length > 1) {
            const clusterSize = clusterSizes.get(inf.photo.id) || 1
            const velocity = typeof inf.photo.velocity === 'number' ? inf.photo.velocity : 0
            
            // Cluster size multiplier: larger clusters spawn more mutations (1-100 cells → 1x-10x)
            const clusterMultiplier = Math.min(10, Math.log10(clusterSize + 1) + 1)
            
            // Virility multiplier: popular photos spawn more mutations (0-100 velocity → 1x-3x)
            const virilityMultiplier = 1 + (Math.min(100, Math.max(0, velocity)) / 100) * 2
            
            // Combined mutation rate
            mutationProb = Math.min(1, baseMutationProb * clusterMultiplier * virilityMultiplier)
          }
          
          // Only consider cells with at least some neighbors (avoid isolated cells)
          if (totalNeighbors >= 1 && Math.random() < adjustedDeathProb) {
            const isInvader = affinityRatio < 0.5 // Less than half neighbors are same photo
            // Check for mutation: respawn as a different photo instead of just dying
            if (mutationEnabled && Math.random() < mutationProb && photos.length > 1) {
              // Pick a random photo from the pool that's different from current
              const otherPhotos = photos.filter(p => p.id !== inf.photo.id)
              if (otherPhotos.length > 0) {
                const newPhoto = otherPhotos[Math.floor(Math.random() * otherPhotos.length)]
                const tilesX = 4
                const tilesY = 4
                const uvBounds = calculateUvBoundsFromGridPosition(0, 0, tilesX, tilesY)
                // Mutate: replace with new photo instead of dying
                newInfections.set(idx, {
                  photo: newPhoto,
                  gridPosition: [0, 0],
                  infectionTime: currentTime,
                  generation,
                  uvBounds: uvBounds,
                  scale: 0.4,
                  growthRate: 0.08,
                  tilesX: tilesX,
                  tilesY: tilesY
                })
                mutationCount++
              } else {
                // No other photos available, just die normally
                newInfections.delete(idx)
                newAvailable.add(idx)
                deathCount++
              }
            } else {
              // Normal death: remove and make available for respawn
              newInfections.delete(idx)
              newAvailable.add(idx)
              deathCount++
              if (isInvader) invaderExpulsions++
            }
          }
        }
        if (deathCount > 0 || mutationCount > 0 || invaderExpulsions > 0) {
          console.log('[evolve]   Cell death: removed', deathCount, 'cells (', invaderExpulsions, 'invaders expelled), mutated', mutationCount, 'cells')
        }
      }
      
      // Growth step: prefer neighbors that increase contiguity and are closer to centroids
      let growthIterations = 0
      for (const [idx, inf] of infectionsMap) {
        growthIterations++
        if (growthIterations % 10 === 0) console.log('[evolve]   Growth iteration', growthIterations, '/', infectionsMap.size)
        const neighbors = getNeighborsCached(idx, positions, hexRadius)
      for (const n of neighbors) {
        if (!newAvailable.has(n)) continue
        let base = 0.5  // BOOSTED from 0.3 to encourage more aggressive growth
        const sameNeighbors = getNeighborsCached(n, positions, hexRadius).filter(x => newInfections.has(x) && newInfections.get(x)!.photo.id === inf.photo.id).length
        if (sameNeighbors >= 2) base = 0.95; else if (sameNeighbors === 1) base = 0.75  // BOOSTED to favor contiguous growth

        // Virility boost: photos with higher velocity (upvotes/engagement) grow faster
        if (workerDebug.enableVirilityBoost && typeof inf.photo.velocity === 'number' && inf.photo.velocity > 0) {
          const virilityMult = typeof workerDebug.virilityMultiplier === 'number' ? workerDebug.virilityMultiplier : 1.0
          // Normalize velocity to a 0-1 range (assuming velocity is already normalized or 0-100)
          // Then apply as a percentage boost: velocity=100 -> 100% boost (2x), velocity=50 -> 50% boost (1.5x)
          const normalizedVelocity = Math.min(1, Math.max(0, inf.photo.velocity / 100))
          const virilityBoost = 1 + (normalizedVelocity * virilityMult)
          base *= virilityBoost
        }

        // Centroid cohesion bias
        try {
          const cList = centroids.get(inf.photo.id) || []
          if (cList.length > 0) {
            const bounds = getGridBounds(positions); let minD = Infinity; const p = positions[n]
            for (const c of cList) {
              const dx = Math.abs(p[0] - c[0])
              const dy = Math.abs(p[1] - c[1])
              let effDx = dx
              let effDy = dy
              if (cache.isSpherical && bounds.width > 0 && bounds.height > 0) {
                if (effDx > bounds.width / 2) effDx = bounds.width - effDx
                if (effDy > bounds.height / 2) effDy = bounds.height - effDy
              }
              const d = Math.sqrt(effDx * effDx + effDy * effDy)
              if (d < minD) minD = d
            }
            const radius = Math.max(1, hexRadius * 3)
            const distFactor = Math.max(0, Math.min(1, 1 - (minD / radius)))
            const boost = typeof workerDebug.cohesionBoost === 'number' ? workerDebug.cohesionBoost : 0.6
            base *= (1 + distFactor * boost)
          }
        } catch (e) { if (debug) console.warn('cohesion calc failed', e) }

          if (Math.random() < Math.min(0.999, base)) {
            const tilesX = inf.tilesX || 4
            const tilesY = inf.tilesY || 4
            const uvBounds = calculateUvBoundsFromGridPosition(0, 0, tilesX, tilesY)
            newInfections.set(n, { photo: inf.photo, gridPosition: [0, 0], infectionTime: currentTime, generation, uvBounds: uvBounds, scale: 0.4, growthRate: inf.growthRate || 0.08, tilesX: tilesX, tilesY: tilesY })
            newAvailable.delete(n)
          }
        }
      }
    }

    console.log('[evolve] Step 6.5: Entropy decay - applying decay to dominant successful photos...')
    // Entropy decay: successful/dominant photos decay over time to allow new dominance to emerge
    if (workerDebug.enableEntropyDecay && newInfections.size > 0) {
      // Calculate current territory shares
      const territoryCounts = new Map<string, number>()
      const photoVelocities = new Map<string, number>()
      
      for (const [_, inf] of newInfections) {
        territoryCounts.set(inf.photo.id, (territoryCounts.get(inf.photo.id) || 0) + 1)
        if (typeof inf.photo.velocity === 'number') {
          photoVelocities.set(inf.photo.id, inf.photo.velocity)
        }
      }
      
      const totalTerritory = newInfections.size
      if (totalTerritory > 0) {
        const dominanceThreshold = typeof workerDebug.entropyDominanceThreshold === 'number' 
          ? workerDebug.entropyDominanceThreshold 
          : 0.15
        const successThreshold = typeof workerDebug.entropySuccessVelocityThreshold === 'number'
          ? workerDebug.entropySuccessVelocityThreshold
          : 50
        const baseDecayRate = typeof workerDebug.entropyDecayBaseRate === 'number'
          ? workerDebug.entropyDecayBaseRate
          : 0.02
        const timeMultiplier = typeof workerDebug.entropyTimeMultiplier === 'number'
          ? workerDebug.entropyTimeMultiplier
          : 0.1
        
        // Update dominance history and identify dominant successful photos
        const dominantSuccessfulPhotos = new Set<string>()
        
        for (const [photoId, territory] of territoryCounts) {
          const territoryShare = territory / totalTerritory
          const velocity = photoVelocities.get(photoId) || 0
          
          // Check if photo is dominant (above threshold) and successful (velocity above threshold)
          if (territoryShare >= dominanceThreshold && velocity >= successThreshold) {
            // Update dominance history: increment generations as dominant
            const generationsAsDominant = (dominanceHistory.get(photoId) || 0) + 1
            dominanceHistory.set(photoId, generationsAsDominant)
            dominantSuccessfulPhotos.add(photoId)
          } else {
            // Reset dominance history if no longer dominant or successful
            dominanceHistory.delete(photoId)
          }
        }
        
        // Apply entropy decay to cells from dominant successful photos
        let entropyDecayCount = 0
        const cellsToDecay: number[] = []
        
        for (const [idx, inf] of newInfections) {
          if (dominantSuccessfulPhotos.has(inf.photo.id)) {
            const photoId = inf.photo.id
            const territory = territoryCounts.get(photoId) || 0
            const territoryShare = territory / totalTerritory
            const velocity = photoVelocities.get(photoId) || 0
            const generationsAsDominant = dominanceHistory.get(photoId) || 0
            
            // Calculate decay probability based on:
            // 1. Territory share (dominance) - more dominant = more decay
            // 2. Velocity (success) - more successful = more decay (but only if already dominant)
            // 3. Time as dominant - longer = more decay
            
            // Normalize territory share: 0.15 (threshold) -> 0.0, 1.0 -> 1.0
            const normalizedDominance = Math.max(0, (territoryShare - dominanceThreshold) / (1 - dominanceThreshold))
            
            // Normalize velocity: 50 (threshold) -> 0.0, 100 -> 1.0
            const normalizedSuccess = Math.max(0, Math.min(1, (velocity - successThreshold) / (100 - successThreshold)))
            
            // Time multiplier: each generation as dominant adds to decay rate
            const timeFactor = 1 + (generationsAsDominant * timeMultiplier)
            
            // Combined decay probability
            // Base rate scaled by dominance, success, and time
            const decayProb = baseDecayRate * normalizedDominance * (1 + normalizedSuccess) * timeFactor
            
            // Cap at reasonable maximum (e.g., 10% per generation)
            const cappedDecayProb = Math.min(0.1, decayProb)
            
            if (Math.random() < cappedDecayProb) {
              cellsToDecay.push(idx)
            }
          }
        }
        
        // Apply decay: remove cells and make them available for new infections
        for (const idx of cellsToDecay) {
          newInfections.delete(idx)
          newAvailable.add(idx)
          entropyDecayCount++
        }
        
        if (entropyDecayCount > 0) {
          console.log('[evolve]   Entropy decay: removed', entropyDecayCount, 'cells from dominant successful photos')
        }
      }
    }

    console.log('[evolve] Step 7: Deterministic fill - processing', newAvailable.size, 'available positions...')
    // Skip deterministic fill if we have no photos or no existing infections to base decisions on
    if (photos.length === 0 || newInfections.size === 0) {
      console.log('[evolve]   Skipping deterministic fill - no photos or no infections')
    } else {
      // Deterministic fill for holes with >=2 same-photo neighbors
      let fillIterations = 0
      for (const a of Array.from(newAvailable)) {
        fillIterations++
        if (fillIterations % 50 === 0) console.log('[evolve]   Fill iteration', fillIterations, '/', newAvailable.size)
        const neighbors = getNeighborsCached(a, positions, hexRadius)
        const counts = new Map<string, number>()
        for (const n of neighbors) { const inf = newInfections.get(n); if (!inf) continue; counts.set(inf.photo.id, (counts.get(inf.photo.id) || 0) + 1) }
        let bestId: string | undefined; let best = 0
        for (const [pid, c] of counts) if (c > best) { best = c; bestId = pid }
        if (bestId && best >= 2) { 
          const src = photos.find(p => p.id === bestId) || Array.from(infectionsMap.values())[0]?.photo
          if (src) { 
            const tilesX = 4
            const tilesY = 4
            const uvBounds = calculateUvBoundsFromGridPosition(0, 0, tilesX, tilesY)
            newInfections.set(a, { photo: src, gridPosition: [0, 0], infectionTime: currentTime, generation, uvBounds: uvBounds, scale: 0.35, growthRate: 0.08, tilesX: tilesX, tilesY: tilesY })
            newAvailable.delete(a) 
          } 
        }
      }
    }

    console.log('[evolve] Step 8: Optimization merge pass...')
    // Conservative merge pass (opt-in)
    postOptimizationMerge(newInfections, positions, hexRadius, !!workerDebug.mergeLogs)

    console.log('[evolve] Step 9: Assigning cluster-aware grid positions...')
    // Make clusters self-aware by assigning grid positions based on spatial layout
    const tileCenters = assignClusterGridPositions(newInfections, positions, hexRadius)

    console.log('[evolve] Step 10: Returning result - generation', generation, 'infections', newInfections.size)
    return { infections: newInfections, availableIndices: Array.from(newAvailable), lastEvolutionTime: currentTime, generation, tileCenters }
  } catch (e) { safePostError(e); return null }
}

let lastEvolutionAt = 0

function mergeDebugFromPayload(d: any) {
  if (!d || typeof d !== 'object') return
  // Map main-thread naming (evolveIntervalMs) into worker's evolutionIntervalMs
  if (typeof d.evolveIntervalMs === 'number') d.evolutionIntervalMs = d.evolveIntervalMs
  // Merge into workerDebug
  try { Object.assign(workerDebug, d) } catch (e) {}
}

self.onmessage = function (ev: MessageEvent) {
  const raw = ev.data
  try {
    if (!raw || typeof raw !== 'object') return

    const type = raw.type
    const payload = raw.data ?? raw

    if (type === 'setDataAndConfig' || type === 'setDebug') {
      // Accept either { type:'setDataAndConfig', data: { photos, debug } } or { type:'setDebug', debug }
      const dbg = payload.debug ?? raw.debug ?? payload
      mergeDebugFromPayload(dbg)
      
      // Pre-build neighbor cache if positions are provided
      if (type === 'setDataAndConfig') {
        const incomingIsSpherical = typeof payload.isSpherical === 'boolean' ? Boolean(payload.isSpherical) : cache.isSpherical
        const shouldUpdateTopology = typeof payload.isSpherical === 'boolean' && incomingIsSpherical !== cache.isSpherical
        if (shouldUpdateTopology) invalidateCaches(incomingIsSpherical)
        else invalidateCaches()

        const positions = payload.positions
        if (!positions || !Array.isArray(positions)) return
        const hexRadius = typeof payload.hexRadius === 'number' ? payload.hexRadius : 24
        console.log('[hexgrid-worker] Pre-building neighbor cache for', positions.length, 'positions...')
        const startTime = Date.now()
        
        // Build ALL neighbor relationships in one O(n²) pass instead of n×O(n) passes
        try {
          const bounds = getGridBounds(positions)
          const threshold = Math.sqrt(3) * hexRadius * 1.15
          const isSpherical = !!cache.isSpherical
          
          // Initialize empty arrays for all positions
          for (let i = 0; i < positions.length; i++) {
            cache.neighborMap.set(i, [])
          }
          
          // Single pass: check each pair once and add bidirectional neighbors
          for (let i = 0; i < positions.length; i++) {
            const pos1 = positions[i]
            if (!pos1) continue
            
            // Only check j > i to avoid duplicate checks
            for (let j = i + 1; j < positions.length; j++) {
              const pos2 = positions[j]
              if (!pos2) continue
              
              const d = distanceBetween(pos1, pos2, bounds, isSpherical)
              if (d <= threshold) {
                // Add bidirectional neighbors
                cache.neighborMap.get(i)!.push(j)
                cache.neighborMap.get(j)!.push(i)
              }
            }
            
            // Log progress every 100 positions
            if ((i + 1) % 100 === 0) {
              console.log('[hexgrid-worker]   Processed', i + 1, '/', positions.length, 'positions')
            }
          }
          
          const elapsed = Date.now() - startTime
          console.log('[hexgrid-worker] ✅ Neighbor cache built in', elapsed, 'ms - ready for evolution!')
          // Mark cache as ready
          cache.cacheReady = true
          // Notify main thread that cache is ready
          try { self.postMessage({ type: 'cache-ready', data: { elapsed, positions: positions.length } }) } catch (e) {}
        } catch (e) {
          console.error('[hexgrid-worker] Error during cache pre-build:', e)
          // Mark cache as ready anyway to allow evolution to proceed
          cache.cacheReady = true
        }
      }
      
      return
    }

    if (type === 'evolve') {
      // Check if neighbor cache is ready before processing evolve
      if (!cache.cacheReady) {
        console.log('[hexgrid-worker] ⏸️ Evolve message received but cache not ready yet - deferring...')
        // Defer this evolve message by re-posting it after a short delay
        setTimeout(() => {
          try { self.postMessage({ type: 'deferred-evolve', data: { reason: 'cache-not-ready' } }) } catch (e) {}
          // Re-process the message
          self.onmessage!(ev)
        }, 100)
        return
      }
      
      // Normalize payload shape: support { data: { prevState, positions, photos, hexRadius, debug } }
      mergeDebugFromPayload(payload.debug || payload);
      // Diagnostic: log that an evolve was received and the available payload keys (only when debugLogs enabled)
      try {
        if (workerDebug && workerDebug.debugLogs) {
          console.log('[hexgrid-worker] evolve received, payload keys=', Object.keys(payload || {}), 'workerDebug.evolutionIntervalMs=', workerDebug.evolutionIntervalMs, 'workerDebug.evolveIntervalMs=', workerDebug.evolveIntervalMs)
        }
      } catch (e) {}
      const now = Date.now();
      const interval = typeof workerDebug.evolutionIntervalMs === 'number' ? workerDebug.evolutionIntervalMs : (typeof workerDebug.evolveIntervalMs === 'number' ? workerDebug.evolveIntervalMs : 60000);
      console.log('[hexgrid-worker] Throttle check: interval=', interval, 'lastEvolutionAt=', lastEvolutionAt, 'now=', now, 'diff=', now - lastEvolutionAt, 'willThrottle=', (now - lastEvolutionAt < interval))
      // Throttle: if we're within the interval, notify (debug) and skip processing
  const reason = payload.reason || (raw && raw.reason)
  const bypassThrottle = reason === 'photos-init' || reason === 'reset'
  // Clear, high-signal log for build verification: reports whether the current evolve will bypass the worker throttle
  console.log('[hexgrid-worker] THROTTLE DECISION', { interval, lastEvolutionAt, now, diff: now - lastEvolutionAt, willThrottle: (!bypassThrottle && (now - lastEvolutionAt < interval)), reason, bypassThrottle })
        // Throttle: if we're within the interval and not bypassed, notify (debug) and skip processing
        if (!bypassThrottle && now - lastEvolutionAt < interval) {
          console.log('[hexgrid-worker] ⛔ THROTTLED - skipping evolution processing')
          if (workerDebug && workerDebug.debugLogs) {
            try { self.postMessage({ type: 'throttled-evolve', data: { receivedAt: now, nextAvailableAt: lastEvolutionAt + interval, payloadKeys: Object.keys(payload || {}), reason } }) } catch (e) {}
          }
          return
        }
      // Mark processed time and send ack for an evolve we will process
      lastEvolutionAt = now
      console.log('[hexgrid-worker] ✅ PROCESSING evolution - lastEvolutionAt updated to', now)
      try {
        if (workerDebug && workerDebug.debugLogs) {
          try { self.postMessage({ type: 'ack-evolve', data: { receivedAt: now, payloadKeys: Object.keys(payload || {}) } }) } catch (e) {}
        }
      } catch (e) {}

      // Emit a lightweight processing marker so the client can see evolve processing started
      try {
        if (workerDebug && workerDebug.debugLogs) {
          try { self.postMessage({ type: 'processing-evolve', data: { startedAt: now, payloadKeys: Object.keys(payload || {}) } }) } catch (e) {}
        }
      } catch (e) {}

      const state = payload.prevState ?? payload.state ?? raw.state ?? null
      const positions = payload.positions ?? raw.positions ?? []
      const photos = payload.photos ?? raw.photos ?? []
      const hexRadius = typeof payload.hexRadius === 'number' ? payload.hexRadius : (typeof raw.hexRadius === 'number' ? raw.hexRadius : 16)

      if (typeof payload.isSpherical === 'boolean' && Boolean(payload.isSpherical) !== cache.isSpherical) {
        invalidateCaches(Boolean(payload.isSpherical))
      }

      console.log('[hexgrid-worker] 🔧 About to call evolveInfectionSystem')
      console.log('[hexgrid-worker]   - state generation:', state?.generation)
      console.log('[hexgrid-worker]   - state infections:', state?.infections?.length || state?.infections?.size || 0)
      console.log('[hexgrid-worker]   - positions:', positions?.length || 0)
      console.log('[hexgrid-worker]   - photos:', photos?.length || 0)
      console.log('[hexgrid-worker]   - hexRadius:', hexRadius)
      
      let res
      let timeoutId
      let timedOut = false
      
      // Set a watchdog timer to detect hangs (10 seconds)
      timeoutId = setTimeout(() => {
        timedOut = true
        console.error('[hexgrid-worker] ⏱️ TIMEOUT: evolveInfectionSystem is taking too long (>10s)! Possible infinite loop.')
        try { self.postMessage({ type: 'error', error: 'Evolution timeout - possible infinite loop' }) } catch (e) {}
      }, 10000)
      
      try {
        console.log('[hexgrid-worker] 🚀 Calling evolveInfectionSystem NOW...')
        const startTime = Date.now()
        res = evolveInfectionSystem(state, positions, photos, hexRadius, now, !!workerDebug.debugLogs)
        const elapsed = Date.now() - startTime
        clearTimeout(timeoutId)
        console.log('[hexgrid-worker] ✅ evolveInfectionSystem RETURNED successfully in', elapsed, 'ms')
      } catch (err) {
        clearTimeout(timeoutId)
        console.error('[hexgrid-worker] ❌ FATAL: evolveInfectionSystem threw an error:', err)
        console.error('[hexgrid-worker] Error stack:', err instanceof Error ? err.stack : 'no stack')
        safePostError(err)
        return
      }
      
      if (timedOut) {
        console.error('[hexgrid-worker] ⏱️ Function eventually returned but after timeout was triggered')
      }
      
      if (!res) {
        console.log('[hexgrid-worker] ❌ evolveInfectionSystem returned null!')
        return
      }
      console.log('[hexgrid-worker] ✅ Evolution complete! New generation=', res.generation, 'infections=', res.infections.size)
      try {
        const payload: any = { infections: Array.from(res.infections.entries()), availableIndices: res.availableIndices, lastEvolutionTime: res.lastEvolutionTime, generation: res.generation }
        if (res.tileCenters && res.tileCenters.length > 0) {
          payload.tileCenters = res.tileCenters
          console.log('[hexgrid-worker] Including', res.tileCenters.length, 'tile center sets in evolved message')
        }
        self.postMessage({ type: 'evolved', data: payload })
        // Record posted generation/infection count so later auto-triggers can avoid regressing
        try { cache.lastGeneration = res.generation; cache.lastInfectionCount = res.infections ? res.infections.size : 0 } catch (e) {}
      } catch (e) {
        console.error('[hexgrid-worker] ❌ Failed to post evolved message:', e)
      }
      console.log('[hexgrid-worker] 📤 Posted evolved message back to main thread')

      // Emit a completion marker so the client can confirm the evolve finished end-to-end
      try {
        if (workerDebug && workerDebug.debugLogs) {
          try { self.postMessage({ type: 'evolved-complete', data: { finishedAt: Date.now(), generation: res.generation, lastEvolutionTime: res.lastEvolutionTime } }) } catch (e) {}
        }
      } catch (e) {}
      return
    }

    if (type === 'optimize') {
      try {
        const infectionsArr = payload.infections || raw.infections || []
        const infections = new Map<number, Infection>(infectionsArr)
        const positions = payload.positions ?? raw.positions
        const hexRadius = typeof payload.hexRadius === 'number' ? payload.hexRadius : (typeof raw.hexRadius === 'number' ? raw.hexRadius : 16)
        postOptimizationMerge(infections, positions, hexRadius, !!workerDebug.mergeLogs)
        try { self.postMessage({ type: 'optimized', data: { infections: Array.from(infections.entries()) } }) } catch (e) {}
      } catch (e) { safePostError(e) }
      return
    }
  } catch (err) { safePostError(err) }
}

// Additional helpers that the optimizer uses (kept separate and consistent)

function calculatePhotoContiguityCached(
  photoIdOrPhoto: string | Photo,
  indices: number[],
  positions: [number, number, number][],
  hexRadius: number,
  debugLogs: boolean = true
): number {
  const photoId = typeof photoIdOrPhoto === 'string' ? photoIdOrPhoto : (photoIdOrPhoto as Photo).id
  return calculatePhotoContiguity(photoId, indices, positions, hexRadius, debugLogs)
}

function calculatePhotoContiguity(
  photoId: string,
  indices: number[],
  positions: [number, number, number][],
  hexRadius: number,
  debugLogs: boolean = true
): number {
  const getNeighbors = (index: number) => getNeighborsCached(index, positions, hexRadius)
  return _calculatePhotoContiguity(indices, positions, hexRadius, getNeighbors)
}

function calculateSwappedContiguityCached(
  photoId: string,
  indices: number[],
  positions: [number, number, number][],
  hexRadius: number,
  fromIndex: number,
  toIndex: number,
  infections: Map<number, Infection>,
  debugLogs: boolean = true
): number {
  const tempIndices = [...indices]
  const fromPos = tempIndices.indexOf(fromIndex)
  const toPos = tempIndices.indexOf(toIndex)
  if (fromPos !== -1) tempIndices[fromPos] = toIndex
  if (toPos !== -1) tempIndices[toPos] = fromIndex
  return calculatePhotoContiguity(photoId, tempIndices, positions, hexRadius, debugLogs)
}

function analyzeLocalEnvironment(
  centerIndex: number,
  infections: Map<number, Infection>,
  positions: [number, number, number][],
  hexRadius: number,
  radius: number = 2,
  debugLogs: boolean = true
) {
  const centerPos = positions[centerIndex]
  const localIndices: number[] = []
  const visited = new Set<number>()
  const queue: Array<[number, number]> = [[centerIndex, 0]]

  while (queue.length > 0) {
    const [currentIndex, distance] = queue.shift()!
    if (visited.has(currentIndex) || distance > radius) continue
    visited.add(currentIndex)
    localIndices.push(currentIndex)
    if (distance < radius) {
      const neighbors = getNeighborsCached(currentIndex, positions, hexRadius)
      for (const neighborIndex of neighbors) {
        if (!visited.has(neighborIndex)) queue.push([neighborIndex, distance + 1])
      }
    }
  }

  let infectedCount = 0
  const photoCounts = new Map<string, number>()
  const clusterSizes = new Map<string, number>()
  let boundaryPressure = 0
  let totalVariance = 0

  for (const index of localIndices) {
    const infection = infections.get(index)
    if (infection) {
      infectedCount++
      const photoId = infection.photo.id
      photoCounts.set(photoId, (photoCounts.get(photoId) || 0) + 1)
      clusterSizes.set(photoId, (clusterSizes.get(photoId) || 0) + 1)
    } else {
      boundaryPressure += 0.1
    }
  }

  const totalPhotos = photoCounts.size
  const avgPhotoCount = infectedCount / Math.max(totalPhotos, 1)
  for (const count of photoCounts.values()) totalVariance += Math.pow(count - avgPhotoCount, 2)
  const localVariance = totalVariance / Math.max(infectedCount, 1)

  let dominantPhoto: Photo | null = null
  let maxCount = 0
  for (const [photoId, count] of photoCounts) {
    if (count > maxCount) {
      maxCount = count
      for (const infection of infections.values()) {
        if (infection.photo.id === photoId) { dominantPhoto = infection.photo; break }
      }
    }
  }

  const density = infectedCount / Math.max(localIndices.length, 1)
  const stability = dominantPhoto ? (maxCount / Math.max(infectedCount, 1)) : 0

  return { density, stability, dominantPhoto, clusterSizes, boundaryPressure, localVariance }
}

function invalidateCaches(isSpherical?: boolean) {
  cache.neighborMap.clear()
  cache.gridBounds = null
  cache.photoClusters.clear()
  cache.connectedComponents.clear()
  cache.gridPositions.clear()
  cache.cacheReady = false
  if (typeof isSpherical === 'boolean') cache.isSpherical = isSpherical
}

console.log('[hexgrid-worker] ready')