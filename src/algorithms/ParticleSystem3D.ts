/**
 * 3D Particle System
 *
 * GPU-friendly particle physics for React Three Fiber InstancedMesh rendering.
 * Supports forces, attractors, fluid coupling, and biometric visualization.
 */

import { Vector3 } from '../math/Vector3';
import type { StableFluids3D } from './FluidSimulation3D';

/**
 * A single 3D particle
 */
export interface Particle3D {
  /** Unique identifier */
  id: string;
  /** 3D position */
  position: Vector3;
  /** 3D velocity */
  velocity: Vector3;
  /** 3D acceleration (accumulated forces) */
  acceleration: Vector3;
  /** RGB color (0-1 range) */
  color: [number, number, number];
  /** Base size */
  size: number;
  /** Current life remaining (seconds) */
  life: number;
  /** Maximum life (seconds) */
  maxLife: number;
  /** Mass for physics calculations */
  mass: number;
  /** Custom data attached to particle */
  userData?: Record<string, unknown>;

  // Biometric visualization
  /** Heart rate in BPM - affects pulse animation */
  heartRate?: number;
  /** HRV in ms - affects stability/jitter */
  hrvValue?: number;
  /** Current pulse scale (computed each frame) */
  pulseScale?: number;
}

/**
 * Options for emitting particles
 */
export interface EmitOptions {
  /** Number of particles to emit */
  count?: number;
  /** RGB color (0-1 range) */
  color?: [number, number, number];
  /** Initial velocity */
  velocity?: Vector3;
  /** Velocity spread (random variation) */
  velocitySpread?: Vector3;
  /** Initial size */
  size?: number;
  /** Size spread (random variation) */
  sizeSpread?: number;
  /** Particle lifetime in seconds */
  life?: number;
  /** Life spread (random variation) */
  lifeSpread?: number;
  /** Particle mass */
  mass?: number;
  /** Custom user data */
  userData?: Record<string, unknown>;
  /** Heart rate for biometric visualization */
  heartRate?: number;
  /** HRV for biometric visualization */
  hrvValue?: number;
}

/**
 * Configuration for the particle system
 */
export interface ParticleSystem3DConfig {
  /** Maximum number of particles */
  maxParticles: number;
  /** Global gravity vector */
  gravity?: Vector3;
  /** Global drag coefficient (0-1, where 1 = no drag) */
  drag?: number;
  /** Bounds for particle containment (spherical) */
  boundsSphereRadius?: number;
  /** Bounds center */
  boundsCenter?: Vector3;
  /** Bounce factor when hitting bounds (0 = absorb, 1 = perfect bounce) */
  bounceFactor?: number;
}

/**
 * Instance data for GPU rendering
 */
export interface InstanceData {
  /** Flat array of positions [x,y,z, x,y,z, ...] */
  positions: Float32Array;
  /** Flat array of colors [r,g,b, r,g,b, ...] */
  colors: Float32Array;
  /** Flat array of scales [s, s, s, ...] */
  scales: Float32Array;
  /** Number of active particles */
  count: number;
  /** Particle IDs in order */
  ids: string[];
}

/**
 * 3D Particle System with GPU-friendly output
 */
export class ParticleSystem3D {
  private particles: Map<string, Particle3D> = new Map();
  private particleOrder: string[] = [];
  private maxParticles: number;
  private gravity: Vector3;
  private drag: number;
  private boundsSphereRadius: number;
  private boundsCenter: Vector3;
  private bounceFactor: number;
  private time: number = 0;
  private idCounter: number = 0;

  // Pre-allocated buffers for GPU data
  private positionBuffer: Float32Array;
  private colorBuffer: Float32Array;
  private scaleBuffer: Float32Array;

  constructor(config: ParticleSystem3DConfig) {
    this.maxParticles = config.maxParticles;
    this.gravity = config.gravity ?? new Vector3(0, 0, 0);
    this.drag = config.drag ?? 0.99;
    this.boundsSphereRadius = config.boundsSphereRadius ?? Infinity;
    this.boundsCenter = config.boundsCenter ?? new Vector3(0, 0, 0);
    this.bounceFactor = config.bounceFactor ?? 0.5;

    // Pre-allocate buffers
    this.positionBuffer = new Float32Array(this.maxParticles * 3);
    this.colorBuffer = new Float32Array(this.maxParticles * 3);
    this.scaleBuffer = new Float32Array(this.maxParticles);
  }

