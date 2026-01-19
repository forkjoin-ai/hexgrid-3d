/**
 * Vector Flow Field System
 * 
 * This module provides continuous vector field representations for:
 * - Infection propagation visualization
 * - Fluid-like motion rendering
 * - Streamline generation
 * - Divergence/Curl analysis
 * 
 * Mathematical foundations:
 * - Divergence: ∇·F = ∂Fx/∂x + ∂Fy/∂y + ∂Fz/∂z (sources/sinks)
 * - Curl: ∇×F (rotation/vorticity)
 * - Laplacian: ∇²φ (diffusion)
 * 
 * @module algorithms/FlowField
 */

import { Vector2, Vector3 } from '../math/Vector3'
import { SpatialHashGrid } from '../math/SpatialIndex'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface FlowFieldConfig {
  width: number
  height: number
  resolution: number  // Grid cell size
  decayRate?: number  // How quickly velocities decay
  diffusionRate?: number  // How quickly velocities spread
}

export interface FlowSample {
  position: Vector2
  velocity: Vector2
  magnitude: number
  divergence: number
  curl: number
}

export interface Streamline {
  points: Vector2[]
  startPosition: Vector2
  totalLength: number
  averageVelocity: number
}

// ═══════════════════════════════════════════════════════════════════════════
// 2D FLOW FIELD
// ═══════════════════════════════════════════════════════════════════════════

export class FlowField2D {
  private velocityX: Float32Array
  private velocityY: Float32Array
  private tempX: Float32Array
  private tempY: Float32Array
  
  public readonly cols: number
  public readonly rows: number
  public readonly resolution: number
  public readonly width: number
  public readonly height: number
  
  private decayRate: number
  private diffusionRate: number

  constructor(config: FlowFieldConfig) {
    this.width = config.width
    this.height = config.height
    this.resolution = config.resolution
    this.decayRate = config.decayRate ?? 0.98
    this.diffusionRate = config.diffusionRate ?? 0.1
    
    this.cols = Math.ceil(config.width / config.resolution)
    this.rows = Math.ceil(config.height / config.resolution)
    
    const size = this.cols * this.rows
    this.velocityX = new Float32Array(size)
    this.velocityY = new Float32Array(size)
    this.tempX = new Float32Array(size)
    this.tempY = new Float32Array(size)
  }

  /**
   * Clear all velocities
   */
  clear(): void {
    this.velocityX.fill(0)
    this.velocityY.fill(0)
  }

  /**
   * Get grid index from position
   */
  private positionToIndex(x: number, y: number): number {
    const col = Math.floor(x / this.resolution)
    const row = Math.floor(y / this.resolution)
    
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return -1
    }
    
