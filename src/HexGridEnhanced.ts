/**
 * HexGrid Enhanced Integration
 * 
 * This module provides enhanced hexgrid capabilities by integrating:
 * - Advanced vector/matrix/quaternion mathematics
 * - Axial/cubic hex coordinate systems
 * - Spatial indexing for O(log n) queries
 * - Graph algorithms (clustering, pathfinding)
 * - Flow field visualization
 * - Particle effects system
 * - Fluid dynamics simulation
 * - WASM acceleration (with fallback)
 * - Advanced statistical analysis
 * 
 * @module HexGridEnhanced
 */

import { Vector2, Vector3 } from './math/Vector3'
import { Quaternion } from './math/Quaternion'
import { Axial, Cube, GeodesicHexGrid } from './math/HexCoordinates'
import { KDTree, SpatialHashGrid, ToroidalSpatialHash } from './math/SpatialIndex'
import {
  kMeansClustering,
  dbscan,
  findConnectedComponents,
  dijkstra,
  aStar,
  louvainCommunities,
  computeVoronoi,
  analyzeTerritorBoundaries
} from './algorithms/GraphAlgorithms'
import { FlowField2D, InfectionFlowAnalyzer, HeatMap } from './algorithms/FlowField'
import { ParticleSystem, ParticleEffectManager, ParticlePresets } from './algorithms/ParticleSystem'
import { StableFluids, LatticeBoltzmann, InfectionFluidSimulator } from './algorithms/FluidSimulation'
import {
  computeTerritoryStats,
  sparkline,
  sparklineSvg,
  predictWinner,
  detectChangePoints
} from './algorithms/AdvancedStatistics'
import {
  generateProbabilitySnapshot,
  bayesianWinProbability,
  bayesianConquestRate,
  MarkovChain,
  KalmanFilter,
  type ProbabilitySnapshot
} from './algorithms/BayesianStatistics'
import { generateSnapshot, formatSnapshotAsText, exportSnapshotAsJSON, type GameSnapshot, type PlayerSnapshot } from './Snapshot'
import { HexGridWasmWrapper, FlowFieldWasmWrapper } from './wasm/HexGridWasmWrapper'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface EnhancedHexCell {
  index: number
  axial: Axial
  position: Vector2
  owner: number
  population: number
  infection: number
  infectedBy: number
}

export interface EnhancedHexGridConfig {
  width: number
  height: number
  hexSize: number
  useWasm?: boolean
  enableParticles?: boolean
  enableFluid?: boolean
  enableFlowField?: boolean
  spatialIndexType?: 'kdtree' | 'hash' | 'toroidal'
}

export interface TerritoryEvent {
  type: 'conquest' | 'birth' | 'death' | 'infection'
  cellIndex: number
  fromOwner: number
  toOwner: number
  timestamp: number
}

// ═══════════════════════════════════════════════════════════════════════════
// ENHANCED HEXGRID ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Enhanced HexGrid engine with all advanced features
 */
export class EnhancedHexGridEngine {
  private config: Required<EnhancedHexGridConfig>
  private cells: EnhancedHexCell[] = []
  private spatialIndex: KDTree<EnhancedHexCell> | SpatialHashGrid<EnhancedHexCell> | ToroidalSpatialHash<EnhancedHexCell> | null = null
  private wasmGrid: HexGridWasmWrapper | null = null
  private particleManager: ParticleEffectManager | null = null
  private flowAnalyzer: InfectionFlowAnalyzer | null = null
  private fluidSim: StableFluids | null = null
  private heatMap: HeatMap | null = null
  
  // History for statistics
  private territoryHistory: Map<number, number[]> = new Map()
  private eventHistory: TerritoryEvent[] = []
  
  // Callbacks
  private onConquest?: (event: TerritoryEvent) => void
  private onStatsUpdate?: (stats: ReturnType<typeof computeTerritoryStats>) => void

  private constructor(config: Required<EnhancedHexGridConfig>) {
    this.config = config
  }