  /**
   * Emit particles at a position
   */
  emit(position: Vector3, options: EmitOptions = {}): string[] {
    const count = options.count ?? 1;
    const emittedIds: string[] = [];

    for (let i = 0; i < count; i++) {
      if (this.particles.size >= this.maxParticles) {
        // Remove oldest particle
        const oldest = this.particleOrder.shift();
        if (oldest) {
          this.particles.delete(oldest);
        }
      }

      const id = `p_${this.idCounter++}`;
      const spread = options.velocitySpread ?? new Vector3(0, 0, 0);
      const sizeSpread = options.sizeSpread ?? 0;
      const lifeSpread = options.lifeSpread ?? 0;

      const particle: Particle3D = {
        id,
        position: new Vector3(position.x, position.y, position.z),
        velocity: new Vector3(
          (options.velocity?.x ?? 0) + (Math.random() - 0.5) * 2 * spread.x,
          (options.velocity?.y ?? 0) + (Math.random() - 0.5) * 2 * spread.y,
          (options.velocity?.z ?? 0) + (Math.random() - 0.5) * 2 * spread.z
        ),
        acceleration: new Vector3(0, 0, 0),
        color: options.color ?? [1, 1, 1],
        size: (options.size ?? 1) + (Math.random() - 0.5) * 2 * sizeSpread,
        life: (options.life ?? 5) + (Math.random() - 0.5) * 2 * lifeSpread,
        maxLife: options.life ?? 5,
        mass: options.mass ?? 1,
        userData: options.userData,
        heartRate: options.heartRate,
        hrvValue: options.hrvValue,
        pulseScale: 1,
      };

      this.particles.set(id, particle);
      this.particleOrder.push(id);
      emittedIds.push(id);
    }

    return emittedIds;
  }

  /**
   * Add or update a persistent particle (for memory particles that don't expire)
   */
  setParticle(
    id: string,
    particle: Omit<Particle3D, 'acceleration' | 'pulseScale'>
  ): void {
    const existing = this.particles.get(id);
    if (existing) {
      // Update existing
      Object.assign(existing, particle);
      existing.acceleration = new Vector3(0, 0, 0);
    } else {
      // Add new
      if (this.particles.size >= this.maxParticles) {
        // Remove oldest non-persistent particle
        for (let i = 0; i < this.particleOrder.length; i++) {
          const oldId = this.particleOrder[i];
          const oldParticle = this.particles.get(oldId);
          if (oldParticle && oldParticle.life !== Infinity) {
            this.particles.delete(oldId);
            this.particleOrder.splice(i, 1);
            break;
          }
        }
      }

      const newParticle: Particle3D = {
        ...particle,
        acceleration: new Vector3(0, 0, 0),
        pulseScale: 1,
      };
      this.particles.set(id, newParticle);
      this.particleOrder.push(id);
    }
  }

  /**
   * Remove a particle by ID
   */
  removeParticle(id: string): void {
    this.particles.delete(id);
    const idx = this.particleOrder.indexOf(id);
    if (idx >= 0) {
      this.particleOrder.splice(idx, 1);
    }
  }

  /**
   * Get a particle by ID
   */
  getParticle(id: string): Particle3D | undefined {
    return this.particles.get(id);
  }

  /**
   * Apply a force field to all particles
   */
  applyForceField(field: (pos: Vector3) => Vector3): void {
    Array.from(this.particles.values()).forEach((particle) => {
      const force = field(particle.position);
      particle.acceleration.x += force.x / particle.mass;
      particle.acceleration.y += force.y / particle.mass;
      particle.acceleration.z += force.z / particle.mass;
    });
  }