    return row * this.cols + col
  }

  /**
   * Get position from grid index
   */
  private indexToPosition(index: number): Vector2 {
    const col = index % this.cols
    const row = Math.floor(index / this.cols)
    return new Vector2(
      (col + 0.5) * this.resolution,
      (row + 0.5) * this.resolution
    )
  }

  /**
   * Add velocity at a position (accumulates)
   */
  addVelocity(x: number, y: number, vx: number, vy: number): void {
    const idx = this.positionToIndex(x, y)
    if (idx === -1) return
    
    this.velocityX[idx] += vx
    this.velocityY[idx] += vy
  }

  /**
   * Add velocity from a source point with falloff
   */
  addSource(x: number, y: number, vx: number, vy: number, radius: number): void {
    const centerCol = Math.floor(x / this.resolution)
    const centerRow = Math.floor(y / this.resolution)
    const cellRadius = Math.ceil(radius / this.resolution)
    
    for (let dr = -cellRadius; dr <= cellRadius; dr++) {
      for (let dc = -cellRadius; dc <= cellRadius; dc++) {
        const col = centerCol + dc
        const row = centerRow + dr
        
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) continue
        
        const cellX = (col + 0.5) * this.resolution
        const cellY = (row + 0.5) * this.resolution
        
        const dist = Math.sqrt((cellX - x) ** 2 + (cellY - y) ** 2)
        if (dist > radius) continue
        
        // Smooth falloff
        const falloff = 1 - (dist / radius) ** 2
        const idx = row * this.cols + col
        
        this.velocityX[idx] += vx * falloff
        this.velocityY[idx] += vy * falloff
      }
    }
  }

  /**
   * Add a vortex (rotating flow)
   */
  addVortex(x: number, y: number, strength: number, radius: number): void {
    const centerCol = Math.floor(x / this.resolution)
    const centerRow = Math.floor(y / this.resolution)
    const cellRadius = Math.ceil(radius / this.resolution)
    
    for (let dr = -cellRadius; dr <= cellRadius; dr++) {
      for (let dc = -cellRadius; dc <= cellRadius; dc++) {
        const col = centerCol + dc
        const row = centerRow + dr
        
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) continue
        
        const cellX = (col + 0.5) * this.resolution
        const cellY = (row + 0.5) * this.resolution
        
        const dx = cellX - x
        const dy = cellY - y
        const dist = Math.sqrt(dx * dx + dy * dy)
        
        if (dist < 0.001 || dist > radius) continue
        
        // Tangential velocity (perpendicular to radius)
        const falloff = 1 - (dist / radius)
        const tangentX = -dy / dist
        const tangentY = dx / dist
        
        const idx = row * this.cols + col
        this.velocityX[idx] += tangentX * strength * falloff / dist
        this.velocityY[idx] += tangentY * strength * falloff / dist
      }
    }
  }

  /**
   * Add a sink (attracts flow)
   */
  addSink(x: number, y: number, strength: number, radius: number): void {
    const centerCol = Math.floor(x / this.resolution)
    const centerRow = Math.floor(y / this.resolution)
    const cellRadius = Math.ceil(radius / this.resolution)
    
    for (let dr = -cellRadius; dr <= cellRadius; dr++) {
      for (let dc = -cellRadius; dc <= cellRadius; dc++) {
        const col = centerCol + dc
        const row = centerRow + dr
        
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) continue
        
        const cellX = (col + 0.5) * this.resolution
        const cellY = (row + 0.5) * this.resolution
        
        const dx = x - cellX
        const dy = y - cellY
        const dist = Math.sqrt(dx * dx + dy * dy)
        
        if (dist < 0.001 || dist > radius) continue
        
        // Radial velocity towards sink
        const falloff = 1 - (dist / radius)
        const idx = row * this.cols + col
        
        this.velocityX[idx] += (dx / dist) * strength * falloff
        this.velocityY[idx] += (dy / dist) * strength * falloff
      }
    }
  }

  /**
   * Sample velocity at any position (bilinear interpolation)
   */
  sample(x: number, y: number): Vector2 {
    // Normalize to grid coordinates
    const gx = x / this.resolution - 0.5
    const gy = y / this.resolution - 0.5
    
    const x0 = Math.floor(gx)
    const y0 = Math.floor(gy)
    const x1 = x0 + 1
    const y1 = y0 + 1
    
    const sx = gx - x0
    const sy = gy - y0
    
    const getVel = (col: number, row: number): [number, number] => {
      if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
        return [0, 0]
      }
      const idx = row * this.cols + col
      return [this.velocityX[idx], this.velocityY[idx]]
    }
    
    const [v00x, v00y] = getVel(x0, y0)
    const [v10x, v10y] = getVel(x1, y0)
    const [v01x, v01y] = getVel(x0, y1)
    const [v11x, v11y] = getVel(x1, y1)
    
    // Bilinear interpolation
    const vx = (1 - sx) * (1 - sy) * v00x + sx * (1 - sy) * v10x +
               (1 - sx) * sy * v01x + sx * sy * v11x
    const vy = (1 - sx) * (1 - sy) * v00y + sx * (1 - sy) * v10y +
               (1 - sx) * sy * v01y + sx * sy * v11y
    
    return new Vector2(vx, vy)
  }

  /**
   * Get full sample with derivatives
   */
  sampleFull(x: number, y: number): FlowSample {
    const velocity = this.sample(x, y)
    const h = this.resolution
    
    // Central differences for derivatives
    const vRight = this.sample(x + h, y)
    const vLeft = this.sample(x - h, y)
    const vUp = this.sample(x, y + h)
    const vDown = this.sample(x, y - h)
    
    const dvxdx = (vRight.x - vLeft.x) / (2 * h)
    const dvydy = (vUp.y - vDown.y) / (2 * h)
    const dvydx = (vRight.y - vLeft.y) / (2 * h)
    const dvxdy = (vUp.x - vDown.x) / (2 * h)
    
    const divergence = dvxdx + dvydy
    const curl = dvydx - dvxdy  // z-component of curl in 2D
    
    return {
      position: new Vector2(x, y),
      velocity,
      magnitude: velocity.magnitude(),
      divergence,
      curl
    }
  }

  /**
   * Update field (apply decay and diffusion)
   */
  update(dt: number = 1): void {
    const size = this.cols * this.rows
    
    // Apply decay
    const decay = Math.pow(this.decayRate, dt)
    for (let i = 0; i < size; i++) {
      this.velocityX[i] *= decay
      this.velocityY[i] *= decay
    }
    
    // Apply diffusion (Jacobi iteration)
    if (this.diffusionRate > 0) {
      const alpha = this.diffusionRate * dt
      const beta = 1 / (1 + 4 * alpha)
      
      for (let iter = 0; iter < 4; iter++) {
        for (let row = 0; row < this.rows; row++) {
          for (let col = 0; col < this.cols; col++) {
            const idx = row * this.cols + col
            
            let sumX = 0, sumY = 0, count = 0
            
            if (col > 0) { sumX += this.velocityX[idx - 1]; sumY += this.velocityY[idx - 1]; count++ }
            if (col < this.cols - 1) { sumX += this.velocityX[idx + 1]; sumY += this.velocityY[idx + 1]; count++ }
            if (row > 0) { sumX += this.velocityX[idx - this.cols]; sumY += this.velocityY[idx - this.cols]; count++ }
            if (row < this.rows - 1) { sumX += this.velocityX[idx + this.cols]; sumY += this.velocityY[idx + this.cols]; count++ }
            
            if (count > 0) {
              this.tempX[idx] = (this.velocityX[idx] + alpha * sumX / count) * beta
              this.tempY[idx] = (this.velocityY[idx] + alpha * sumY / count) * beta
            }
          }
        }
        
        // Swap buffers
        const swapX = this.velocityX
        const swapY = this.velocityY
        this.velocityX = this.tempX
        this.velocityY = this.tempY
        this.tempX = swapX
        this.tempY = swapY
      }
    }
  }

  /**
   * Generate a streamline from a starting point
   */
  traceStreamline(
    startX: number,
    startY: number,
    options: {
      maxLength?: number
      stepSize?: number
      maxSteps?: number
      minVelocity?: number
    } = {}
  ): Streamline {
    const {
      maxLength = this.width,
      stepSize = this.resolution * 0.5,
      maxSteps = 1000,
      minVelocity = 0.01
    } = options
    
    const points: Vector2[] = [new Vector2(startX, startY)]
    let x = startX
    let y = startY
    let totalLength = 0
    let totalVelocity = 0
    
    for (let step = 0; step < maxSteps && totalLength < maxLength; step++) {
      const vel = this.sample(x, y)
      const mag = vel.magnitude()
      
      if (mag < minVelocity) break
      
      totalVelocity += mag
      
      // RK4 integration for smoother curves
      const k1 = this.sample(x, y).normalize()
      const k2 = this.sample(x + k1.x * stepSize * 0.5, y + k1.y * stepSize * 0.5).normalize()
      const k3 = this.sample(x + k2.x * stepSize * 0.5, y + k2.y * stepSize * 0.5).normalize()
      const k4 = this.sample(x + k3.x * stepSize, y + k3.y * stepSize).normalize()
      
      const dx = (k1.x + 2 * k2.x + 2 * k3.x + k4.x) / 6 * stepSize
      const dy = (k1.y + 2 * k2.y + 2 * k3.y + k4.y) / 6 * stepSize
      
      x += dx
      y += dy
      totalLength += Math.sqrt(dx * dx + dy * dy)
      
      // Check bounds
      if (x < 0 || x > this.width || y < 0 || y > this.height) break
      
      points.push(new Vector2(x, y))
    }
    
    return {
      points,
      startPosition: new Vector2(startX, startY),
      totalLength,
      averageVelocity: points.length > 1 ? totalVelocity / (points.length - 1) : 0
    }
  }

  /**
   * Generate multiple evenly-spaced streamlines
   */
  generateStreamlines(
    count: number,
    options?: Parameters<FlowField2D['traceStreamline']>[2]
  ): Streamline[] {
    const streamlines: Streamline[] = []
    const spacing = Math.sqrt((this.width * this.height) / count)
    
    // Use spatial hash to prevent streamlines from getting too close
    const usedPositions = new SpatialHashGrid<boolean>(spacing, 2)
    
    // Grid-based seeding with jitter
    for (let y = spacing / 2; y < this.height && streamlines.length < count; y += spacing) {
      for (let x = spacing / 2; x < this.width && streamlines.length < count; x += spacing) {
        // Add some randomness
        const jitterX = (Math.random() - 0.5) * spacing * 0.5
        const jitterY = (Math.random() - 0.5) * spacing * 0.5
        const seedX = x + jitterX
        const seedY = y + jitterY
        
        // Check if too close to existing streamline
        const nearby = usedPositions.query([seedX, seedY], spacing * 0.5)
        if (nearby.length > 0) continue
        
        const streamline = this.traceStreamline(seedX, seedY, options)
        
        if (streamline.points.length > 2) {
          streamlines.push(streamline)
          
          // Mark positions along streamline as used
          for (const point of streamline.points) {
            usedPositions.insert([point.x, point.y], true)
          }
        }
      }
    }
    
    return streamlines
  }

  /**
   * Compute divergence field (for identifying sources/sinks)
   */
  computeDivergenceField(): Float32Array {
    const divergence = new Float32Array(this.cols * this.rows)
    const h = this.resolution
    
    for (let row = 1; row < this.rows - 1; row++) {
      for (let col = 1; col < this.cols - 1; col++) {
        const idx = row * this.cols + col
        
        const dvxdx = (this.velocityX[idx + 1] - this.velocityX[idx - 1]) / (2 * h)
        const dvydy = (this.velocityY[idx + this.cols] - this.velocityY[idx - this.cols]) / (2 * h)
        
        divergence[idx] = dvxdx + dvydy
      }
    }
    
    return divergence
  }

  /**
   * Compute curl field (for identifying vortices)
   */
  computeCurlField(): Float32Array {
    const curl = new Float32Array(this.cols * this.rows)
    const h = this.resolution
    
    for (let row = 1; row < this.rows - 1; row++) {
      for (let col = 1; col < this.cols - 1; col++) {
        const idx = row * this.cols + col
        
        const dvydx = (this.velocityY[idx + 1] - this.velocityY[idx - 1]) / (2 * h)
        const dvxdy = (this.velocityX[idx + this.cols] - this.velocityX[idx - this.cols]) / (2 * h)
        
        curl[idx] = dvydx - dvxdy
      }
    }
    
    return curl
  }

  /**
   * Get raw velocity data for rendering
   */
  getVelocityData(): { x: Float32Array; y: Float32Array } {
    return {
      x: this.velocityX,
      y: this.velocityY
    }
  }

  /**
   * Get velocity at grid cell
   */
  getGridVelocity(col: number, row: number): Vector2 {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return Vector2.zero()
    }
    const idx = row * this.cols + col
    return new Vector2(this.velocityX[idx], this.velocityY[idx])
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3D FLOW FIELD (for spherical projections)
// ═══════════════════════════════════════════════════════════════════════════

