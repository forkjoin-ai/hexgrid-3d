import { Vector2 } from '../math/Vector3';

type ParticleEffect = 'birth' | 'trail' | 'victory' | 'sparkle';

export interface ParticleConfig {
  maxParticles: number;
  gravity?: Vector2;
}

export interface ParticleSystemConfig {
  maxParticles: number;
  emissionRate?: number;
  gravity?: Vector2;
  drag?: number;
  bounds?: { minX: number; maxX: number; minY: number; maxY: number };
  wrapBounds?: boolean;
}

export interface EmitterConfig {
  position: Vector2;
  velocity: Vector2;
  velocitySpread: Vector2;
  lifetime: number;
  size: number;
  color: [number, number, number, number];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  lifetime: number;
  age: number;
}

export class ParticleEmitter {
  config: EmitterConfig;

  constructor(config: EmitterConfig) {
    this.config = config;
  }

  emit(): Particle {
    const spreadX = (Math.random() - 0.5) * 2 * this.config.velocitySpread.x;
    const spreadY = (Math.random() - 0.5) * 2 * this.config.velocitySpread.y;
    const c = this.config.color;
    return {
      x: this.config.position.x,
      y: this.config.position.y,
      vx: this.config.velocity.x + spreadX,
      vy: this.config.velocity.y + spreadY,
      size: this.config.size,
      color: `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3] / 255})`,
      alpha: 1,
      lifetime: this.config.lifetime,
      age: 0,
    };
  }
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private emitters: ParticleEmitter[] = [];
  private config: ParticleSystemConfig;

  constructor(config: ParticleSystemConfig) {
    this.config = config;
  }

  createEmitter(emitterConfig: EmitterConfig): ParticleEmitter {
    const emitter = new ParticleEmitter(emitterConfig);
    this.emitters.push(emitter);
    return emitter;
  }

  removeEmitter(emitter: ParticleEmitter): void {
    const idx = this.emitters.indexOf(emitter);
    if (idx !== -1) {
      this.emitters.splice(idx, 1);
    }
  }

  update(deltaTime: number): void {
    // Emit from emitters
    const rate = this.config.emissionRate ?? 10;
    const toEmit = Math.floor(rate * deltaTime);
    for (const emitter of this.emitters) {
      for (let i = 0; i < toEmit; i++) {
        if (this.particles.length >= this.config.maxParticles) break;
        this.particles.push(emitter.emit());
      }
    }

    // Update particles
    const gravity = this.config.gravity ?? new Vector2(0, 0);
    const drag = this.config.drag ?? 1;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += deltaTime;
      if (p.age >= p.lifetime) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vx += gravity.x * deltaTime;
      p.vy += gravity.y * deltaTime;
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.alpha = 1 - p.age / p.lifetime;
    }
  }

  burst(
    position: Vector2,
    count: number,
    options: {
      velocity: Vector2;
      velocitySpread: Vector2;
      lifetime: number;
      size: number;
      color: [number, number, number, number];
    }
  ): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.config.maxParticles) break;
      const spreadX = (Math.random() - 0.5) * 2 * options.velocitySpread.x;
      const spreadY = (Math.random() - 0.5) * 2 * options.velocitySpread.y;
      const c = options.color;
      this.particles.push({
        x: position.x,
        y: position.y,
        vx: options.velocity.x + spreadX,
        vy: options.velocity.y + spreadY,
        size: options.size,
        color: `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3] / 255})`,
        alpha: 1,
        lifetime: options.lifetime,
        age: 0,
      });
    }
  }

  spawn(config: EmitterConfig): void {
    if (this.particles.length >= this.config.maxParticles) return;
    const c = config.color;
    const spreadX = (Math.random() - 0.5) * 2 * config.velocitySpread.x;
    const spreadY = (Math.random() - 0.5) * 2 * config.velocitySpread.y;
    this.particles.push({
      x: config.position.x,
      y: config.position.y,
      vx: config.velocity.x + spreadX,
      vy: config.velocity.y + spreadY,
      size: config.size,
      color: `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3] / 255})`,
      alpha: 1,
      lifetime: config.lifetime,
      age: 0,
    });
  }

  getActiveCount(): number {
    return this.particles.length;
  }

  getPositions(): Particle[] {
    return this.particles;
  }

  clear(): void {
    this.particles = [];
  }
}

export class ParticleEffectManager {
  private systems: Map<string, ParticleSystem> = new Map();
  private config: ParticleConfig;

  constructor(config: ParticleConfig) {
    this.config = config;
    this.systems.set(
      'default',
      new ParticleSystem({ maxParticles: config.maxParticles })
    );
  }

  triggerEffect(
    effect: ParticleEffect,
    position: Vector2,
    options?: {
      count?: number;
      color?: [number, number, number];
      velocity?: Vector2;
    }
  ): void {
    const system = this.systems.get('default');
    if (!system) return;
    const count = options?.count ?? 1;
    const color = options?.color ?? [1, 1, 1];
    system.burst(position, count, {
      velocity: options?.velocity ?? new Vector2(0, 0),
      velocitySpread: new Vector2(1, 1),
      lifetime: 1,
      size: 4,
      color: [
        Math.round(color[0] * 255),
        Math.round(color[1] * 255),
        Math.round(color[2] * 255),
        255,
      ],
    });
  }

  update(deltaTime: number): void {
    for (const system of this.systems.values()) {
      system.update(deltaTime);
    }
  }

  getSystem(name: string): ParticleSystem | undefined {
    return this.systems.get(name);
  }

  clearAll(): void {
    for (const system of this.systems.values()) {
      system.clear();
    }
  }
}

export const ParticlePresets: Record<string, ParticleEffect> = {
  birth: 'birth',
  trail: 'trail',
  victory: 'victory',
  sparkle: 'sparkle',
};
