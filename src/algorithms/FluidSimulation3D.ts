/**
 * 3D Stable Fluids Implementation
 *
 * Based on Jos Stam's "Stable Fluids" paper (SIGGRAPH 1999)
 * Extended to 3D for the Pensieve particle visualization.
 *
 * Key operations:
 * 1. Add sources (density, velocity)
 * 2. Diffuse (spread quantities)
 * 3. Advect (move quantities along velocity field)
 * 4. Project (make velocity field divergence-free)
 */

import { Vector3 } from '../math/Vector3';

export interface FluidConfig3D {
  /** Grid width in cells */
  width: number;
  /** Grid height in cells */
  height: number;
  /** Grid depth in cells */
  depth: number;
  /** Viscosity coefficient (0 = inviscid, higher = more viscous) */
  viscosity: number;
  /** Diffusion rate for density (0 = no diffusion) */
  diffusion: number;
  /** Number of iterations for linear solver (higher = more accurate but slower) */
  iterations?: number;
}

/**
 * 3D Stable Fluids solver for realistic fluid dynamics
 */
export class StableFluids3D {
  private width: number;
  private height: number;
  private depth: number;
  private size: number;
  private viscosity: number;
  private diffusion: number;
  private iterations: number;

  // Current state
  private density: Float32Array;
  private velocityX: Float32Array;
  private velocityY: Float32Array;
  private velocityZ: Float32Array;

  // Previous state (for advection)
  private density0: Float32Array;
  private velocityX0: Float32Array;
  private velocityY0: Float32Array;
  private velocityZ0: Float32Array;

  constructor(config: FluidConfig3D) {
    this.width = Math.max(1, Math.round(config.width));
    this.height = Math.max(1, Math.round(config.height));
    this.depth = Math.max(1, Math.round(config.depth));
    this.size = this.width * this.height * this.depth;
    this.viscosity = config.viscosity;
    this.diffusion = config.diffusion;
    this.iterations = config.iterations ?? 4;

    // Allocate arrays
    this.density = new Float32Array(this.size);
    this.velocityX = new Float32Array(this.size);
    this.velocityY = new Float32Array(this.size);
    this.velocityZ = new Float32Array(this.size);

    this.density0 = new Float32Array(this.size);
    this.velocityX0 = new Float32Array(this.size);
    this.velocityY0 = new Float32Array(this.size);
    this.velocityZ0 = new Float32Array(this.size);
  }

  /**
   * Add density at a point with radius falloff
   */
  addDensity(
    x: number,
    y: number,
    z: number,
    amount: number,
    radius: number
  ): void {
    const r2 = radius * radius;
    const ix0 = Math.max(0, Math.floor(x - radius));
    const ix1 = Math.min(this.width - 1, Math.ceil(x + radius));
    const iy0 = Math.max(0, Math.floor(y - radius));
    const iy1 = Math.min(this.height - 1, Math.ceil(y + radius));
    const iz0 = Math.max(0, Math.floor(z - radius));
    const iz1 = Math.min(this.depth - 1, Math.ceil(z + radius));

    for (let iz = iz0; iz <= iz1; iz++) {
      for (let iy = iy0; iy <= iy1; iy++) {
        for (let ix = ix0; ix <= ix1; ix++) {
          const dx = ix - x;
          const dy = iy - y;
          const dz = iz - z;
          const dist2 = dx * dx + dy * dy + dz * dz;
          if (dist2 < r2) {
            const falloff = 1 - dist2 / r2;
            const idx = this.indexFor(ix, iy, iz);
            this.density[idx] += amount * falloff;
          }
        }
      }
    }
  }

  /**
   * Add force at a point with radius falloff
   */
  addForce(pos: Vector3, force: Vector3, radius: number): void {
    const r2 = radius * radius;
    const ix0 = Math.max(0, Math.floor(pos.x - radius));
    const ix1 = Math.min(this.width - 1, Math.ceil(pos.x + radius));
    const iy0 = Math.max(0, Math.floor(pos.y - radius));
    const iy1 = Math.min(this.height - 1, Math.ceil(pos.y + radius));
    const iz0 = Math.max(0, Math.floor(pos.z - radius));
    const iz1 = Math.min(this.depth - 1, Math.ceil(pos.z + radius));

    for (let iz = iz0; iz <= iz1; iz++) {
      for (let iy = iy0; iy <= iy1; iy++) {
        for (let ix = ix0; ix <= ix1; ix++) {
          const dx = ix - pos.x;
          const dy = iy - pos.y;
          const dz = iz - pos.z;
          const dist2 = dx * dx + dy * dy + dz * dz;
          if (dist2 < r2) {
            const falloff = 1 - dist2 / r2;
            const idx = this.indexFor(ix, iy, iz);
            this.velocityX[idx] += force.x * falloff;
            this.velocityY[idx] += force.y * falloff;
            this.velocityZ[idx] += force.z * falloff;
          }
        }
      }
    }
  }