export class FlowField3D {
  private velocity: Float32Array  // Interleaved x, y, z
  private temp: Float32Array
  
  public readonly sizeX: number
  public readonly sizeY: number
  public readonly sizeZ: number
  public readonly resolution: number
  
  private decayRate: number
  private diffusionRate: number

  constructor(config: {
    sizeX: number
    sizeY: number
    sizeZ: number
    resolution: number
    decayRate?: number
    diffusionRate?: number
  }) {
    this.sizeX = config.sizeX
    this.sizeY = config.sizeY
    this.sizeZ = config.sizeZ
    this.resolution = config.resolution
    this.decayRate = config.decayRate ?? 0.98
    this.diffusionRate = config.diffusionRate ?? 0.1
    
    const cellsX = Math.ceil(config.sizeX / config.resolution)
    const cellsY = Math.ceil(config.sizeY / config.resolution)
    const cellsZ = Math.ceil(config.sizeZ / config.resolution)
    const size = cellsX * cellsY * cellsZ * 3
    
    this.velocity = new Float32Array(size)
    this.temp = new Float32Array(size)
  }

  private positionToIndex(x: number, y: number, z: number): number {
    const cellsX = Math.ceil(this.sizeX / this.resolution)
    const cellsY = Math.ceil(this.sizeY / this.resolution)
    const cellsZ = Math.ceil(this.sizeZ / this.resolution)
    
    const cx = Math.floor(x / this.resolution)
    const cy = Math.floor(y / this.resolution)
    const cz = Math.floor(z / this.resolution)
    
    if (cx < 0 || cx >= cellsX || cy < 0 || cy >= cellsY || cz < 0 || cz >= cellsZ) {
      return -1
    }
    
    return (cz * cellsY * cellsX + cy * cellsX + cx) * 3
  }

