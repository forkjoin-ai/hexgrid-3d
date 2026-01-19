/**
 * Fluid Dynamics Simulation
 * 
 * Implements a simplified 2D incompressible Navier-Stokes solver
 * using the Jos Stam stable fluids approach.
 * 
 * Features:
 * - Real-time interactive fluid simulation
 * - Advection, diffusion, and pressure solve
 * - Vorticity confinement for better swirls
 * - Integration with flow field visualization
 * - Support for obstacles and boundaries
 * 
 * Applications:
 * - Visualizing infection spread dynamics
 * - Territory flow patterns
 * - Ambient effects and atmosphere
 * 
 * @module algorithms/FluidSimulation
 */

import { Vector2 } from '../math/Vector3'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface FluidConfig {
  width: number
  height: number
  diffusion?: number          // Viscosity (0 = inviscid)
  viscosity?: number          // Velocity diffusion rate
  pressureIterations?: number // Gauss-Seidel iterations
  dt?: number                 // Time step
  vorticityConfinement?: number // Vorticity enhancement strength
  dissipation?: number        // Density/velocity decay rate
}

export interface FluidSource {
  x: number
  y: number
  radius: number
  density: number
  velocityX: number
  velocityY: number
  color?: [number, number, number]
}

// ═══════════════════════════════════════════════════════════════════════════
// STABLE FLUIDS SOLVER (JOS STAM'S METHOD)
// ═══════════════════════════════════════════════════════════════════════════

export class StableFluids {
  private readonly N: number  // Grid resolution (N x N)
  private readonly size: number
  
  // Velocity field (staggered MAC grid)
  private velocityX: Float32Array
  private velocityY: Float32Array
  private velocityX0: Float32Array
  private velocityY0: Float32Array
  
  // Density field (for visualization)
  private density: Float32Array
  private density0: Float32Array
  
  // Color channels (for multi-color fluids)
  private colorR: Float32Array
  private colorG: Float32Array
  private colorB: Float32Array
  private colorR0: Float32Array
  private colorG0: Float32Array
  private colorB0: Float32Array
  
  // Pressure and divergence
  private pressure: Float32Array
  private divergence: Float32Array
  
  // Vorticity
  private vorticity: Float32Array
  
  // Obstacles (1 = solid, 0 = fluid)
  private obstacles: Uint8Array
  
  // Configuration
  private config: Required<FluidConfig>

  constructor(config: FluidConfig) {
    // N must be power of 2 for optimal performance
    this.N = Math.max(config.width, config.height)
    this.size = (this.N + 2) * (this.N + 2)
    
    this.config = {
      width: config.width,
      height: config.height,
      diffusion: config.diffusion ?? 0.0001,
      viscosity: config.viscosity ?? 0.00001,
      pressureIterations: config.pressureIterations ?? 20,
      dt: config.dt ?? 0.016,
      vorticityConfinement: config.vorticityConfinement ?? 0.1,
      dissipation: config.dissipation ?? 0.999
    }
    
    // Initialize arrays
    this.velocityX = new Float32Array(this.size)
    this.velocityY = new Float32Array(this.size)
    this.velocityX0 = new Float32Array(this.size)
    this.velocityY0 = new Float32Array(this.size)
    
    this.density = new Float32Array(this.size)
    this.density0 = new Float32Array(this.size)
    
    this.colorR = new Float32Array(this.size)
    this.colorG = new Float32Array(this.size)
    this.colorB = new Float32Array(this.size)
    this.colorR0 = new Float32Array(this.size)
    this.colorG0 = new Float32Array(this.size)
    this.colorB0 = new Float32Array(this.size)
    
    this.pressure = new Float32Array(this.size)
    this.divergence = new Float32Array(this.size)
    this.vorticity = new Float32Array(this.size)
    
    this.obstacles = new Uint8Array(this.size)
  }

  /**
   * Get 1D index from 2D coordinates (with boundary offset)
   */
  private IX(x: number, y: number): number {
    return (x + 1) + (y + 1) * (this.N + 2)
  }

