/**
 * 3D Flow Field
 *
 * A 3D vector field supporting vortices, attractors, and streamline tracing.
 * Used for creating swirling "fluid soup" motion in the Pensieve.
 */

import { Vector3 } from '../math/Vector3';

/**
 * Configuration for the flow field
 */
export interface FlowField3DConfig {
  /** Field width in cells */
  width: number;
  /** Field height in cells */
  height: number;
  /** Field depth in cells */
  depth: number;
  /** Cell size (world units per cell) */
  resolution: number;
}

/**
 * A vortex source in the flow field
 */
export interface Vortex3D {
  /** Center position */
  center: Vector3;
  /** Axis of rotation (normalized) */
  axis: Vector3;
  /** Rotational strength (positive = counterclockwise when looking along axis) */
  strength: number;
  /** Influence radius */
  radius: number;
  /** Falloff type */
  falloff: 'linear' | 'quadratic' | 'gaussian';
}

/**
 * An attractor/repeller in the flow field
 */
export interface Attractor3D {
  /** Center position */
  center: Vector3;
  /** Strength (positive = attract, negative = repel) */
  strength: number;
  /** Influence radius */
  radius: number;
  /** Falloff type */
  falloff: 'linear' | 'quadratic' | 'inverse-square';
}

/**
 * A directional source in the flow field
 */
export interface DirectionalSource3D {
  /** Position */
  position: Vector3;
  /** Direction vector (will be normalized) */
  direction: Vector3;
  /** Strength */
  strength: number;
  /** Influence radius */
  radius: number;
}

/**
 * Options for streamline tracing
 */
export interface StreamlineOptions {
  /** Maximum number of steps */
  maxSteps?: number;
  /** Step size (world units) */
  stepSize?: number;
  /** Minimum velocity magnitude to continue tracing */
  minVelocity?: number;
  /** Whether to trace backwards as well */
  bidirectional?: boolean;
}

/**
 * Full field sample including velocity, divergence, and curl
 */
export interface FieldSample {
  /** Velocity at the sampled point */
  velocity: Vector3;
  /** Divergence (scalar) - measure of "outward flow" */
  divergence: number;
  /** Curl (vector) - measure of rotation */
  curl: Vector3;
}

/**
 * 3D Flow Field with vortices, attractors, and sources
 */
export class FlowField3D {
  protected width: number;
  protected height: number;
  protected depth: number;
  protected resolution: number;
  protected size: number;

  // Velocity field storage
  protected fieldX: Float32Array;
  protected fieldY: Float32Array;
  protected fieldZ: Float32Array;

  // Sources
  protected vortices: Vortex3D[] = [];
  protected attractors: Attractor3D[] = [];
  protected sources: DirectionalSource3D[] = [];

  // Noise for turbulence
  protected noiseTime: number = 0;

  constructor(config: FlowField3DConfig) {
    this.width = Math.max(1, Math.round(config.width));
    this.height = Math.max(1, Math.round(config.height));
    this.depth = Math.max(1, Math.round(config.depth));
    this.resolution = config.resolution;
    this.size = this.width * this.height * this.depth;

    this.fieldX = new Float32Array(this.size);
    this.fieldY = new Float32Array(this.size);
    this.fieldZ = new Float32Array(this.size);
  }

  /**
   * Add a vortex to the field
   */
  addVortex(
    center: Vector3,
    axis: Vector3,
    strength: number,
    radius: number,
    falloff: Vortex3D['falloff'] = 'quadratic'
  ): void {
    // Normalize axis
    const len = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
    const normalizedAxis = new Vector3(
      axis.x / len,
      axis.y / len,
      axis.z / len
    );

    this.vortices.push({
      center,
      axis: normalizedAxis,
      strength,
      radius,
      falloff,
    });
  }

  /**
   * Add an attractor (positive strength) or repeller (negative strength)
   */
  addAttractor(
    center: Vector3,
    strength: number,
    radius: number = 10,
    falloff: Attractor3D['falloff'] = 'inverse-square'
  ): void {
    this.attractors.push({
      center,
      strength,
      radius,
      falloff,
    });
  }

  /**
   * Add a directional source
   */
  addSource(
    position: Vector3,
    velocity: Vector3,
    strength: number,
    radius: number = 5
  ): void {
    // Normalize direction
    const len = Math.sqrt(
      velocity.x * velocity.x +
        velocity.y * velocity.y +
        velocity.z * velocity.z
    );
    const direction =
      len > 0
        ? new Vector3(velocity.x / len, velocity.y / len, velocity.z / len)
        : new Vector3(0, 1, 0);

    this.sources.push({
      position,
      direction,
      strength,
      radius,
    });
  }

  /**
   * Clear all sources
   */
  clearSources(): void {
    this.vortices = [];
    this.attractors = [];
    this.sources = [];
  }