  /**
   * Step the simulation forward by dt seconds
   */
  step(dt: number): void {
    // Velocity step
    this.velocityStep(dt);

    // Density step
    this.densityStep(dt);
  }

  /**
   * Get velocity at a point (with trilinear interpolation)
   */
  getVelocityAt(pos: Vector3): Vector3 {
    return new Vector3(
      this.sampleField(this.velocityX, pos.x, pos.y, pos.z),
      this.sampleField(this.velocityY, pos.x, pos.y, pos.z),
      this.sampleField(this.velocityZ, pos.x, pos.y, pos.z)
    );
  }

  /**
   * Get density at a point (with trilinear interpolation)
   */
  getDensityAt(pos: Vector3): number {
    return this.sampleField(this.density, pos.x, pos.y, pos.z);
  }

  /**
   * Get the raw velocity fields for direct access
   */
  getVelocityFields(): { x: Float32Array; y: Float32Array; z: Float32Array } {
    return { x: this.velocityX, y: this.velocityY, z: this.velocityZ };
  }

  /**
   * Get the raw density field
   */
  getDensityField(): Float32Array {
    return this.density;
  }

  /**
   * Get grid dimensions
   */
  getDimensions(): { width: number; height: number; depth: number } {
    return { width: this.width, height: this.height, depth: this.depth };
  }

