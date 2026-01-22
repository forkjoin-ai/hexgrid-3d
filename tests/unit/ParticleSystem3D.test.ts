/**
 * Tests for ParticleSystem3D
 */

import {
  ParticleSystem3D,
  PensieveParticleSystem,
} from '../../src/algorithms/ParticleSystem3D';
import { Vector3 } from '../../src/math/Vector3';

describe('ParticleSystem3D', () => {
  let system: ParticleSystem3D;

  beforeEach(() => {
    system = new ParticleSystem3D({
      maxParticles: 100,
      gravity: new Vector3(0, -0.1, 0),
      drag: 0.99,
      boundsSphereRadius: 50,
      boundsCenter: new Vector3(0, 0, 0),
      bounceFactor: 0.5,
    });
  });

  afterEach(() => {
    system.clear();
  });

  describe('emit', () => {
    it('should emit a single particle', () => {
      const ids = system.emit(new Vector3(0, 0, 0));
      expect(ids).toHaveLength(1);
      expect(system.getCount()).toBe(1);
    });

    it('should emit multiple particles', () => {
      const ids = system.emit(new Vector3(0, 0, 0), { count: 5 });
      expect(ids).toHaveLength(5);
      expect(system.getCount()).toBe(5);
    });

    it('should apply color to emitted particles', () => {
      system.emit(new Vector3(0, 0, 0), { color: [1, 0, 0] });
      const particles = system.getParticles();
      expect(particles[0].color).toEqual([1, 0, 0]);
    });

    it('should apply size to emitted particles', () => {
      system.emit(new Vector3(0, 0, 0), { size: 2 });
      const particles = system.getParticles();
      expect(particles[0].size).toBe(2);
    });

    it('should respect max particles limit', () => {
      for (let i = 0; i < 150; i++) {
        system.emit(new Vector3(0, 0, 0));
      }
      expect(system.getCount()).toBeLessThanOrEqual(100);
    });
  });

  describe('setParticle', () => {
    it('should add a persistent particle', () => {
      system.setParticle('test-1', {
        id: 'test-1',
        position: new Vector3(10, 10, 10),
        velocity: new Vector3(0, 0, 0),
        color: [1, 1, 1],
        size: 1,
        life: Infinity,
        maxLife: Infinity,
        mass: 1,
      });

      const particle = system.getParticle('test-1');
      expect(particle).toBeDefined();
      expect(particle?.position.x).toBe(10);
    });

    it('should update existing particle', () => {
      system.setParticle('test-1', {
        id: 'test-1',
        position: new Vector3(10, 10, 10),
        velocity: new Vector3(0, 0, 0),
        color: [1, 1, 1],
        size: 1,
        life: Infinity,
        maxLife: Infinity,
        mass: 1,
      });

      system.setParticle('test-1', {
        id: 'test-1',
        position: new Vector3(20, 20, 20),
        velocity: new Vector3(0, 0, 0),
        color: [1, 0, 0],
        size: 2,
        life: Infinity,
        maxLife: Infinity,
        mass: 1,
      });

      const particle = system.getParticle('test-1');
      expect(particle?.position.x).toBe(20);
      expect(particle?.color).toEqual([1, 0, 0]);
    });
  });

  describe('removeParticle', () => {
    it('should remove particle by id', () => {
      system.setParticle('test-1', {
        id: 'test-1',
        position: new Vector3(0, 0, 0),
        velocity: new Vector3(0, 0, 0),
        color: [1, 1, 1],
        size: 1,
        life: Infinity,
        maxLife: Infinity,
        mass: 1,
      });

      system.removeParticle('test-1');
      expect(system.getParticle('test-1')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update particle positions', () => {
      system.emit(new Vector3(0, 0, 0), {
        velocity: new Vector3(10, 0, 0),
      });

      const initialPos = system.getParticles()[0].position.x;
      system.update(0.1);
      const newPos = system.getParticles()[0].position.x;

      expect(newPos).toBeGreaterThan(initialPos);
    });

    it('should apply gravity', () => {
      system.emit(new Vector3(0, 10, 0), {
        velocity: new Vector3(0, 0, 0),
      });

      system.update(0.1);
      const particle = system.getParticles()[0];

      expect(particle.velocity.y).toBeLessThan(0);
    });

    it('should remove dead particles', () => {
      system.emit(new Vector3(0, 0, 0), { life: 0.05 });
      expect(system.getCount()).toBe(1);

      system.update(0.1);
      expect(system.getCount()).toBe(0);
    });

    it('should not remove particles with infinite life', () => {
      system.setParticle('persistent', {
        id: 'persistent',
        position: new Vector3(0, 0, 0),
        velocity: new Vector3(0, 0, 0),
        color: [1, 1, 1],
        size: 1,
        life: Infinity,
        maxLife: Infinity,
        mass: 1,
      });

      for (let i = 0; i < 100; i++) {
        system.update(0.1);
      }

      expect(system.getParticle('persistent')).toBeDefined();
    });

    it('should update pulse scale for particles with heartRate', () => {
      system.setParticle('biometric', {
        id: 'biometric',
        position: new Vector3(0, 0, 0),
        velocity: new Vector3(0, 0, 0),
        color: [1, 1, 1],
        size: 1,
        life: Infinity,
        maxLife: Infinity,
        mass: 1,
        heartRate: 60,
      });

      system.update(0.5);
      const particle = system.getParticle('biometric');
      expect(particle?.pulseScale).toBeDefined();
    });
  });

  describe('bounds collision', () => {
    it('should bounce particles off sphere boundary', () => {
      system.emit(new Vector3(48, 0, 0), {
        velocity: new Vector3(100, 0, 0),
      });

      for (let i = 0; i < 10; i++) {
        system.update(0.1);
      }

      const particle = system.getParticles()[0];
      const distFromCenter = Math.sqrt(
        particle.position.x ** 2 +
          particle.position.y ** 2 +
          particle.position.z ** 2
      );

      expect(distFromCenter).toBeLessThanOrEqual(50);
    });
  });

  describe('applyForceField', () => {
    it('should apply force to all particles', () => {
      system.emit(new Vector3(0, 0, 0));

      system.applyForceField(() => new Vector3(10, 0, 0));
      system.update(0.1);

      const particle = system.getParticles()[0];
      expect(particle.velocity.x).toBeGreaterThan(0);
    });
  });

  describe('applyAttractor', () => {
    it('should pull particles toward attractor', () => {
      system.emit(new Vector3(10, 0, 0), { velocity: new Vector3(0, 0, 0) });

      system.applyAttractor(new Vector3(0, 0, 0), 100, 20);
      system.update(0.1);

      const particle = system.getParticles()[0];
      expect(particle.velocity.x).toBeLessThan(0); // Moving toward origin
    });
  });

  describe('getInstanceData', () => {
    it('should return GPU-ready data', () => {
      system.emit(new Vector3(1, 2, 3), { color: [1, 0, 0], size: 2 });

      const data = system.getInstanceData();

      expect(data.positions).toBeInstanceOf(Float32Array);
      expect(data.colors).toBeInstanceOf(Float32Array);
      expect(data.scales).toBeInstanceOf(Float32Array);
      expect(data.count).toBe(1);
      expect(data.ids).toHaveLength(1);
    });

    it('should include position data', () => {
      system.emit(new Vector3(1, 2, 3));

      const data = system.getInstanceData();

      expect(data.positions[0]).toBe(1);
      expect(data.positions[1]).toBe(2);
      expect(data.positions[2]).toBe(3);
    });
  });

  describe('findNearest', () => {
    it('should find nearest particle', () => {
      system.setParticle('a', {
        id: 'a',
        position: new Vector3(10, 0, 0),
        velocity: new Vector3(0, 0, 0),
        color: [1, 1, 1],
        size: 1,
        life: Infinity,
        maxLife: Infinity,
        mass: 1,
      });

      system.setParticle('b', {
        id: 'b',
        position: new Vector3(5, 0, 0),
        velocity: new Vector3(0, 0, 0),
        color: [1, 1, 1],
        size: 1,
        life: Infinity,
        maxLife: Infinity,
        mass: 1,
      });

      const nearest = system.findNearest(new Vector3(0, 0, 0));
      expect(nearest?.id).toBe('b');
    });

    it('should return null if no particles within maxDistance', () => {
      system.setParticle('far', {
        id: 'far',
        position: new Vector3(100, 0, 0),
        velocity: new Vector3(0, 0, 0),
        color: [1, 1, 1],
        size: 1,
        life: Infinity,
        maxLife: Infinity,
        mass: 1,
      });

      const nearest = system.findNearest(new Vector3(0, 0, 0), 10);
      expect(nearest).toBeNull();
    });
  });

  describe('findWithinRadius', () => {
    it('should find particles within radius', () => {
      system.setParticle('near', {
        id: 'near',
        position: new Vector3(5, 0, 0),
        velocity: new Vector3(0, 0, 0),
        color: [1, 1, 1],
        size: 1,
        life: Infinity,
        maxLife: Infinity,
        mass: 1,
      });

      system.setParticle('far', {
        id: 'far',
        position: new Vector3(20, 0, 0),
        velocity: new Vector3(0, 0, 0),
        color: [1, 1, 1],
        size: 1,
        life: Infinity,
        maxLife: Infinity,
        mass: 1,
      });

      const found = system.findWithinRadius(new Vector3(0, 0, 0), 10);
      expect(found).toHaveLength(1);
      expect(found[0].id).toBe('near');
    });
  });

  describe('clear', () => {
    it('should remove all particles', () => {
      system.emit(new Vector3(0, 0, 0), { count: 10 });
      expect(system.getCount()).toBe(10);

      system.clear();
      expect(system.getCount()).toBe(0);
    });
  });
});

describe('PensieveParticleSystem', () => {
  let system: PensieveParticleSystem;

  beforeEach(() => {
    system = new PensieveParticleSystem(100);
  });

  afterEach(() => {
    system.clear();
  });

  it('should create with default settings', () => {
    expect(system.getCount()).toBe(0);
  });

  it('should add memory particle', () => {
    system.addMemoryParticle('memory-1', new Vector3(0, 0, 0), [1, 0.5, 0]);
    expect(system.getCount()).toBe(1);
  });

  it('should add memory particle with options', () => {
    system.addMemoryParticle('memory-1', new Vector3(0, 0, 0), [1, 0.5, 0], {
      intensity: 0.8,
      heartRate: 72,
      hrvValue: 45,
      ageFactor: 0.9,
    });

    const particle = system.getParticle('memory-1');
    expect(particle?.heartRate).toBe(72);
    expect(particle?.hrvValue).toBe(45);
  });

  it('should apply age factor to color', () => {
    system.addMemoryParticle('memory-1', new Vector3(0, 0, 0), [1, 1, 1], {
      ageFactor: 0.5,
    });

    const particle = system.getParticle('memory-1');
    expect(particle?.color[0]).toBe(0.5);
    expect(particle?.color[1]).toBe(0.5);
    expect(particle?.color[2]).toBe(0.5);
  });

  it('should create particles with infinite life', () => {
    system.addMemoryParticle('memory-1', new Vector3(0, 0, 0), [1, 1, 1]);

    const particle = system.getParticle('memory-1');
    expect(particle?.life).toBe(Infinity);
  });
});