  /**
   * Set boundary conditions
   * @param b - 0 for density, 1 for x velocity, 2 for y velocity
   */
  private setBoundary(b: number, x: Float32Array): void {
    const N = this.N

    // Edges
    for (let i = 1; i <= N; i++) {
      x[this.IX(0, i - 1)] = b === 1 ? -x[this.IX(1, i - 1)] : x[this.IX(1, i - 1)]
      x[this.IX(N + 1, i - 1)] = b === 1 ? -x[this.IX(N, i - 1)] : x[this.IX(N, i - 1)]
      x[this.IX(i - 1, 0)] = b === 2 ? -x[this.IX(i - 1, 1)] : x[this.IX(i - 1, 1)]
      x[this.IX(i - 1, N + 1)] = b === 2 ? -x[this.IX(i - 1, N)] : x[this.IX(i - 1, N)]
    }

    // Corners
    x[this.IX(0, 0)] = 0.5 * (x[this.IX(1, 0)] + x[this.IX(0, 1)])
    x[this.IX(0, N + 1)] = 0.5 * (x[this.IX(1, N + 1)] + x[this.IX(0, N)])
    x[this.IX(N + 1, 0)] = 0.5 * (x[this.IX(N, 0)] + x[this.IX(N + 1, 1)])
    x[this.IX(N + 1, N + 1)] = 0.5 * (x[this.IX(N, N + 1)] + x[this.IX(N + 1, N)])
    
    // Obstacles
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (this.obstacles[this.IX(i, j)]) {
          if (b === 0) {
            x[this.IX(i, j)] = 0
          } else if (b === 1) {
            x[this.IX(i, j)] = -x[this.IX(i - 1, j)]
          } else if (b === 2) {
            x[this.IX(i, j)] = -x[this.IX(i, j - 1)]
          }
        }
      }
    }
  }

  /**
   * Diffusion step using implicit Gauss-Seidel relaxation
   * Solves: (I - k∇²)x = x0
   */
  private diffuse(b: number, x: Float32Array, x0: Float32Array, diff: number, dt: number): void {
    const N = this.N
    const a = dt * diff * N * N
    const c = 1 + 4 * a
    
    for (let k = 0; k < this.config.pressureIterations; k++) {
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const idx = this.IX(i, j)
          if (this.obstacles[idx]) continue
          
          x[idx] = (
            x0[idx] + a * (
              x[this.IX(i - 1, j)] +
              x[this.IX(i + 1, j)] +
              x[this.IX(i, j - 1)] +
              x[this.IX(i, j + 1)]
            )
          ) / c
        }
      }
      this.setBoundary(b, x)
    }
  }

  /**
   * Advection using semi-Lagrangian method
   * Traces particles backward through velocity field
   */
  private advect(
    b: number,
    d: Float32Array,
    d0: Float32Array,
    velocX: Float32Array,
    velocY: Float32Array,
    dt: number
  ): void {
    const N = this.N
    const dtx = dt * N
    const dty = dt * N

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const idx = this.IX(i, j)
        if (this.obstacles[idx]) continue

        // Trace particle backward
        let x = i - dtx * velocX[idx]
        let y = j - dty * velocY[idx]

        // Clamp to grid
        x = Math.max(0.5, Math.min(N - 0.5, x))
        y = Math.max(0.5, Math.min(N - 0.5, y))

        // Integer and fractional parts
        const i0 = Math.floor(x)
        const j0 = Math.floor(y)
        const i1 = i0 + 1
        const j1 = j0 + 1
        const s1 = x - i0
        const s0 = 1 - s1
        const t1 = y - j0
        const t0 = 1 - t1

        // Bilinear interpolation
        d[idx] = s0 * (t0 * d0[this.IX(i0, j0)] + t1 * d0[this.IX(i0, j1)]) +
                 s1 * (t0 * d0[this.IX(i1, j0)] + t1 * d0[this.IX(i1, j1)])
      }
    }

    this.setBoundary(b, d)
  }

  /**
   * Project velocity field to be mass-conserving (divergence-free)
   * Uses Helmholtz-Hodge decomposition
   */
  private project(velocX: Float32Array, velocY: Float32Array): void {
    const N = this.N
    const h = 1.0 / N
    
    // Compute divergence
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const idx = this.IX(i, j)
        if (this.obstacles[idx]) continue
        
        this.divergence[idx] = -0.5 * h * (
          velocX[this.IX(i + 1, j)] - velocX[this.IX(i - 1, j)] +
          velocY[this.IX(i, j + 1)] - velocY[this.IX(i, j - 1)]
        )
        this.pressure[idx] = 0
      }
    }
    
    this.setBoundary(0, this.divergence)
    this.setBoundary(0, this.pressure)
    
    // Solve pressure Poisson equation
    for (let k = 0; k < this.config.pressureIterations; k++) {
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const idx = this.IX(i, j)
          if (this.obstacles[idx]) continue
          
          this.pressure[idx] = (
            this.divergence[idx] +
            this.pressure[this.IX(i - 1, j)] +
            this.pressure[this.IX(i + 1, j)] +
            this.pressure[this.IX(i, j - 1)] +
            this.pressure[this.IX(i, j + 1)]
          ) / 4
        }
      }
      this.setBoundary(0, this.pressure)
    }
    
    // Subtract pressure gradient from velocity
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const idx = this.IX(i, j)
        if (this.obstacles[idx]) continue
        
        velocX[idx] -= 0.5 * (this.pressure[this.IX(i + 1, j)] - this.pressure[this.IX(i - 1, j)]) / h
        velocY[idx] -= 0.5 * (this.pressure[this.IX(i, j + 1)] - this.pressure[this.IX(i, j - 1)]) / h
      }
    }
    
    this.setBoundary(1, velocX)
    this.setBoundary(2, velocY)
  }

  /**
   * Compute vorticity (curl of velocity)
   */
  private computeVorticity(): void {
    const N = this.N
    
    for (let i = 1; i < N - 1; i++) {
      for (let j = 1; j < N - 1; j++) {
        const idx = this.IX(i, j)
        
        // Curl in 2D = dv/dx - du/dy
        this.vorticity[idx] = 0.5 * (
          (this.velocityY[this.IX(i + 1, j)] - this.velocityY[this.IX(i - 1, j)]) -
          (this.velocityX[this.IX(i, j + 1)] - this.velocityX[this.IX(i, j - 1)])
        )
      }
    }
  }

  /**
   * Apply vorticity confinement force
   * This compensates for numerical dissipation of vortices
   */
  private applyVorticityConfinement(dt: number): void {
    const N = this.N
    const epsilon = this.config.vorticityConfinement
    
    this.computeVorticity()
    
    for (let i = 2; i < N - 2; i++) {
      for (let j = 2; j < N - 2; j++) {
        const idx = this.IX(i, j)
        if (this.obstacles[idx]) continue
        
        // Gradient of vorticity magnitude
        const dwdx = (
          Math.abs(this.vorticity[this.IX(i + 1, j)]) -
          Math.abs(this.vorticity[this.IX(i - 1, j)])
        ) * 0.5
        const dwdy = (
          Math.abs(this.vorticity[this.IX(i, j + 1)]) -
          Math.abs(this.vorticity[this.IX(i, j - 1)])
        ) * 0.5
        
        // Normalize gradient
        const len = Math.sqrt(dwdx * dwdx + dwdy * dwdy) + 1e-10
        const nx = dwdx / len
        const ny = dwdy / len
        
        // Apply confinement force: N × ω
        const w = this.vorticity[idx]
        this.velocityX[idx] += dt * epsilon * ny * w
        this.velocityY[idx] -= dt * epsilon * nx * w
      }
    }
  }

  /**
   * Add external force/velocity
   */
  addForce(x: number, y: number, forceX: number, forceY: number, radius: number = 5): void {
    const N = this.N
    const cx = Math.floor(x * N / this.config.width)
    const cy = Math.floor(y * N / this.config.height)
    
    for (let i = -radius; i <= radius; i++) {
      for (let j = -radius; j <= radius; j++) {
        const px = cx + i
        const py = cy + j
        if (px < 0 || px >= N || py < 0 || py >= N) continue
        
        const dist = Math.sqrt(i * i + j * j)
        if (dist > radius) continue
        
        const strength = 1 - dist / radius
        const idx = this.IX(px, py)
        
        this.velocityX[idx] += forceX * strength
        this.velocityY[idx] += forceY * strength
      }
    }
  }

  /**
   * Add density at position
   */
  addDensity(
    x: number,
    y: number,
    amount: number,
    radius: number = 5,
    color?: [number, number, number]
  ): void {
    const N = this.N
    const cx = Math.floor(x * N / this.config.width)
    const cy = Math.floor(y * N / this.config.height)
    
    for (let i = -radius; i <= radius; i++) {
      for (let j = -radius; j <= radius; j++) {
        const px = cx + i
        const py = cy + j
        if (px < 0 || px >= N || py < 0 || py >= N) continue
        
        const dist = Math.sqrt(i * i + j * j)
        if (dist > radius) continue
        
        const strength = 1 - dist / radius
        const idx = this.IX(px, py)
        
        this.density[idx] += amount * strength
        
        if (color) {
          this.colorR[idx] = color[0]
          this.colorG[idx] = color[1]
          this.colorB[idx] = color[2]
        }
      }
    }
  }

  /**
   * Add fluid source
   */
  addSource(source: FluidSource): void {
    this.addDensity(source.x, source.y, source.density, source.radius, source.color)
    this.addForce(source.x, source.y, source.velocityX, source.velocityY, source.radius)
  }

  /**
   * Set obstacle at position
   */
  setObstacle(x: number, y: number, radius: number = 5): void {
    const N = this.N
    const cx = Math.floor(x * N / this.config.width)
    const cy = Math.floor(y * N / this.config.height)
    
    for (let i = -radius; i <= radius; i++) {
      for (let j = -radius; j <= radius; j++) {
        const px = cx + i
        const py = cy + j
        if (px < 0 || px >= N || py < 0 || py >= N) continue
        
        const dist = Math.sqrt(i * i + j * j)
        if (dist > radius) continue
        
        this.obstacles[this.IX(px, py)] = 1
      }
    }
  }

  /**
   * Clear all obstacles
   */
  clearObstacles(): void {
    this.obstacles.fill(0)
  }

  /**
   * Main simulation step
   */
  step(dt?: number): void {
    const timeStep = dt ?? this.config.dt
    
    // Velocity step
    // Add forces were already applied
    
    // Diffuse velocity
    this.velocityX0.set(this.velocityX)
    this.velocityY0.set(this.velocityY)
    this.diffuse(1, this.velocityX, this.velocityX0, this.config.viscosity, timeStep)
    this.diffuse(2, this.velocityY, this.velocityY0, this.config.viscosity, timeStep)
    
    // Make divergence-free
    this.project(this.velocityX, this.velocityY)
    
    // Advect velocity
    this.velocityX0.set(this.velocityX)
    this.velocityY0.set(this.velocityY)
    this.advect(1, this.velocityX, this.velocityX0, this.velocityX0, this.velocityY0, timeStep)
    this.advect(2, this.velocityY, this.velocityY0, this.velocityX0, this.velocityY0, timeStep)
    
    // Make divergence-free again
    this.project(this.velocityX, this.velocityY)
    
    // Apply vorticity confinement
    if (this.config.vorticityConfinement > 0) {
      this.applyVorticityConfinement(timeStep)
    }
    
    // Density step
    // Diffuse density
    this.density0.set(this.density)
    this.diffuse(0, this.density, this.density0, this.config.diffusion, timeStep)
    
    // Advect density
    this.density0.set(this.density)
    this.advect(0, this.density, this.density0, this.velocityX, this.velocityY, timeStep)
    
    // Advect colors
    this.colorR0.set(this.colorR)
    this.colorG0.set(this.colorG)
    this.colorB0.set(this.colorB)
    this.advect(0, this.colorR, this.colorR0, this.velocityX, this.velocityY, timeStep)
    this.advect(0, this.colorG, this.colorG0, this.velocityX, this.velocityY, timeStep)
    this.advect(0, this.colorB, this.colorB0, this.velocityX, this.velocityY, timeStep)
    
    // Apply dissipation
    const dissipation = this.config.dissipation
    for (let i = 0; i < this.size; i++) {
      this.density[i] *= dissipation
      this.velocityX[i] *= dissipation
      this.velocityY[i] *= dissipation
    }
  }

  /**
   * Get density at grid position
   */
  getDensity(x: number, y: number): number {
    const i = Math.floor(x * this.N / this.config.width)
    const j = Math.floor(y * this.N / this.config.height)
    if (i < 0 || i >= this.N || j < 0 || j >= this.N) return 0
    return this.density[this.IX(i, j)]
  }

  /**
   * Get velocity at grid position
   */
  getVelocity(x: number, y: number): Vector2 {
    const i = Math.floor(x * this.N / this.config.width)
    const j = Math.floor(y * this.N / this.config.height)
    if (i < 0 || i >= this.N || j < 0 || j >= this.N) return Vector2.zero()
    const idx = this.IX(i, j)
    return new Vector2(this.velocityX[idx], this.velocityY[idx])
  }

  /**
   * Get color at grid position
   */
  getColor(x: number, y: number): [number, number, number] {
    const i = Math.floor(x * this.N / this.config.width)
    const j = Math.floor(y * this.N / this.config.height)
    if (i < 0 || i >= this.N || j < 0 || j >= this.N) return [0, 0, 0]
    const idx = this.IX(i, j)
    return [this.colorR[idx], this.colorG[idx], this.colorB[idx]]
  }

  /**
   * Render to canvas
   */
  render(
    ctx: CanvasRenderingContext2D,
    options: {
      showDensity?: boolean
      showVelocity?: boolean
      velocityScale?: number
      colorMode?: 'density' | 'velocity' | 'pressure' | 'vorticity' | 'color'
    } = {}
  ): void {
    const {
      showDensity = true,
      showVelocity = false,
      velocityScale = 10,
      colorMode = 'density'
    } = options

    const N = this.N
    const cellWidth = this.config.width / N
    const cellHeight = this.config.height / N

    // Render field
    if (showDensity) {
      const imageData = ctx.createImageData(this.config.width, this.config.height)
      const data = imageData.data

      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const idx = this.IX(i, j)
          const px = Math.floor(i * cellWidth)
          const py = Math.floor(j * cellHeight)
          const pw = Math.ceil(cellWidth)
          const ph = Math.ceil(cellHeight)

          let r: number, g: number, b: number, a: number

          switch (colorMode) {
            case 'velocity': {
              const vx = this.velocityX[idx]
              const vy = this.velocityY[idx]
              const speed = Math.sqrt(vx * vx + vy * vy)
              r = Math.min(255, speed * 50)
              g = Math.min(255, Math.abs(vx) * 50)
              b = Math.min(255, Math.abs(vy) * 50)
              a = Math.min(255, speed * 100)
              break
            }
            case 'pressure': {
              const p = this.pressure[idx]
              r = p > 0 ? Math.min(255, p * 500) : 0
              g = 0
              b = p < 0 ? Math.min(255, -p * 500) : 0
              a = Math.min(255, Math.abs(p) * 500)
              break
            }
            case 'vorticity': {
              const v = this.vorticity[idx]
              r = v > 0 ? Math.min(255, v * 500) : 0
              g = 0
              b = v < 0 ? Math.min(255, -v * 500) : 0
              a = Math.min(255, Math.abs(v) * 500)
              break
            }
            case 'color': {
              const d = this.density[idx]
              r = Math.min(255, this.colorR[idx] * d * 255)
              g = Math.min(255, this.colorG[idx] * d * 255)
              b = Math.min(255, this.colorB[idx] * d * 255)
              a = Math.min(255, d * 255)
              break
            }
            default: { // density
              const d = this.density[idx]
              r = Math.min(255, d * 255)
              g = Math.min(255, d * 255)
              b = Math.min(255, d * 255)
              a = Math.min(255, d * 255)
            }
          }

          // Fill pixel block
          for (let di = 0; di < pw; di++) {
            for (let dj = 0; dj < ph; dj++) {
              const pixelX = px + di
              const pixelY = py + dj
              if (pixelX >= this.config.width || pixelY >= this.config.height) continue
              
              const pixelIdx = (pixelY * this.config.width + pixelX) * 4
              data[pixelIdx] = r
              data[pixelIdx + 1] = g
              data[pixelIdx + 2] = b
              data[pixelIdx + 3] = a
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0)
    }

    // Render velocity vectors
    if (showVelocity) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.lineWidth = 1

      const step = Math.max(1, Math.floor(N / 32))
      for (let i = 0; i < N; i += step) {
        for (let j = 0; j < N; j += step) {
          const idx = this.IX(i, j)
          const vx = this.velocityX[idx]
          const vy = this.velocityY[idx]
          
          const x = (i + 0.5) * cellWidth
          const y = (j + 0.5) * cellHeight
          
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(x + vx * velocityScale, y + vy * velocityScale)
          ctx.stroke()
        }
      }
    }

    // Render obstacles
    ctx.fillStyle = 'rgba(50, 50, 50, 1)'
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (this.obstacles[this.IX(i, j)]) {
          ctx.fillRect(i * cellWidth, j * cellHeight, cellWidth, cellHeight)
        }
      }
    }
  }

  /**
   * Get density field for external use
   */
  getDensityField(): Float32Array {
    return this.density.slice()
  }

  /**
   * Get velocity field for external use
   */
  getVelocityField(): { x: Float32Array; y: Float32Array } {
    return {
      x: this.velocityX.slice(),
      y: this.velocityY.slice()
    }
  }

  /**
   * Clear all fields
   */
  clear(): void {
    this.velocityX.fill(0)
    this.velocityY.fill(0)
    this.density.fill(0)
    this.colorR.fill(0)
    this.colorG.fill(0)
    this.colorB.fill(0)
    this.pressure.fill(0)
    this.divergence.fill(0)
    this.vorticity.fill(0)
  }

  /**
   * Get grid resolution
   */
  getResolution(): number {
    return this.N
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LATTICE BOLTZMANN METHOD (LBM)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * D2Q9 Lattice Boltzmann Method implementation
 * More physically accurate than stable fluids, better for complex flows
 */
export class LatticeBoltzmann {
  private readonly width: number
  private readonly height: number
  private readonly size: number

  // D2Q9 lattice velocities
  private static readonly cx = [0, 1, 0, -1, 0, 1, -1, -1, 1]
  private static readonly cy = [0, 0, 1, 0, -1, 1, 1, -1, -1]
  private static readonly weights = [
    4/9,   // center
    1/9, 1/9, 1/9, 1/9,   // cardinal
    1/36, 1/36, 1/36, 1/36  // diagonal
  ]
  private static readonly opposite = [0, 3, 4, 1, 2, 7, 8, 5, 6]

  // Distribution functions
  private f: Float32Array[]  // Current
  private fTemp: Float32Array[]  // Temporary (for streaming)

  // Macroscopic quantities
  private rho: Float32Array  // Density
  private ux: Float32Array   // X velocity
  private uy: Float32Array   // Y velocity

  // Obstacles
  private obstacles: Uint8Array

  // Parameters
  private omega: number  // Relaxation parameter = 1/tau

  constructor(width: number, height: number, viscosity: number = 0.02) {
    this.width = width
    this.height = height
    this.size = width * height

    // tau = 3 * viscosity + 0.5
    const tau = 3 * viscosity + 0.5
    this.omega = 1 / tau

    // Initialize distribution functions
    this.f = []
    this.fTemp = []
    for (let i = 0; i < 9; i++) {
      this.f.push(new Float32Array(this.size))
      this.fTemp.push(new Float32Array(this.size))
    }

    this.rho = new Float32Array(this.size)
    this.ux = new Float32Array(this.size)
    this.uy = new Float32Array(this.size)
    this.obstacles = new Uint8Array(this.size)

    // Initialize to equilibrium
    this.initialize()
  }

  private IX(x: number, y: number): number {
    return y * this.width + x
  }

  /**
   * Initialize to equilibrium distribution
   */
  initialize(initialRho: number = 1.0, initialUx: number = 0, initialUy: number = 0): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = this.IX(x, y)
        this.rho[idx] = initialRho
        this.ux[idx] = initialUx
        this.uy[idx] = initialUy

        this.setEquilibrium(idx, initialRho, initialUx, initialUy)
      }
    }
  }

  /**
   * Set distribution to equilibrium at a node
   */
  private setEquilibrium(idx: number, rho: number, ux: number, uy: number): void {
    const u2 = ux * ux + uy * uy

    for (let i = 0; i < 9; i++) {
      const cu = LatticeBoltzmann.cx[i] * ux + LatticeBoltzmann.cy[i] * uy
      this.f[i][idx] = LatticeBoltzmann.weights[i] * rho * (
        1 + 3 * cu + 4.5 * cu * cu - 1.5 * u2
      )
    }
  }

  /**
   * Collision step (BGK)
   */
  private collide(): void {
    for (let idx = 0; idx < this.size; idx++) {
      if (this.obstacles[idx]) continue

      // Compute macroscopic quantities
      let rho = 0
      let ux = 0
      let uy = 0

      for (let i = 0; i < 9; i++) {
        const fi = this.f[i][idx]
        rho += fi
        ux += LatticeBoltzmann.cx[i] * fi
        uy += LatticeBoltzmann.cy[i] * fi
      }

      ux /= rho
      uy /= rho

      this.rho[idx] = rho
      this.ux[idx] = ux
      this.uy[idx] = uy

      // Collision (BGK)
      const u2 = ux * ux + uy * uy

      for (let i = 0; i < 9; i++) {
        const cu = LatticeBoltzmann.cx[i] * ux + LatticeBoltzmann.cy[i] * uy
        const feq = LatticeBoltzmann.weights[i] * rho * (
          1 + 3 * cu + 4.5 * cu * cu - 1.5 * u2
        )
        this.f[i][idx] += this.omega * (feq - this.f[i][idx])
      }
    }
  }

  /**
   * Streaming step
   */
  private stream(): void {
    // Copy to temp
    for (let i = 0; i < 9; i++) {
      this.fTemp[i].set(this.f[i])
    }

    // Stream
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = this.IX(x, y)
        if (this.obstacles[idx]) continue

        for (let i = 0; i < 9; i++) {
          let srcX = x - LatticeBoltzmann.cx[i]
          let srcY = y - LatticeBoltzmann.cy[i]

          // Periodic boundaries
          if (srcX < 0) srcX = this.width - 1
          if (srcX >= this.width) srcX = 0
          if (srcY < 0) srcY = this.height - 1
          if (srcY >= this.height) srcY = 0

          const srcIdx = this.IX(srcX, srcY)

          if (this.obstacles[srcIdx]) {
            // Bounce-back from obstacle
            this.f[i][idx] = this.fTemp[LatticeBoltzmann.opposite[i]][idx]
          } else {
            this.f[i][idx] = this.fTemp[i][srcIdx]
          }
        }
      }
    }
  }

  /**
   * Main simulation step
   */
  step(): void {
    this.collide()
    this.stream()
  }

  /**
   * Add velocity at position
   */
  addForce(x: number, y: number, forceX: number, forceY: number, radius: number = 5): void {
    for (let i = -radius; i <= radius; i++) {
      for (let j = -radius; j <= radius; j++) {
        const px = x + i
        const py = y + j
        if (px < 0 || px >= this.width || py < 0 || py >= this.height) continue

        const dist = Math.sqrt(i * i + j * j)
        if (dist > radius) continue

        const strength = 1 - dist / radius
        const idx = this.IX(px, py)

        // Add force to distribution (simplified)
        for (let k = 0; k < 9; k++) {
          const cu = LatticeBoltzmann.cx[k] * forceX + LatticeBoltzmann.cy[k] * forceY
          this.f[k][idx] += strength * LatticeBoltzmann.weights[k] * 3 * cu
        }
      }
    }
  }

  /**
   * Set obstacle
   */
  setObstacle(x: number, y: number): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.obstacles[this.IX(x, y)] = 1
    }
  }

  /**
   * Clear obstacle
   */
  clearObstacle(x: number, y: number): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.obstacles[this.IX(x, y)] = 0
    }
  }

  /**
   * Get velocity at position
   */
  getVelocity(x: number, y: number): Vector2 {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return Vector2.zero()
    }
    const idx = this.IX(x, y)
    return new Vector2(this.ux[idx], this.uy[idx])
  }

  /**
   * Get density at position
   */
  getDensity(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return 0
    }
    return this.rho[this.IX(x, y)]
  }

  /**
   * Render to canvas
   */
  render(ctx: CanvasRenderingContext2D, mode: 'velocity' | 'density' | 'curl' = 'velocity'): void {
    const imageData = ctx.createImageData(this.width, this.height)
    const data = imageData.data

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = this.IX(x, y)
        const pixelIdx = idx * 4

        if (this.obstacles[idx]) {
          data[pixelIdx] = 50
          data[pixelIdx + 1] = 50
          data[pixelIdx + 2] = 50
          data[pixelIdx + 3] = 255
          continue
        }

        let r: number, g: number, b: number

        switch (mode) {
          case 'velocity': {
            const speed = Math.sqrt(this.ux[idx] * this.ux[idx] + this.uy[idx] * this.uy[idx])
            const s = Math.min(1, speed * 20)
            // HSV to RGB (hue based on direction)
            const angle = Math.atan2(this.uy[idx], this.ux[idx])
            const hue = (angle + Math.PI) / (2 * Math.PI)
            const [hr, hg, hb] = this.hsvToRgb(hue, s, Math.sqrt(s))
            r = hr
            g = hg
            b = hb
            break
          }
          case 'density': {
            const d = (this.rho[idx] - 0.5) * 2
            r = Math.min(255, Math.max(0, 128 + d * 128))
            g = Math.min(255, Math.max(0, 128 + d * 64))
            b = Math.min(255, Math.max(0, 128 - d * 128))
            break
          }
          case 'curl': {
            // Compute local curl
            const dudx = x < this.width - 1 ? this.uy[this.IX(x + 1, y)] - this.uy[idx] : 0
            const dvdy = y < this.height - 1 ? this.ux[this.IX(x, y + 1)] - this.ux[idx] : 0
            const curl = dudx - dvdy
            r = curl > 0 ? Math.min(255, curl * 1000) : 0
            g = 0
            b = curl < 0 ? Math.min(255, -curl * 1000) : 0
            break
          }
        }

        data[pixelIdx] = r
        data[pixelIdx + 1] = g
        data[pixelIdx + 2] = b
        data[pixelIdx + 3] = 255
      }
    }

    ctx.putImageData(imageData, 0, 0)
  }

  private hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    let r: number, g: number, b: number

    const i = Math.floor(h * 6)
    const f = h * 6 - i
    const p = v * (1 - s)
    const q = v * (1 - f * s)
    const t = v * (1 - (1 - f) * s)

    switch (i % 6) {
      case 0: r = v; g = t; b = p; break
      case 1: r = q; g = v; b = p; break
      case 2: r = p; g = v; b = t; break
      case 3: r = p; g = q; b = v; break
      case 4: r = t; g = p; b = v; break
      default: r = v; g = p; b = q; break
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
  }

  /**
   * Clear all
   */
  clear(): void {
    for (let i = 0; i < 9; i++) {
      this.f[i].fill(0)
    }
    this.rho.fill(1)
    this.ux.fill(0)
    this.uy.fill(0)
    this.initialize()
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INFECTION FLOW SIMULATOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Combines fluid dynamics with infection spread visualization
 */
export class InfectionFluidSimulator {
  private fluid: StableFluids
  private territories: Map<number, { x: number; y: number; color: [number, number, number] }> = new Map()
  private infectionQueue: Array<{ from: number; to: number; timestamp: number }> = []
  
  constructor(width: number, height: number) {
    this.fluid = new StableFluids({
      width,
      height,
      viscosity: 0.001,
      diffusion: 0.0005,
      vorticityConfinement: 0.2,
      dissipation: 0.995
    })
  }

  /**
   * Register a territory (hex cell) with its position and color
   */
  registerTerritory(id: number, x: number, y: number, color: [number, number, number]): void {
    this.territories.set(id, { x, y, color })
  }

  /**
   * Record an infection event
   */
  recordInfection(fromId: number, toId: number): void {
    this.infectionQueue.push({
      from: fromId,
      to: toId,
      timestamp: Date.now()
    })
  }

  /**
   * Update simulation
   */
  update(dt: number): void {
    // Process infection queue
    const now = Date.now()
    const maxAge = 500 // ms
    
    while (this.infectionQueue.length > 0 && now - this.infectionQueue[0].timestamp > maxAge) {
      this.infectionQueue.shift()
    }

    // Add fluid forces from recent infections
    for (const event of this.infectionQueue) {
      const from = this.territories.get(event.from)
      const to = this.territories.get(event.to)
      if (!from || !to) continue

      const age = now - event.timestamp
      const strength = 1 - age / maxAge

      // Direction of infection
      const dx = to.x - from.x
      const dy = to.y - from.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist === 0) continue

      const nx = dx / dist
      const ny = dy / dist

      // Add fluid impulse
      this.fluid.addForce(
        from.x + nx * dist * 0.5,
        from.y + ny * dist * 0.5,
        nx * strength * 50,
        ny * strength * 50,
        10
      )

      // Add colored density
      this.fluid.addDensity(
        from.x + nx * dist * 0.5,
        from.y + ny * dist * 0.5,
        strength * 0.5,
        8,
        from.color
      )
    }

    // Step fluid simulation
    this.fluid.step(dt)
  }

  /**
   * Render fluid
   */
  render(ctx: CanvasRenderingContext2D): void {
    this.fluid.render(ctx, { colorMode: 'color' })
  }

  /**
   * Get underlying fluid simulation
   */
  getFluid(): StableFluids {
    return this.fluid
  }

  /**
   * Clear simulation
   */
  clear(): void {
    this.fluid.clear()
    this.territories.clear()
    this.infectionQueue = []
  }
}