  /**
   * Clear all fields
   */
  clear(): void {
    this.density.fill(0);
    this.velocityX.fill(0);
    this.velocityY.fill(0);
    this.velocityZ.fill(0);
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  private velocityStep(dt: number): void {
    // Add sources
    this.addSource(this.velocityX, this.velocityX0, dt);
    this.addSource(this.velocityY, this.velocityY0, dt);
    this.addSource(this.velocityZ, this.velocityZ0, dt);

    // Diffuse
    this.swap(this.velocityX0, this.velocityX);
    this.swap(this.velocityY0, this.velocityY);
    this.swap(this.velocityZ0, this.velocityZ);

    this.diffuse(1, this.velocityX, this.velocityX0, this.viscosity, dt);
    this.diffuse(2, this.velocityY, this.velocityY0, this.viscosity, dt);
    this.diffuse(3, this.velocityZ, this.velocityZ0, this.viscosity, dt);

    // Project to make divergence-free
    this.project(
      this.velocityX,
      this.velocityY,
      this.velocityZ,
      this.velocityX0,
      this.velocityY0
    );

    // Advect
    this.swap(this.velocityX0, this.velocityX);
    this.swap(this.velocityY0, this.velocityY);
    this.swap(this.velocityZ0, this.velocityZ);

    this.advect(
      1,
      this.velocityX,
      this.velocityX0,
      this.velocityX0,
      this.velocityY0,
      this.velocityZ0,
      dt
    );
    this.advect(
      2,
      this.velocityY,
      this.velocityY0,
      this.velocityX0,
      this.velocityY0,
      this.velocityZ0,
      dt
    );
    this.advect(
      3,
      this.velocityZ,
      this.velocityZ0,
      this.velocityX0,
      this.velocityY0,
      this.velocityZ0,
      dt
    );

    // Project again
    this.project(
      this.velocityX,
      this.velocityY,
      this.velocityZ,
      this.velocityX0,
      this.velocityY0
    );
  }

  private densityStep(dt: number): void {
    // Add sources
    this.addSource(this.density, this.density0, dt);

    // Diffuse
    this.swap(this.density0, this.density);
    this.diffuse(0, this.density, this.density0, this.diffusion, dt);

    // Advect
    this.swap(this.density0, this.density);
    this.advect(
      0,
      this.density,
      this.density0,
      this.velocityX,
      this.velocityY,
      this.velocityZ,
      dt
    );
  }

  private addSource(
    target: Float32Array,
    source: Float32Array,
    dt: number
  ): void {
    for (let i = 0; i < this.size; i++) {
      target[i] += dt * source[i];
    }
    source.fill(0);
  }

  private diffuse(
    b: number,
    x: Float32Array,
    x0: Float32Array,
    diff: number,
    dt: number
  ): void {
    const a = dt * diff * this.width * this.height * this.depth;
    this.linearSolve(b, x, x0, a, 1 + 6 * a);
  }

  private advect(
    b: number,
    d: Float32Array,
    d0: Float32Array,
    u: Float32Array,
    v: Float32Array,
    w: Float32Array,
    dt: number
  ): void {
    const dtx = dt * (this.width - 2);
    const dty = dt * (this.height - 2);
    const dtz = dt * (this.depth - 2);

    for (let k = 1; k < this.depth - 1; k++) {
      for (let j = 1; j < this.height - 1; j++) {
        for (let i = 1; i < this.width - 1; i++) {
          const idx = this.indexFor(i, j, k);

          // Trace back
          let x = i - dtx * u[idx];
          let y = j - dty * v[idx];
          let z = k - dtz * w[idx];

          // Clamp to grid
          x = Math.max(0.5, Math.min(this.width - 1.5, x));
          y = Math.max(0.5, Math.min(this.height - 1.5, y));
          z = Math.max(0.5, Math.min(this.depth - 1.5, z));

          // Trilinear interpolation
          d[idx] = this.sampleField(d0, x, y, z);
        }
      }
    }

    this.setBoundary(b, d);
  }

  private project(
    u: Float32Array,
    v: Float32Array,
    w: Float32Array,
    p: Float32Array,
    div: Float32Array
  ): void {
    const h = 1.0 / Math.max(this.width, this.height, this.depth);

    // Calculate divergence
    for (let k = 1; k < this.depth - 1; k++) {
      for (let j = 1; j < this.height - 1; j++) {
        for (let i = 1; i < this.width - 1; i++) {
          const idx = this.indexFor(i, j, k);
          div[idx] =
            -0.5 *
            h *
            (u[this.indexFor(i + 1, j, k)] -
              u[this.indexFor(i - 1, j, k)] +
              v[this.indexFor(i, j + 1, k)] -
              v[this.indexFor(i, j - 1, k)] +
              w[this.indexFor(i, j, k + 1)] -
              w[this.indexFor(i, j, k - 1)]);
          p[idx] = 0;
        }
      }
    }

    this.setBoundary(0, div);
    this.setBoundary(0, p);

    // Solve for pressure
    this.linearSolve(0, p, div, 1, 6);

    // Subtract pressure gradient from velocity
    for (let k = 1; k < this.depth - 1; k++) {
      for (let j = 1; j < this.height - 1; j++) {
        for (let i = 1; i < this.width - 1; i++) {
          const idx = this.indexFor(i, j, k);
          u[idx] -=
            (0.5 *
              (p[this.indexFor(i + 1, j, k)] - p[this.indexFor(i - 1, j, k)])) /
            h;
          v[idx] -=
            (0.5 *
              (p[this.indexFor(i, j + 1, k)] - p[this.indexFor(i, j - 1, k)])) /
            h;
          w[idx] -=
            (0.5 *
              (p[this.indexFor(i, j, k + 1)] - p[this.indexFor(i, j, k - 1)])) /
            h;
        }
      }
    }

    this.setBoundary(1, u);
    this.setBoundary(2, v);
    this.setBoundary(3, w);
  }

  private linearSolve(
    b: number,
    x: Float32Array,
    x0: Float32Array,
    a: number,
    c: number
  ): void {
    const cRecip = 1.0 / c;

    for (let iter = 0; iter < this.iterations; iter++) {
      for (let k = 1; k < this.depth - 1; k++) {
        for (let j = 1; j < this.height - 1; j++) {
          for (let i = 1; i < this.width - 1; i++) {
            const idx = this.indexFor(i, j, k);
            x[idx] =
              (x0[idx] +
                a *
                  (x[this.indexFor(i + 1, j, k)] +
                    x[this.indexFor(i - 1, j, k)] +
                    x[this.indexFor(i, j + 1, k)] +
                    x[this.indexFor(i, j - 1, k)] +
                    x[this.indexFor(i, j, k + 1)] +
                    x[this.indexFor(i, j, k - 1)])) *
              cRecip;
          }
        }
      }
      this.setBoundary(b, x);
    }
  }

  private setBoundary(b: number, x: Float32Array): void {
    // Set boundary conditions (reflective for velocity, continuous for density)
    for (let k = 1; k < this.depth - 1; k++) {
      for (let j = 1; j < this.height - 1; j++) {
        x[this.indexFor(0, j, k)] =
          b === 1 ? -x[this.indexFor(1, j, k)] : x[this.indexFor(1, j, k)];
        x[this.indexFor(this.width - 1, j, k)] =
          b === 1
            ? -x[this.indexFor(this.width - 2, j, k)]
            : x[this.indexFor(this.width - 2, j, k)];
      }
    }

    for (let k = 1; k < this.depth - 1; k++) {
      for (let i = 1; i < this.width - 1; i++) {
        x[this.indexFor(i, 0, k)] =
          b === 2 ? -x[this.indexFor(i, 1, k)] : x[this.indexFor(i, 1, k)];
        x[this.indexFor(i, this.height - 1, k)] =
          b === 2
            ? -x[this.indexFor(i, this.height - 2, k)]
            : x[this.indexFor(i, this.height - 2, k)];
      }
    }

    for (let j = 1; j < this.height - 1; j++) {
      for (let i = 1; i < this.width - 1; i++) {
        x[this.indexFor(i, j, 0)] =
          b === 3 ? -x[this.indexFor(i, j, 1)] : x[this.indexFor(i, j, 1)];
        x[this.indexFor(i, j, this.depth - 1)] =
          b === 3
            ? -x[this.indexFor(i, j, this.depth - 2)]
            : x[this.indexFor(i, j, this.depth - 2)];
      }
    }

    // Corner cases - average of neighbors
    x[this.indexFor(0, 0, 0)] =
      0.33 *
      (x[this.indexFor(1, 0, 0)] +
        x[this.indexFor(0, 1, 0)] +
        x[this.indexFor(0, 0, 1)]);
    x[this.indexFor(0, this.height - 1, 0)] =
      0.33 *
      (x[this.indexFor(1, this.height - 1, 0)] +
        x[this.indexFor(0, this.height - 2, 0)] +
        x[this.indexFor(0, this.height - 1, 1)]);
    x[this.indexFor(0, 0, this.depth - 1)] =
      0.33 *
      (x[this.indexFor(1, 0, this.depth - 1)] +
        x[this.indexFor(0, 1, this.depth - 1)] +
        x[this.indexFor(0, 0, this.depth - 2)]);
    x[this.indexFor(0, this.height - 1, this.depth - 1)] =
      0.33 *
      (x[this.indexFor(1, this.height - 1, this.depth - 1)] +
        x[this.indexFor(0, this.height - 2, this.depth - 1)] +
        x[this.indexFor(0, this.height - 1, this.depth - 2)]);
    x[this.indexFor(this.width - 1, 0, 0)] =
      0.33 *
      (x[this.indexFor(this.width - 2, 0, 0)] +
        x[this.indexFor(this.width - 1, 1, 0)] +
        x[this.indexFor(this.width - 1, 0, 1)]);
    x[this.indexFor(this.width - 1, this.height - 1, 0)] =
      0.33 *
      (x[this.indexFor(this.width - 2, this.height - 1, 0)] +
        x[this.indexFor(this.width - 1, this.height - 2, 0)] +
        x[this.indexFor(this.width - 1, this.height - 1, 1)]);
    x[this.indexFor(this.width - 1, 0, this.depth - 1)] =
      0.33 *
      (x[this.indexFor(this.width - 2, 0, this.depth - 1)] +
        x[this.indexFor(this.width - 1, 1, this.depth - 1)] +
        x[this.indexFor(this.width - 1, 0, this.depth - 2)]);
    x[this.indexFor(this.width - 1, this.height - 1, this.depth - 1)] =
      0.33 *
      (x[this.indexFor(this.width - 2, this.height - 1, this.depth - 1)] +
        x[this.indexFor(this.width - 1, this.height - 2, this.depth - 1)] +
        x[this.indexFor(this.width - 1, this.height - 1, this.depth - 2)]);
  }

  private sampleField(
    field: Float32Array,
    x: number,
    y: number,
    z: number
  ): number {
    // Trilinear interpolation
    const i0 = Math.floor(x);
    const i1 = i0 + 1;
    const j0 = Math.floor(y);
    const j1 = j0 + 1;
    const k0 = Math.floor(z);
    const k1 = k0 + 1;

    const sx = x - i0;
    const sy = y - j0;
    const sz = z - k0;

    const c000 = field[this.indexForClamped(i0, j0, k0)];
    const c001 = field[this.indexForClamped(i0, j0, k1)];
    const c010 = field[this.indexForClamped(i0, j1, k0)];
    const c011 = field[this.indexForClamped(i0, j1, k1)];
    const c100 = field[this.indexForClamped(i1, j0, k0)];
    const c101 = field[this.indexForClamped(i1, j0, k1)];
    const c110 = field[this.indexForClamped(i1, j1, k0)];
    const c111 = field[this.indexForClamped(i1, j1, k1)];

    // Interpolate along x
    const c00 = c000 * (1 - sx) + c100 * sx;
    const c01 = c001 * (1 - sx) + c101 * sx;
    const c10 = c010 * (1 - sx) + c110 * sx;
    const c11 = c011 * (1 - sx) + c111 * sx;

    // Interpolate along y
    const c0 = c00 * (1 - sy) + c10 * sy;
    const c1 = c01 * (1 - sy) + c11 * sy;

    // Interpolate along z
    return c0 * (1 - sz) + c1 * sz;
  }

  private indexFor(x: number, y: number, z: number): number {
    return z * this.width * this.height + y * this.width + x;
  }

  private indexForClamped(x: number, y: number, z: number): number {
    const ix = Math.min(this.width - 1, Math.max(0, x));
    const iy = Math.min(this.height - 1, Math.max(0, y));
    const iz = Math.min(this.depth - 1, Math.max(0, z));
    return this.indexFor(ix, iy, iz);
  }

  private swap(a: Float32Array, b: Float32Array): void {
    // Swap contents efficiently
    const temp = new Float32Array(a);
    a.set(b);
    b.set(temp);
  }
}

/**
 * Pensieve-specific fluid simulator with aesthetic presets
 */
export class PensieveFluidSimulator {
  private fluid: StableFluids3D;
  private time: number = 0;