  /**
   * Create a new enhanced hexgrid engine
   */
  static async create(config: EnhancedHexGridConfig): Promise<EnhancedHexGridEngine> {
    const fullConfig: Required<EnhancedHexGridConfig> = {
      width: config.width,
      height: config.height,
      hexSize: config.hexSize,
      useWasm: config.useWasm ?? true,
      enableParticles: config.enableParticles ?? true,
      enableFluid: config.enableFluid ?? false,
      enableFlowField: config.enableFlowField ?? true,
      spatialIndexType: config.spatialIndexType ?? 'hash'
    }

    const engine = new EnhancedHexGridEngine(fullConfig)
    await engine.initialize()
    return engine
  }

  private async initialize(): Promise<void> {
    const { width, height, hexSize } = this.config

    // Initialize cells
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x
        const axial = Axial.fromOffset(x, y)
        const [px, py] = axial.toPixel(hexSize)

        this.cells.push({
          index,
          axial,
          position: new Vector2(px, py),
          owner: 0,
          population: 0,
          infection: 0,
          infectedBy: 0
        })
      }
    }

    // Initialize spatial index
    this.initializeSpatialIndex()

    // Initialize WASM if available
    if (this.config.useWasm) {
      try {
        this.wasmGrid = await HexGridWasmWrapper.create(width, height)
        console.log('[EnhancedHexGrid] WASM acceleration:', this.wasmGrid.isUsingWasm() ? 'enabled' : 'fallback')
      } catch (e) {
        console.warn('[EnhancedHexGrid] WASM initialization failed, using JS fallback')
      }
    }

    // Initialize particle system
    if (this.config.enableParticles) {
      this.particleManager = new ParticleEffectManager({
        maxParticles: 5000,
        gravity: new Vector2(0, 50)
      })
    }

    // Initialize flow field analyzer
    if (this.config.enableFlowField) {
      this.flowAnalyzer = new InfectionFlowAnalyzer(width, height)
    }

    // Initialize fluid simulation
    if (this.config.enableFluid) {
      this.fluidSim = new StableFluids({
        width,
        height,
        viscosity: 0.001,
        diffusion: 0.0005
      })
    }

    // Initialize heat map
    this.heatMap = new HeatMap(width, height)
  }

  private initializeSpatialIndex(): void {
    const points: Array<{ x: number; y: number; data: number }> = this.cells.map(cell => ({
      x: cell.position.x,
      y: cell.position.y,
      data: cell.index
    }))

    switch (this.config.spatialIndexType) {
      case 'kdtree':
        this.spatialIndex = KDTree.build(points)
        break
      case 'toroidal':
        this.spatialIndex = new ToroidalSpatialHash(
          this.config.hexSize * 2,
          this.config.width * this.config.hexSize,
          this.config.height * this.config.hexSize
        )
        for (const cell of this.cells) {
          (this.spatialIndex as ToroidalSpatialHash).insert(
            cell.position.x,
            cell.position.y,
            cell.index
          )
        }
        break
      default: // 'hash'
        this.spatialIndex = new SpatialHashGrid(this.config.hexSize * 2)
        for (const cell of this.cells) {
          (this.spatialIndex as SpatialHashGrid).insert(
            cell.position.x,
            cell.position.y,
            cell.index
          )
        }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CELL ACCESS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get cell at index
   */
  getCell(index: number): EnhancedHexCell | undefined {
    return this.cells[index]
  }

  /**
   * Get cell at axial coordinates
   */
  getCellAt(q: number, r: number): EnhancedHexCell | undefined {
    const [x, y] = Axial.fromQR(q, r).toOffset()
    if (x < 0 || x >= this.config.width || y < 0 || y >= this.config.height) {
      return undefined
    }
    return this.cells[y * this.config.width + x]
  }

  /**
   * Get neighbors of a cell
   */
  getNeighbors(cellIndex: number): EnhancedHexCell[] {
    const cell = this.cells[cellIndex]
    if (!cell) return []

    const neighborAxials = cell.axial.neighbors()
    const neighbors: EnhancedHexCell[] = []

    for (const axial of neighborAxials) {
      const [x, y] = axial.toOffset()
      if (x >= 0 && x < this.config.width && y >= 0 && y < this.config.height) {
        neighbors.push(this.cells[y * this.config.width + x])
      }
    }

    return neighbors
  }

  /**
   * Find cells in radius using spatial index
   */
  findCellsInRadius(x: number, y: number, radius: number): EnhancedHexCell[] {
    if (!this.spatialIndex) return []

    const indices = this.spatialIndex instanceof KDTree
      ? (this.spatialIndex as KDTree).rangeQuery({ x, y }, radius)
      : (this.spatialIndex as SpatialHashGrid | ToroidalSpatialHash).query(x, y, radius)

    return indices.map(i => this.cells[i]).filter(Boolean)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TERRITORY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set cell owner
   */
  setOwner(cellIndex: number, owner: number): void {
    const cell = this.cells[cellIndex]
    if (!cell) return

    const oldOwner = cell.owner
    if (oldOwner === owner) return

    cell.owner = owner
    
    // Update WASM if available
    if (this.wasmGrid) {
      this.wasmGrid.setOwner(cellIndex, owner)
    }

    // Record event
    const event: TerritoryEvent = {
      type: oldOwner === 0 ? 'birth' : 'conquest',
      cellIndex,
      fromOwner: oldOwner,
      toOwner: owner,
      timestamp: Date.now()
    }
    this.eventHistory.push(event)

    // Trigger effects
    if (this.particleManager && owner !== 0) {
      const pos = cell.position
      if (oldOwner === 0) {
        // Birth effect
        this.particleManager.triggerEffect('birth', pos, {
          count: 10,
          color: this.ownerToColor(owner)
        })
      } else {
        // Conquest effect
        this.particleManager.triggerEffect('conquest', pos, {
          count: 20,
          color: this.ownerToColor(owner)
        })
      }
    }

    // Update flow field
    if (this.flowAnalyzer && oldOwner !== 0) {
      this.flowAnalyzer.update(
        oldOwner,
        owner,
        cell.position.x,
        cell.position.y,
        1 / 60
      )
    }

    // Notify callback
    if (this.onConquest) {
      this.onConquest(event)
    }
  }

  /**
   * Convert owner ID to RGB color
   */
  private ownerToColor(owner: number): [number, number, number] {
    // Generate distinct color from owner ID
    const hue = (owner * 137.508) % 360
    const s = 0.7
    const l = 0.5

    // HSL to RGB
    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs((hue / 60) % 2 - 1))
    const m = l - c / 2

    let r = 0, g = 0, b = 0
    if (hue < 60) { r = c; g = x; b = 0 }
    else if (hue < 120) { r = x; g = c; b = 0 }
    else if (hue < 180) { r = 0; g = c; b = x }
    else if (hue < 240) { r = 0; g = x; b = c }
    else if (hue < 300) { r = x; g = 0; b = c }
    else { r = c; g = 0; b = x }

    return [r + m, g + m, b + m]
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SIMULATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Step the infection simulation
   */
  stepInfection(infectionRate: number = 0.1, threshold: number = 1.0): number[] {
    // Use WASM if available
    if (this.wasmGrid) {
      const changed = this.wasmGrid.stepInfection(infectionRate, threshold)
      
      // Sync back to JS cells
      for (const index of changed) {
        const cell = this.cells[index]
        if (cell) {
          cell.owner = this.wasmGrid.getOwner(index)
        }
      }
      
      return changed
    }

    // Fallback JS implementation
    const changed: number[] = []
    
    // Phase 1: Spread infection
    for (const cell of this.cells) {
      if (cell.owner === 0) continue

      for (const neighbor of this.getNeighbors(cell.index)) {
        if (neighbor.owner !== cell.owner && cell.population > 0) {
          const power = cell.population * infectionRate
          const resistance = Math.max(0.1, neighbor.population)
          
          if (neighbor.infectedBy === 0 || neighbor.infectedBy === cell.owner) {
            neighbor.infectedBy = cell.owner
            neighbor.infection += power / resistance
          }
        }
      }
    }

    // Phase 2: Convert infected cells
    for (const cell of this.cells) {
      if (cell.infection >= threshold && cell.infectedBy !== 0) {
        this.setOwner(cell.index, cell.infectedBy)
        cell.infection = 0
        cell.infectedBy = 0
        cell.population = 1
        changed.push(cell.index)
      }
    }

    return changed
  }

  /**
   * Update all systems
   */
  update(dt: number): void {
    // Update particles
    if (this.particleManager) {
      this.particleManager.update(dt)
    }

    // Update fluid
    if (this.fluidSim) {
      this.fluidSim.step(dt)
    }

    // Update territory history
    this.updateTerritoryHistory()
  }

  private updateTerritoryHistory(): void {
    const counts = this.getTerritoryCounts()
    
    for (const [owner, count] of counts) {
      if (!this.territoryHistory.has(owner)) {
        this.territoryHistory.set(owner, [])
      }
      const history = this.territoryHistory.get(owner)!
      history.push(count)
      
      // Keep last 1000 entries
      if (history.length > 1000) {
        history.shift()
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ALGORITHMS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get territory counts per owner
   */
  getTerritoryCounts(): Map<number, number> {
    if (this.wasmGrid) {
      return this.wasmGrid.getTerritoryCounts()
    }

    const counts = new Map<number, number>()
    for (const cell of this.cells) {
      if (cell.owner !== 0) {
        counts.set(cell.owner, (counts.get(cell.owner) ?? 0) + 1)
      }
    }
    return counts
  }

  /**
   * Find connected regions for an owner
   */
  findConnectedRegions(owner: number): number[][] {
    if (this.wasmGrid) {
      const regionIds = this.wasmGrid.findConnectedRegions(owner)
      const regions = new Map<number, number[]>()
      
      for (let i = 0; i < regionIds.length; i++) {
        const regionId = regionIds[i]
        if (regionId === 0) continue
        
        if (!regions.has(regionId)) {
          regions.set(regionId, [])
        }
        regions.get(regionId)!.push(i)
      }
      
      return Array.from(regions.values())
    }

    // Fallback
    const nodeToOwner = new Map<number, number>()
    for (const cell of this.cells) {
      if (cell.owner === owner) {
        nodeToOwner.set(cell.index, owner)
      }
    }

    const neighbors = (node: number) => {
      return this.getNeighbors(node)
        .filter(n => n.owner === owner)
        .map(n => n.index)
    }

    return findConnectedComponents(nodeToOwner, neighbors)
  }

  /**
   * Find border cells for an owner
   */
  findBorderCells(owner: number): number[] {
    if (this.wasmGrid) {
      return this.wasmGrid.findBorderCells(owner)
    }

    return this.cells
      .filter(cell => {
        if (cell.owner !== owner) return false
        return this.getNeighbors(cell.index).some(n => n.owner !== owner)
      })
      .map(cell => cell.index)
  }

  /**
   * Find path between two cells
   */
  findPath(start: number, end: number, ownerFilter: number = 0): number[] {
    if (this.wasmGrid) {
      return this.wasmGrid.findPath(start, end, ownerFilter)
    }

    const neighbors = (node: number): Array<[number, number]> => {
      return this.getNeighbors(node)
        .filter(n => ownerFilter === 0 || n.owner === ownerFilter)
        .map(n => [n.index, 1])
    }

    const heuristic = (a: number, b: number): number => {
      const cellA = this.cells[a]
      const cellB = this.cells[b]
      if (!cellA || !cellB) return Infinity
      return cellA.axial.distanceTo(cellB.axial)
    }

    return aStar(start, end, neighbors, heuristic)
  }

  /**
   * K-means clustering
   */
  clusterCells(k: number): Map<number, number> {
    if (this.wasmGrid) {
      const assignments = this.wasmGrid.kmeansCluster(k)
      const result = new Map<number, number>()
      for (let i = 0; i < assignments.length; i++) {
        result.set(i, assignments[i])
      }
      return result
    }

    const points = this.cells
      .filter(c => c.owner !== 0)
      .map(c => [c.position.x, c.position.y])

    const { assignments } = kMeansClustering(points, k)
    const result = new Map<number, number>()
    
    let pointIndex = 0
    for (const cell of this.cells) {
      if (cell.owner !== 0) {
        result.set(cell.index, assignments[pointIndex])
        pointIndex++
      }
    }

    return result
  }

  /**
   * Community detection using Louvain algorithm
   */
  detectCommunities(): Map<number, number> {
    const neighbors = (node: number): Array<[number, number]> => {
      return this.getNeighbors(node)
        .filter(n => n.owner !== 0)
        .map(n => [n.index, 1])
    }

    const nodes = this.cells
      .filter(c => c.owner !== 0)
      .map(c => c.index)

    return louvainCommunities(nodes, neighbors)
  }

  /**
   * Analyze territory boundaries
   */
  analyzeBoundaries(): ReturnType<typeof analyzeTerritoryBoundaries> {
    const owners = new Map<number, number>()
    for (const cell of this.cells) {
      owners.set(cell.index, cell.owner)
    }

    const getNeighborsFn = (node: number) => 
      this.getNeighbors(node).map(n => n.index)

    return analyzeTerritoryBoundaries(owners, getNeighborsFn)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get comprehensive statistics
   */
  getStatistics(): ReturnType<typeof computeTerritoryStats> {
    const counts = this.getTerritoryCounts()
    return computeTerritoryStats(counts, this.territoryHistory)
  }

  /**
   * Get Gini coefficient
   */
  getGini(): number {
    if (this.wasmGrid) {
      return this.wasmGrid.computeGini()
    }
    return this.getStatistics().gini
  }

  /**
   * Get entropy
   */
  getEntropy(): number {
    if (this.wasmGrid) {
      return this.wasmGrid.computeEntropy()
    }
    return this.getStatistics().shannonEntropy
  }

  /**
   * Predict winner
   */
  predictWinner(): {
    winner: number | null
    confidence: number
    probabilities: Map<number, number>
  } {
    const prediction = predictWinner(this.territoryHistory)
    return {
      winner: prediction.winner,
      confidence: prediction.confidence,
      probabilities: prediction.winProbabilities
    }
  }

  /**
   * Get sparkline for a player
   */
  getSparkline(owner: number, width: number = 20): string {
    const history = this.territoryHistory.get(owner)
    if (!history) return ''
    return sparkline(history, width)
  }

  /**
   * Get sparkline SVG path
   */
  getSparklineSvg(owner: number, width: number = 100, height: number = 30): string {
    const history = this.territoryHistory.get(owner)
    if (!history) return ''
    return sparklineSvg(history, width, height)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VISUALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get flow field data
   */
  getFlowFieldData(): { velocities: Float32Array; divergence: Float32Array; curl: Float32Array } | null {
    if (!this.flowAnalyzer) return null
    return this.flowAnalyzer.getFlowData()
  }

  /**
   * Get particle positions for rendering
   */
  getParticlePositions(): Array<{ x: number; y: number; size: number; color: string; alpha: number }> {
    if (!this.particleManager) return []
    
    const system = this.particleManager.getSystem('default')
    return system?.getPositions() ?? []
  }

  /**
   * Render particles to canvas
   */
  renderParticles(ctx: CanvasRenderingContext2D): void {
    if (this.particleManager) {
      this.particleManager.render(ctx)
    }
  }

  /**
   * Render flow field to canvas
   */
  renderFlowField(ctx: CanvasRenderingContext2D): void {
    if (!this.flowAnalyzer) return
    
    const data = this.flowAnalyzer.getFlowData()
    if (!data) return

    const { width, height } = this.config
    const cellW = ctx.canvas.width / width
    const cellH = ctx.canvas.height / height

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.lineWidth = 1

    for (let y = 0; y < height; y += 4) {
      for (let x = 0; x < width; x += 4) {
        const idx = y * width + x
        const vx = data.velocities[idx * 2]
        const vy = data.velocities[idx * 2 + 1]
        
        const cx = (x + 0.5) * cellW
        const cy = (y + 0.5) * cellH
        
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + vx * 10, cy + vy * 10)
        ctx.stroke()
      }
    }
  }

  /**
   * Render fluid to canvas
   */
  renderFluid(ctx: CanvasRenderingContext2D): void {
    if (this.fluidSim) {
      this.fluidSim.render(ctx, { colorMode: 'color' })
    }
  }

  /**
   * Trigger a particle effect
   */
  triggerEffect(
    type: 'victory' | 'conquest' | 'death' | 'birth' | 'sparkle',
    x: number,
    y: number,
    options?: { count?: number; color?: [number, number, number] }
  ): void {
    if (this.particleManager) {
      this.particleManager.triggerEffect(type, new Vector2(x, y), options)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Clear all state
   */
  clear(): void {
    for (const cell of this.cells) {
      cell.owner = 0
      cell.population = 0
      cell.infection = 0
      cell.infectedBy = 0
    }

    if (this.wasmGrid) {
      this.wasmGrid.clear()
    }

    if (this.particleManager) {
      this.particleManager.clearAll()
    }

    if (this.fluidSim) {
      this.fluidSim.clear()
    }

    this.territoryHistory.clear()
    this.eventHistory = []
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.wasmGrid) {
      this.wasmGrid.dispose()
    }
    this.clear()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set conquest callback
   */
  setOnConquest(callback: (event: TerritoryEvent) => void): void {
    this.onConquest = callback
  }

  /**
   * Set stats update callback
   */
  setOnStatsUpdate(callback: (stats: ReturnType<typeof computeTerritoryStats>) => void): void {
    this.onStatsUpdate = callback
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIFIED SNAPSHOT API
  // ═══════════════════════════════════════════════════════════════════════════

  // Track conquest events for Bayesian analysis
  private conquestCounts: Map<number, { successes: number; opportunities: number }> = new Map()

  /**
   * Record a conquest attempt (for Bayesian conquest rate estimation)
   */
  recordConquestAttempt(player: number, success: boolean): void {
    if (!this.conquestCounts.has(player)) {
      this.conquestCounts.set(player, { successes: 0, opportunities: 0 })
    }
    const counts = this.conquestCounts.get(player)!
    counts.opportunities++
    if (success) counts.successes++
  }

  /**
   * Get a comprehensive snapshot of ALL game statistics in one call
   * 
   * This is the primary API for getting complete game state analysis.
   * Returns everything: statistics, predictions, topology, Bayesian analysis.
   * 
   * @example
   * ```typescript
   * const snapshot = engine.snapshot()
   * 
   * console.log(snapshot.predictions.likelyWinner)
   * console.log(snapshot.indices.dominance)
   * console.log(snapshot.players[0].winProbability)
   * console.log(snapshot.insights)
   * ```
   */
  snapshot(config: {
    forecastHorizon?: number
    monteCarloSamples?: number
    includeFullHistory?: boolean
    calculateTopology?: boolean
    generateInsights?: boolean
  } = {}): GameSnapshot {
    const cells = this.cells.map(c => ({
      owner: c.owner,
      population: c.population
    }))

    const getNeighbors = (cellIndex: number): number[] => {
      return this.getNeighbors(cellIndex).map(n => n.index)
    }

    return generateSnapshot(
      cells,
      this.territoryHistory,
      this.conquestCounts,
      getNeighbors,
      config
    )
  }

  /**
   * Get snapshot formatted as human-readable text
   */
  snapshotText(config?: Parameters<typeof this.snapshot>[0]): string {
    return formatSnapshotAsText(this.snapshot(config))
  }

  /**
   * Get snapshot as JSON string
   */
  snapshotJSON(config?: Parameters<typeof this.snapshot>[0]): string {
    return exportSnapshotAsJSON(this.snapshot(config))
  }

  /**
   * Get Bayesian probability analysis only
   */
  getProbabilitySnapshot(samples: number = 1000): ProbabilitySnapshot {
    return generateProbabilitySnapshot(
      this.territoryHistory,
      this.conquestCounts,
      { forecastSteps: 10, samples }
    )
  }

  /**
   * Get Bayesian win probabilities for all players
   */
  getBayesianWinProbabilities(samples: number = 1000): Map<number, { probability: number; credibleInterval: [number, number] }> {
    return bayesianWinProbability(this.territoryHistory, samples)
  }

  /**
   * Get Bayesian conquest rate estimate for a player
   */
  getConquestRate(player: number): {
    rate: number
    credibleInterval: [number, number]
    probabilityAbove: (threshold: number) => number
  } {
    const counts = this.conquestCounts.get(player) ?? { successes: 0, opportunities: 1 }
    const result = bayesianConquestRate(counts.successes, counts.opportunities)
    return {
      rate: result.pointEstimate,
      credibleInterval: result.credibleInterval,
      probabilityAbove: result.probabilityAbove
    }
  }

  /**
   * Learn and get Markov chain from territory transitions
   */
  getMarkovAnalysis(): {
    chain: MarkovChain
    stationaryDistribution: number[]
    predictNext: (steps: number) => number[][]
  } {
    const players = Array.from(this.territoryHistory.keys())
    const chain = new MarkovChain(players.length)

    // Build transition matrix from history
    const histories = Array.from(this.territoryHistory.values())
    const minLen = Math.min(...histories.map(h => h.length))

    for (let t = 1; t < minLen; t++) {
      for (let i = 0; i < players.length; i++) {
        for (let j = 0; j < players.length; j++) {
          const histI = histories[i]
          const histJ = histories[j]
          
          // j gained at expense of i
          if (histJ[t] > histJ[t - 1] && histI[t] < histI[t - 1]) {
            chain.addTransition(i, j)
          }
        }
      }
    }

    chain.normalize()

    return {
      chain,
      stationaryDistribution: chain.stationaryDistribution(),
      predictNext: (steps: number) => {
        return players.map((_, i) => chain.predictAhead(i, steps))
      }
    }
  }

  /**
   * Get Kalman filter prediction for a player
   */
  getKalmanPrediction(player: number, steps: number = 10): {
    currentEstimate: number
    uncertainty: number
    forecast: number[]
    forecastUncertainties: number[]
  } {
    const history = this.territoryHistory.get(player) ?? []
    
    if (history.length < 3) {
      const current = history[history.length - 1] ?? 0
      return {
        currentEstimate: current,
        uncertainty: 0,
        forecast: Array(steps).fill(current),
        forecastUncertainties: Array(steps).fill(0)
      }
    }

    const variance = history.slice(1).reduce((sum, v, i) => 
      sum + (v - history[i]) ** 2, 0) / history.length

    const filter = new KalmanFilter(
      history[0],
      variance || 1,
      (variance || 1) * 0.1,
      (variance || 1) * 0.5
    )

    for (const measurement of history) {
      filter.step(measurement)
    }

    const { predictions, uncertainties } = filter.forecast(steps)

    return {
      currentEstimate: filter.getState(),
      uncertainty: filter.getUncertainty(),
      forecast: predictions,
      forecastUncertainties: uncertainties
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RE-EXPORTS FOR CONVENIENCE
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Math
  Vector2,
  Vector3,
  Quaternion,
  Axial,
  Cube,
  GeodesicHexGrid,
  KDTree,
  SpatialHashGrid,
  ToroidalSpatialHash,
  
  // Algorithms
  kMeansClustering,
  dbscan,
  findConnectedComponents,
  dijkstra,
  aStar,
  louvainCommunities,
  computeVoronoi,
  
  // Effects
  FlowField2D,
  InfectionFlowAnalyzer,
  HeatMap,
  ParticleSystem,
  ParticleEffectManager,
  ParticlePresets,
  StableFluids,
  LatticeBoltzmann,
  InfectionFluidSimulator,
  
  // Statistics
  computeTerritoryStats,
  sparkline,
  sparklineSvg,
  predictWinner,
  detectChangePoints,
  
  // Bayesian
  generateProbabilitySnapshot,
  bayesianWinProbability,
  bayesianConquestRate,
  MarkovChain,
  KalmanFilter,
  
  // Snapshot
  generateSnapshot,
  formatSnapshotAsText,
  exportSnapshotAsJSON,
  
  // WASM
  HexGridWasmWrapper,
  FlowFieldWasmWrapper
}

// Type exports
export type { GameSnapshot, PlayerSnapshot, ProbabilitySnapshot }