  /**
   * Apply an attractor force
   */
  applyAttractor(
    center: Vector3,
    strength: number,
    falloffRadius: number
  ): void {
    Array.from(this.particles.values()).forEach((particle) => {
      const dx = center.x - particle.position.x;
      const dy = center.y - particle.position.y;
      const dz = center.z - particle.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist > 0.001) {
        const falloff = Math.max(0, 1 - dist / falloffRadius);
        const force = (strength * falloff * falloff) / (dist * dist);
        const invDist = 1 / dist;
        particle.acceleration.x += (dx * invDist * force) / particle.mass;
        particle.acceleration.y += (dy * invDist * force) / particle.mass;
        particle.acceleration.z += (dz * invDist * force) / particle.mass;
      }
    });
  }

  /**
   * Apply velocity from a fluid simulation
   */
  applyFluidVelocity(fluid: StableFluids3D, strength: number = 1): void {
    Array.from(this.particles.values()).forEach((particle) => {
      const fluidVel = fluid.getVelocityAt(particle.position);
      particle.velocity.x += fluidVel.x * strength;
      particle.velocity.y += fluidVel.y * strength;
      particle.velocity.z += fluidVel.z * strength;
    });
  }

  /**
   * Update all particles
   */
  update(dt: number): void {
    this.time += dt;
    const deadParticles: string[] = [];

    Array.from(this.particles.values()).forEach((particle) => {
      // Apply gravity
      particle.acceleration.x += this.gravity.x;
      particle.acceleration.y += this.gravity.y;
      particle.acceleration.z += this.gravity.z;

      // Integrate velocity
      particle.velocity.x += particle.acceleration.x * dt;
      particle.velocity.y += particle.acceleration.y * dt;
      particle.velocity.z += particle.acceleration.z * dt;

      // Apply drag
      particle.velocity.x *= this.drag;
      particle.velocity.y *= this.drag;
      particle.velocity.z *= this.drag;

      // Integrate position
      particle.position.x += particle.velocity.x * dt;
      particle.position.y += particle.velocity.y * dt;
      particle.position.z += particle.velocity.z * dt;

      // Reset acceleration
      particle.acceleration.x = 0;
      particle.acceleration.y = 0;
      particle.acceleration.z = 0;

      // Sphere bounds collision
      if (this.boundsSphereRadius < Infinity) {
        const dx = particle.position.x - this.boundsCenter.x;
        const dy = particle.position.y - this.boundsCenter.y;
        const dz = particle.position.z - this.boundsCenter.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist > this.boundsSphereRadius) {
          // Push back inside
          const invDist = 1 / dist;
          const nx = dx * invDist;
          const ny = dy * invDist;
          const nz = dz * invDist;

          particle.position.x =
            this.boundsCenter.x + nx * this.boundsSphereRadius * 0.99;
          particle.position.y =
            this.boundsCenter.y + ny * this.boundsSphereRadius * 0.99;
          particle.position.z =
            this.boundsCenter.z + nz * this.boundsSphereRadius * 0.99;

          // Reflect velocity
          const dot =
            particle.velocity.x * nx +
            particle.velocity.y * ny +
            particle.velocity.z * nz;
          particle.velocity.x =
            (particle.velocity.x - 2 * dot * nx) * this.bounceFactor;
          particle.velocity.y =
            (particle.velocity.y - 2 * dot * ny) * this.bounceFactor;
          particle.velocity.z =
            (particle.velocity.z - 2 * dot * nz) * this.bounceFactor;
        }
      }

      // Update biometric pulse
      if (particle.heartRate) {
        const pulseFreq = particle.heartRate / 60; // Hz
        const pulse = Math.sin(this.time * pulseFreq * Math.PI * 2);
        particle.pulseScale = 1 + pulse * 0.15; // 15% size variation
      }

      // Decrease life (skip for Infinity life)
      if (particle.life !== Infinity) {
        particle.life -= dt;
        if (particle.life <= 0) {
          deadParticles.push(particle.id);
        }
      }
    });

    // Remove dead particles
    deadParticles.forEach((id) => {
      this.particles.delete(id);
      const idx = this.particleOrder.indexOf(id);
      if (idx >= 0) {
        this.particleOrder.splice(idx, 1);
      }
    });
  }

  /**
   * Get instance data for React Three Fiber InstancedMesh
   */
  getInstanceData(): InstanceData {
    const count = this.particles.size;
    const ids: string[] = [];

    let i = 0;
    const entries = Array.from(this.particles.entries());
    for (let j = 0; j < entries.length && i < this.maxParticles; j++) {
      const [id, particle] = entries[j];

      // Position
      this.positionBuffer[i * 3] = particle.position.x;
      this.positionBuffer[i * 3 + 1] = particle.position.y;
      this.positionBuffer[i * 3 + 2] = particle.position.z;

      // Color with life-based alpha (encoded in color for now)
      const lifeFactor =
        particle.life === Infinity
          ? 1
          : Math.min(1, particle.life / particle.maxLife);
      this.colorBuffer[i * 3] = particle.color[0] * lifeFactor;
      this.colorBuffer[i * 3 + 1] = particle.color[1] * lifeFactor;
      this.colorBuffer[i * 3 + 2] = particle.color[2] * lifeFactor;

      // Scale with pulse
      this.scaleBuffer[i] = particle.size * (particle.pulseScale ?? 1);

      ids.push(id);
      i++;
    }

    return {
      positions: this.positionBuffer.subarray(0, count * 3),
      colors: this.colorBuffer.subarray(0, count * 3),
      scales: this.scaleBuffer.subarray(0, count),
      count,
      ids,
    };
  }

  /**
   * Get all particles
   */
  getParticles(): Particle3D[] {
    return Array.from(this.particles.values());
  }

  /**
   * Get particle count
   */
  getCount(): number {
    return this.particles.size;
  }

  /**
   * Clear all particles
   */
  clear(): void {
    this.particles.clear();
    this.particleOrder = [];
  }

  /**
   * Find particle nearest to a point
   */
  findNearest(
    point: Vector3,
    maxDistance: number = Infinity
  ): Particle3D | null {
    let nearest: Particle3D | null = null;
    let nearestDist = maxDistance;

    Array.from(this.particles.values()).forEach((particle) => {
      const dist = particle.position.distanceTo(point);
      if (dist < nearestDist) {
        nearest = particle;
        nearestDist = dist;
      }
    });

    return nearest;
  }

  /**
   * Find all particles within a radius
   */
  findWithinRadius(center: Vector3, radius: number): Particle3D[] {
    const results: Particle3D[] = [];
    const r2 = radius * radius;

    Array.from(this.particles.values()).forEach((particle) => {
      const dx = particle.position.x - center.x;
      const dy = particle.position.y - center.y;
      const dz = particle.position.z - center.z;
      if (dx * dx + dy * dy + dz * dz <= r2) {
        results.push(particle);
      }
    });

    return results;
  }
}