  constructor(size: number = 64) {
    this.fluid = new StableFluids3D({
      width: size,
      height: size,
      depth: size,
      viscosity: 0.0001,
      diffusion: 0.00001,
      iterations: 4,
    });
  }

  /**
   * Add a "memory splash" - when a particle enters the pensieve
   */
  addMemorySplash(position: Vector3, intensity: number): void {
    this.fluid.addDensity(
      position.x,
      position.y,
      position.z,
      intensity * 10,
      5
    );
    // Add a slight upward swirl
    this.fluid.addForce(position, new Vector3(0, intensity * 2, 0), 3);
  }

  /**
   * Add ambient swirling motion
   */
  addSwirl(dt: number): void {
    this.time += dt;
    const dims = this.fluid.getDimensions();
    const center = new Vector3(dims.width / 2, dims.height / 2, dims.depth / 2);

    // Rotating force around Y axis
    const angle = this.time * 0.5;
    const radius = dims.width * 0.3;
    const pos = new Vector3(
      center.x + Math.cos(angle) * radius,
      center.y,
      center.z + Math.sin(angle) * radius
    );
    const tangent = new Vector3(-Math.sin(angle), 0, Math.cos(angle));
    this.fluid.addForce(pos, tangent, radius * 0.5);
  }

  /**
   * Step the simulation
   */
  step(dt: number): void {
    this.addSwirl(dt);
    this.fluid.step(dt);
  }

  /**
   * Get velocity at a point for particle advection
   */
  getVelocityAt(pos: Vector3): Vector3 {
    return this.fluid.getVelocityAt(pos);
  }

  /**
   * Get the underlying fluid for direct access
   */
  getFluid(): StableFluids3D {
    return this.fluid;
  }

  /**
   * Clear the simulation
   */
  clear(): void {
    this.fluid.clear();
    this.time = 0;
  }
}