  /**
   * Sample the velocity at a world position
   */
  sample(position: Vector3): Vector3 {
    let vx = 0;
    let vy = 0;
    let vz = 0;

    // Contribution from vortices
    for (const vortex of this.vortices) {
      const contribution = this.sampleVortex(position, vortex);
      vx += contribution.x;
      vy += contribution.y;
      vz += contribution.z;
    }

    // Contribution from attractors
    for (const attractor of this.attractors) {
      const contribution = this.sampleAttractor(position, attractor);
      vx += contribution.x;
      vy += contribution.y;
      vz += contribution.z;
    }

    // Contribution from directional sources
    for (const source of this.sources) {
      const contribution = this.sampleSource(position, source);
      vx += contribution.x;
      vy += contribution.y;
      vz += contribution.z;
    }

    return new Vector3(vx, vy, vz);
  }

  /**
   * Sample the full field including curl and divergence
   */
  sampleFull(position: Vector3): FieldSample {
    const velocity = this.sample(position);

    // Compute curl numerically
    const h = this.resolution * 0.5;
    const vxp = this.sample(
      new Vector3(position.x + h, position.y, position.z)
    );
    const vxm = this.sample(
      new Vector3(position.x - h, position.y, position.z)
    );
    const vyp = this.sample(
      new Vector3(position.x, position.y + h, position.z)
    );
    const vym = this.sample(
      new Vector3(position.x, position.y - h, position.z)
    );
    const vzp = this.sample(
      new Vector3(position.x, position.y, position.z + h)
    );
    const vzm = this.sample(
      new Vector3(position.x, position.y, position.z - h)
    );

    const curl = new Vector3(
      (vyp.z - vym.z - vzp.y + vzm.y) / (2 * h),
      (vzp.x - vzm.x - vxp.z + vxm.z) / (2 * h),
      (vxp.y - vxm.y - vyp.x + vym.x) / (2 * h)
    );

    const divergence =
      (vxp.x - vxm.x + vyp.y - vym.y + vzp.z - vzm.z) / (2 * h);

    return { velocity, curl, divergence };
  }

  /**
   * Trace a streamline from a starting point
   */
  traceStreamline(start: Vector3, options: StreamlineOptions = {}): Vector3[] {
    const maxSteps = options.maxSteps ?? 100;
    const stepSize = options.stepSize ?? this.resolution;
    const minVelocity = options.minVelocity ?? 0.001;
    const bidirectional = options.bidirectional ?? false;

    const points: Vector3[] = [start];

    // Trace forward
    let pos = new Vector3(start.x, start.y, start.z);
    for (let i = 0; i < maxSteps; i++) {
      const vel = this.sample(pos);
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);

      if (speed < minVelocity) break;

      // Normalize and step
      pos = new Vector3(
        pos.x + (vel.x / speed) * stepSize,
        pos.y + (vel.y / speed) * stepSize,
        pos.z + (vel.z / speed) * stepSize
      );
      points.push(pos);
    }

    // Trace backward
    if (bidirectional) {
      pos = new Vector3(start.x, start.y, start.z);
      const backwardPoints: Vector3[] = [];

      for (let i = 0; i < maxSteps; i++) {
        const vel = this.sample(pos);
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);

        if (speed < minVelocity) break;

        // Normalize and step backward
        pos = new Vector3(
          pos.x - (vel.x / speed) * stepSize,
          pos.y - (vel.y / speed) * stepSize,
          pos.z - (vel.z / speed) * stepSize
        );
        backwardPoints.unshift(pos);
      }

