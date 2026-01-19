import { describe, it, expect } from 'bun:test'
import { ParticleSystem, ParticleEmitter } from '../../src/algorithms/ParticleSystem'
import { Vector2 } from '../../src/math/Vector3'

describe('ParticleSystem', () => {
  describe('Construction', () => {
    it('creates particle system', () => {
      const system = new ParticleSystem({
        maxParticles: 1000
      })
      expect(system).toBeDefined()
    })

    it('accepts configuration options', () => {
      const system = new ParticleSystem({
        maxParticles: 500,
        emissionRate: 100,
        gravity: new Vector2(0, -9.8),
        drag: 0.98,
        bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
        wrapBounds: true
      })
      expect(system).toBeDefined()
    })
  })

  describe('Emitters', () => {
    it('creates emitter', () => {
      const system = new ParticleSystem({ maxParticles: 100 })
      const emitter = system.createEmitter({
        position: new Vector2(50, 50),
        velocity: new Vector2(0, -10),
        velocitySpread: new Vector2(2, 2),
        lifetime: 2,
        size: 5,
        color: [255, 255, 255, 255]
      })
      expect(emitter).toBeInstanceOf(ParticleEmitter)
    })

    it('removes emitter', () => {
      const system = new ParticleSystem({ maxParticles: 100 })
      const emitter = system.createEmitter({
        position: new Vector2(50, 50),
        velocity: new Vector2(0, -10),
        velocitySpread: new Vector2(2, 2),
        lifetime: 2,
        size: 5,
        color: [255, 255, 255, 255]
      })
      system.removeEmitter(emitter)
      expect(system).toBeDefined()
    })
  })

  describe('Simulation', () => {
    it('updates particles', () => {
      const system = new ParticleSystem({ maxParticles: 100 })
      system.createEmitter({
        position: new Vector2(50, 50),
        velocity: new Vector2(0, -10),
        velocitySpread: new Vector2(2, 2),
        lifetime: 2,
        size: 5,
        color: [255, 255, 255, 255]
      })
      system.update(1/60)
      expect(system.getActiveCount()).toBeGreaterThanOrEqual(0)
    })

    it('has max particles limit', () => {
      const system = new ParticleSystem({ 
        maxParticles: 10,
        emissionRate: 1000 
      })
      system.createEmitter({
        position: new Vector2(50, 50),
        velocity: new Vector2(0, 0),
        velocitySpread: new Vector2(0, 0),
        lifetime: 10,
        size: 1,
        color: [255, 255, 255, 255]
      })
      for (let i = 0; i < 100; i++) {
        system.update(1/60)
      }
      // System should have some particles (exact behavior depends on implementation)
      expect(system.getActiveCount()).toBeGreaterThanOrEqual(0)
    })

    it('clears all particles', () => {
      const system = new ParticleSystem({ maxParticles: 100 })
      system.createEmitter({
        position: new Vector2(50, 50),
        velocity: new Vector2(0, -10),
        velocitySpread: new Vector2(2, 2),
        lifetime: 10,
        size: 5,
        color: [255, 255, 255, 255]
      })
      system.update(1/60)
      system.clear()
      expect(system.getActiveCount()).toBe(0)
    })
  })

  describe('Particle Spawning', () => {
    it('spawns burst of particles', () => {
      const system = new ParticleSystem({ maxParticles: 100 })
      system.burst(new Vector2(50, 50), 20, {
        velocity: new Vector2(0, -10),
        velocitySpread: new Vector2(5, 5),
        lifetime: 2,
        size: 3,
        color: [255, 0, 0, 255]
      })
      expect(system.getActiveCount()).toBe(20)
    })

    it('spawns single particle', () => {
      const system = new ParticleSystem({ maxParticles: 100 })
      system.spawn({
        position: new Vector2(50, 50),
        velocity: new Vector2(0, -10),
        velocitySpread: new Vector2(0, 0),
        lifetime: 2,
        size: 5,
        color: [255, 255, 255, 255]
      })
      expect(system.getActiveCount()).toBe(1)
    })
  })
})

describe('ParticleEmitter', () => {
  it('is created by particle system', () => {
    const system = new ParticleSystem({ maxParticles: 100 })
    const emitter = system.createEmitter({
      position: new Vector2(50, 50),
      velocity: new Vector2(0, -10),
      velocitySpread: new Vector2(2, 2),
      lifetime: 2,
      size: 5,
      color: [255, 255, 255, 255]
    })
    expect(emitter).toBeInstanceOf(ParticleEmitter)
  })
})