/**
 * Pensieve-specific particle system with memory visualization presets
 */
export class PensieveParticleSystem extends ParticleSystem3D {
  constructor(maxParticles: number = 10000) {
    super({
      maxParticles,
      gravity: new Vector3(0, -0.1, 0), // Gentle downward drift
      drag: 0.995,
      boundsSphereRadius: 50,
      boundsCenter: new Vector3(0, 0, 0),
      bounceFactor: 0.3,
    });
  }

  /**
   * Add a memory particle with reflection data
   */
  addMemoryParticle(
    id: string,
    position: Vector3,
    color: [number, number, number],
    options: {
      intensity?: number;
      heartRate?: number;
      hrvValue?: number;
      ageFactor?: number;
      userData?: Record<string, unknown>;
    } = {}
  ): void {
    const size = 0.5 + (options.intensity ?? 0.5) * 0.5;
    const ageFactor = options.ageFactor ?? 1;

    this.setParticle(id, {
      id,
      position,
      velocity: new Vector3(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5
      ),
      color: [color[0] * ageFactor, color[1] * ageFactor, color[2] * ageFactor],
      size,
      life: Infinity, // Memory particles don't expire
      maxLife: Infinity,
      mass: 1,
      heartRate: options.heartRate,
      hrvValue: options.hrvValue,
      userData: options.userData,
    });
  }
}