  addVelocity(x: number, y: number, z: number, vx: number, vy: number, vz: number): void {
    const idx = this.positionToIndex(x, y, z)
    if (idx === -1) return
    
    this.velocity[idx] += vx
    this.velocity[idx + 1] += vy
    this.velocity[idx + 2] += vz
  }

  sample(x: number, y: number, z: number): Vector3 {
    const idx = this.positionToIndex(x, y, z)
    if (idx === -1) return Vector3.zero()
    
    return new Vector3(
      this.velocity[idx],
      this.velocity[idx + 1],
      this.velocity[idx + 2]
    )
  }

  clear(): void {
    this.velocity.fill(0)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INFECTION FLOW ANALYZER
// ═══════════════════════════════════════════════════════════════════════════

export interface InfectionFlowData {
  photoId: string
  centroid: Vector2
  velocity: Vector2        // Current expansion velocity
  territory: number        // Cell count
  frontVelocity: number    // Expansion rate at front
}

/**
 * Analyze infection propagation as a flow field
 */
export class InfectionFlowAnalyzer {
  private flowField: FlowField2D
  private previousPositions: Map<string, Map<number, Vector2>> = new Map()
  private velocityHistory: Map<string, Vector2[]> = new Map()

  constructor(width: number, height: number, resolution: number = 20) {
    this.flowField = new FlowField2D({
      width,
      height,
      resolution,
      decayRate: 0.9,
      diffusionRate: 0.2
    })
  }

  /**
   * Update flow field based on infection changes
   */
  update(
    infections: Map<number, { photoId: string }>,
    positions: Array<[number, number, number]>,
    dt: number = 1
  ): void {
    // Group cells by photo
    const photoCells = new Map<string, number[]>()
    for (const [idx, infection] of infections) {
      if (!photoCells.has(infection.photoId)) {
        photoCells.set(infection.photoId, [])
      }
      photoCells.get(infection.photoId)!.push(idx)
    }

    // Calculate flow vectors from position changes
    for (const [photoId, cells] of photoCells) {
      const prevPositions = this.previousPositions.get(photoId) || new Map()
      const newPositions = new Map<number, Vector2>()

      for (const idx of cells) {
        const pos = new Vector2(positions[idx][0], positions[idx][1])
        newPositions.set(idx, pos)

        // New cell = expansion
        if (!prevPositions.has(idx)) {
          // Find direction from centroid
          const centroid = this.calculateCentroid(cells, positions)
          const direction = pos.subtract(centroid).normalize()
          
          // Add outward velocity at this position
          this.flowField.addVelocity(
            pos.x, pos.y,
            direction.x * 2,
            direction.y * 2
          )
        }
      }

      // Cells that disappeared = retraction
      for (const [idx, prevPos] of prevPositions) {
        if (!newPositions.has(idx)) {
          const centroid = this.calculateCentroid(cells, positions)
          const direction = prevPos.subtract(centroid).normalize()
          
          // Add inward velocity (negative)
          this.flowField.addVelocity(
            prevPos.x, prevPos.y,
            -direction.x * 2,
            -direction.y * 2
          )
        }
      }

      this.previousPositions.set(photoId, newPositions)
    }

    // Update flow field physics
    this.flowField.update(dt)
  }

  private calculateCentroid(cells: number[], positions: Array<[number, number, number]>): Vector2 {
    if (cells.length === 0) return Vector2.zero()
    
    let sumX = 0, sumY = 0
    for (const idx of cells) {
      sumX += positions[idx][0]
      sumY += positions[idx][1]
    }
    
    return new Vector2(sumX / cells.length, sumY / cells.length)
  }

  /**
   * Get flow data for each photo
   */
  getFlowData(
    infections: Map<number, { photoId: string }>,
    positions: Array<[number, number, number]>
  ): InfectionFlowData[] {
    const photoCells = new Map<string, number[]>()
    for (const [idx, infection] of infections) {
      if (!photoCells.has(infection.photoId)) {
        photoCells.set(infection.photoId, [])
      }
      photoCells.get(infection.photoId)!.push(idx)
    }

    const results: InfectionFlowData[] = []

    for (const [photoId, cells] of photoCells) {
      const centroid = this.calculateCentroid(cells, positions)
      
      // Sample velocity at centroid
      const velocity = this.flowField.sample(centroid.x, centroid.y)
      
      // Calculate front velocity (average at boundary cells)
      let frontVelocity = 0
      let frontCount = 0
      
      // Simple boundary detection: cells far from centroid
      const avgDist = cells.reduce((sum, idx) => {
        const pos = new Vector2(positions[idx][0], positions[idx][1])
        return sum + pos.distanceTo(centroid)
      }, 0) / cells.length

      for (const idx of cells) {
        const pos = new Vector2(positions[idx][0], positions[idx][1])
        if (pos.distanceTo(centroid) > avgDist * 0.8) {
          const vel = this.flowField.sample(pos.x, pos.y)
          frontVelocity += vel.magnitude()
          frontCount++
        }
      }

      results.push({
        photoId,
        centroid,
        velocity,
        territory: cells.length,
        frontVelocity: frontCount > 0 ? frontVelocity / frontCount : 0
      })
    }

    return results
  }

  /**
   * Get streamlines for visualization
   */
  getStreamlines(count: number = 50): Streamline[] {
    return this.flowField.generateStreamlines(count)
  }

  /**
   * Get divergence field for source/sink visualization
   */
  getDivergenceField(): Float32Array {
    return this.flowField.computeDivergenceField()
  }

  /**
   * Get curl field for vortex visualization
   */
  getCurlField(): Float32Array {
    return this.flowField.computeCurlField()
  }

  /**
   * Sample flow at position
   */
  sampleFlow(x: number, y: number): FlowSample {
    return this.flowField.sampleFull(x, y)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HEAT MAP GENERATOR (Kernel Density Estimation)
// ═══════════════════════════════════════════════════════════════════════════

export interface HeatMapConfig {
  width: number
  height: number
  resolution: number
  kernelRadius: number
  kernelType?: 'gaussian' | 'uniform' | 'triangular' | 'epanechnikov'
}

export class HeatMap {
  private data: Float32Array
  public readonly cols: number
  public readonly rows: number
  public readonly resolution: number
  private config: HeatMapConfig

  constructor(config: HeatMapConfig) {
    this.config = config
    this.resolution = config.resolution
    this.cols = Math.ceil(config.width / config.resolution)
    this.rows = Math.ceil(config.height / config.resolution)
    this.data = new Float32Array(this.cols * this.rows)
  }

  /**
   * Clear heat map
   */
  clear(): void {
    this.data.fill(0)
  }

  /**
   * Add a point with weight
   */
  addPoint(x: number, y: number, weight: number = 1): void {
    const centerCol = Math.floor(x / this.resolution)
    const centerRow = Math.floor(y / this.resolution)
    const cellRadius = Math.ceil(this.config.kernelRadius / this.resolution)
    
    for (let dr = -cellRadius; dr <= cellRadius; dr++) {
      for (let dc = -cellRadius; dc <= cellRadius; dc++) {
        const col = centerCol + dc
        const row = centerRow + dr
        
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) continue
        
        const cellX = (col + 0.5) * this.resolution
        const cellY = (row + 0.5) * this.resolution
        const dist = Math.sqrt((cellX - x) ** 2 + (cellY - y) ** 2)
        
        if (dist > this.config.kernelRadius) continue
        
        const kernelValue = this.kernel(dist / this.config.kernelRadius)
        const idx = row * this.cols + col
        this.data[idx] += weight * kernelValue
      }
    }
  }

  /**
   * Add multiple points
   */
  addPoints(points: Array<{ x: number; y: number; weight?: number }>): void {
    for (const point of points) {
      this.addPoint(point.x, point.y, point.weight ?? 1)
    }
  }

  private kernel(u: number): number {
    if (u > 1) return 0
    
    switch (this.config.kernelType ?? 'gaussian') {
      case 'uniform':
        return 1
      case 'triangular':
        return 1 - u
      case 'epanechnikov':
        return 0.75 * (1 - u * u)
      case 'gaussian':
      default:
        return Math.exp(-3 * u * u)
    }
  }

  /**
   * Sample heat value at position
   */
  sample(x: number, y: number): number {
    const col = Math.floor(x / this.resolution)
    const row = Math.floor(y / this.resolution)
    
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return 0
    }
    
    return this.data[row * this.cols + col]
  }

  /**
   * Get normalized data (0-1 range)
   */
  getNormalizedData(): Float32Array {
    const max = Math.max(...this.data)
    if (max === 0) return new Float32Array(this.data.length)
    
    const normalized = new Float32Array(this.data.length)
    for (let i = 0; i < this.data.length; i++) {
      normalized[i] = this.data[i] / max
    }
    
    return normalized
  }

  /**
   * Get raw data
   */
  getData(): Float32Array {
    return this.data
  }

  /**
   * Get statistics
   */
  getStats(): { min: number; max: number; mean: number; stdDev: number } {
    let min = Infinity
    let max = -Infinity
    let sum = 0
    
    for (let i = 0; i < this.data.length; i++) {
      min = Math.min(min, this.data[i])
      max = Math.max(max, this.data[i])
      sum += this.data[i]
    }
    
    const mean = sum / this.data.length
    
    let variance = 0
    for (let i = 0; i < this.data.length; i++) {
      variance += (this.data[i] - mean) ** 2
    }
    variance /= this.data.length
    
    return { min, max, mean, stdDev: Math.sqrt(variance) }
  }
}