      return [...backwardPoints, ...points];
    }

    return points;
  }

  /**
   * Update the flow field (for time-varying fields)
   */
  update(dt: number): void {
    this.noiseTime += dt;
  }

  /**
   * Get field dimensions
   */
  getDimensions(): {
    width: number;
    height: number;
    depth: number;
    resolution: number;
  } {
    return {
      width: this.width,
      height: this.height,
      depth: this.depth,
      resolution: this.resolution,
    };
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  private sampleVortex(pos: Vector3, vortex: Vortex3D): Vector3 {
    // Vector from vortex center to position
    const dx = pos.x - vortex.center.x;
    const dy = pos.y - vortex.center.y;
    const dz = pos.z - vortex.center.z;

    // Project onto plane perpendicular to axis
    // p_proj = p - (p . axis) * axis
    const dot = dx * vortex.axis.x + dy * vortex.axis.y + dz * vortex.axis.z;
    const px = dx - dot * vortex.axis.x;
    const py = dy - dot * vortex.axis.y;
    const pz = dz - dot * vortex.axis.z;

    // Distance in plane
    const planeDist = Math.sqrt(px * px + py * py + pz * pz);

    if (planeDist < 0.001) {
      return new Vector3(0, 0, 0);
    }

    // Calculate falloff
    let falloff: number;
    const normalizedDist = planeDist / vortex.radius;

    if (normalizedDist > 1) {
      falloff = 0;
    } else {
      switch (vortex.falloff) {
        case 'linear':
          falloff = 1 - normalizedDist;
          break;
        case 'quadratic':
          falloff = (1 - normalizedDist) * (1 - normalizedDist);
          break;
        case 'gaussian':
          falloff = Math.exp(-normalizedDist * normalizedDist * 3);
          break;
        default:
          falloff = 1 - normalizedDist;
      }
    }

    // Cross product: axis x (pos - center) gives tangent direction
    // This creates circular motion around the axis
    const tx = vortex.axis.y * pz - vortex.axis.z * py;
    const ty = vortex.axis.z * px - vortex.axis.x * pz;
    const tz = vortex.axis.x * py - vortex.axis.y * px;

    // Normalize and apply strength
    const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz);
    if (tLen < 0.001) {
      return new Vector3(0, 0, 0);
    }

    const strength = vortex.strength * falloff;
    return new Vector3(
      (tx / tLen) * strength,
      (ty / tLen) * strength,
      (tz / tLen) * strength
    );
  }

  private sampleAttractor(pos: Vector3, attractor: Attractor3D): Vector3 {
    const dx = attractor.center.x - pos.x;
    const dy = attractor.center.y - pos.y;
    const dz = attractor.center.z - pos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < 0.001 || dist > attractor.radius) {
      return new Vector3(0, 0, 0);
    }

    // Calculate falloff
    let strength: number;
    const normalizedDist = dist / attractor.radius;

    switch (attractor.falloff) {
      case 'linear':
        strength = attractor.strength * (1 - normalizedDist);
        break;
      case 'quadratic':
        strength =
          attractor.strength * (1 - normalizedDist) * (1 - normalizedDist);
        break;
      case 'inverse-square':
        // Clamped inverse square to avoid singularity
        strength = attractor.strength / Math.max(1, dist * dist);
        break;
      default:
        strength = attractor.strength * (1 - normalizedDist);
    }

    // Direction towards/away from attractor
    const invDist = 1 / dist;
    return new Vector3(
      dx * invDist * strength,
      dy * invDist * strength,
      dz * invDist * strength
    );
  }

  private sampleSource(pos: Vector3, source: DirectionalSource3D): Vector3 {
    const dx = pos.x - source.position.x;
    const dy = pos.y - source.position.y;
    const dz = pos.z - source.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist > source.radius) {
      return new Vector3(0, 0, 0);
    }

    const falloff = 1 - dist / source.radius;
    const strength = source.strength * falloff;

    return new Vector3(
      source.direction.x * strength,
      source.direction.y * strength,
      source.direction.z * strength
    );
  }
}

/**
 * Pensieve-specific flow field with aesthetic presets
 */
export class PensieveFlowField extends FlowField3D {
  constructor(size: number = 100) {
    super({
      width: size,
      height: size,
      depth: size,
      resolution: 1,
    });

    // Add default swirling vortices for the pensieve "soup" effect
    this.addDefaultVortices();
  }

  /**
   * Add default vortices for pensieve aesthetic
   */
  private addDefaultVortices(): void {
    const dims = this.getDimensions();
    const center = dims.width / 2;

    // Central upward spiral
    this.addVortex(
      new Vector3(center, center * 0.3, center),
      new Vector3(0, 1, 0),
      2,
      center * 0.8,
      'gaussian'
    );

    // Secondary horizontal vortices
    this.addVortex(
      new Vector3(center * 0.7, center, center),
      new Vector3(1, 0.3, 0),
      1,
      center * 0.4,
      'quadratic'
    );

    this.addVortex(
      new Vector3(center * 1.3, center, center),
      new Vector3(-1, 0.3, 0),
      1,
      center * 0.4,
      'quadratic'
    );

    // Gentle central attractor to keep particles from flying away
    this.addAttractor(
      new Vector3(center, center, center),
      0.5,
      center * 1.5,
      'linear'
    );
  }

  /**
   * Add mouse interaction force
   */
  addMouseForce(
    position: Vector3,
    direction: Vector3,
    strength: number = 5
  ): void {
    // Temporarily add a directional source
    this.addSource(position, direction, strength, 10);
  }

  /**
   * Clear mouse forces (call after interaction ends)
   */
  clearMouseForces(): void {
    // Remove all directional sources but keep vortices and attractors
    const vorticesCopy = [...this.vortices];
    const attractorsCopy = [...this.attractors];
    this.clearSources();
    for (const v of vorticesCopy) {
      this.addVortex(v.center, v.axis, v.strength, v.radius, v.falloff);
    }
    for (const a of attractorsCopy) {
      this.addAttractor(a.center, a.strength, a.radius, a.falloff);
    }
  }
}
