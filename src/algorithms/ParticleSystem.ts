import { Vector2 } from '../math/Vector3';

type ParticleEffect = 'birth' | 'trail' | 'victory' | 'sparkle';

export interface ParticleConfig {
  maxParticles: number;
  gravity: Vector2;
}

export interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  alpha: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];

  addParticle(particle: Particle): void {
    this.particles.push(particle);
  }

  update(_deltaTime: number): void {
    // No-op for stub
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
    this.systems.set('default', new ParticleSystem());
  }

  triggerEffect(effect: ParticleEffect, position: Vector2, options?: { count?: number; color?: [number, number, number]; velocity?: Vector2 }): void {
    const system = this.systems.get('default');
    if (!system) return;
    const count = options?.count ?? 1;
    const color = options?.color ?? [1, 1, 1];
    for (let i = 0; i < count; i++) {
      system.addParticle({
        x: position.x,
        y: position.y,
        size: 4,
        color: `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)})`,
        alpha: 1,
      });
    }
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
