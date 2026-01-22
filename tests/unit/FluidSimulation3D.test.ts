/**
 * Tests for FluidSimulation3D (StableFluids3D)
 */

import {
  StableFluids3D,
  PensieveFluidSimulator,
} from '../../src/algorithms/FluidSimulation3D';
import { Vector3 } from '../../src/math/Vector3';

describe('StableFluids3D', () => {
  let fluid: StableFluids3D;

  beforeEach(() => {
    fluid = new StableFluids3D({
      width: 16,
      height: 16,
      depth: 16,
      viscosity: 0.0001,
      diffusion: 0.00001,
      iterations: 4,
    });
  });

  afterEach(() => {
    fluid.clear();
  });

  describe('initialization', () => {
    it('should initialize with correct dimensions', () => {
      const dims = fluid.getDimensions();
      expect(dims.width).toBe(16);
      expect(dims.height).toBe(16);
      expect(dims.depth).toBe(16);
    });

    it('should initialize with zero density', () => {
      const density = fluid.getDensityAt(new Vector3(8, 8, 8));
      expect(density).toBe(0);
    });

    it('should initialize with zero velocity', () => {
      const velocity = fluid.getVelocityAt(new Vector3(8, 8, 8));
      expect(velocity.x).toBe(0);
      expect(velocity.y).toBe(0);
      expect(velocity.z).toBe(0);
    });
  });

  describe('addDensity', () => {
    it('should add density at specified point', () => {
      fluid.addDensity(8, 8, 8, 10, 2);
      const density = fluid.getDensityAt(new Vector3(8, 8, 8));
      expect(density).toBeGreaterThan(0);
    });

    it('should spread density within radius', () => {
      fluid.addDensity(8, 8, 8, 10, 3);
      const center = fluid.getDensityAt(new Vector3(8, 8, 8));
      const nearby = fluid.getDensityAt(new Vector3(9, 8, 8));
      expect(center).toBeGreaterThan(nearby);
      expect(nearby).toBeGreaterThan(0);
    });
  });

  describe('addForce', () => {
    it('should add velocity at specified point', () => {
      fluid.addForce(new Vector3(8, 8, 8), new Vector3(1, 0, 0), 2);
      const velocity = fluid.getVelocityAt(new Vector3(8, 8, 8));
      expect(velocity.x).toBeGreaterThan(0);
    });
  });

  describe('step', () => {
    it('should step simulation without errors', () => {
      fluid.addDensity(8, 8, 8, 10, 2);
      fluid.addForce(new Vector3(8, 8, 8), new Vector3(1, 0, 0), 2);

      expect(() => fluid.step(0.016)).not.toThrow();
    });

    it('should advect density over time', () => {
      // Add density and force
      fluid.addDensity(8, 8, 8, 100, 2);
      fluid.addForce(new Vector3(8, 8, 8), new Vector3(5, 0, 0), 3);

      const initialDensity = fluid.getDensityAt(new Vector3(8, 8, 8));

      // Step simulation multiple times
      for (let i = 0; i < 10; i++) {
        fluid.step(0.1);
      }

      // Density should have moved
      const laterDensity = fluid.getDensityAt(new Vector3(8, 8, 8));
      // Due to advection and diffusion, center density may decrease
      expect(laterDensity).toBeLessThanOrEqual(initialDensity);
    });
  });

  describe('clear', () => {
    it('should reset all fields to zero', () => {
      fluid.addDensity(8, 8, 8, 10, 2);
      fluid.addForce(new Vector3(8, 8, 8), new Vector3(1, 0, 0), 2);

      fluid.clear();

      const density = fluid.getDensityAt(new Vector3(8, 8, 8));
      const velocity = fluid.getVelocityAt(new Vector3(8, 8, 8));

      expect(density).toBe(0);
      expect(velocity.x).toBe(0);
      expect(velocity.y).toBe(0);
      expect(velocity.z).toBe(0);
    });
  });

  describe('getVelocityFields', () => {
    it('should return velocity field arrays', () => {
      const fields = fluid.getVelocityFields();
      expect(fields.x).toBeInstanceOf(Float32Array);
      expect(fields.y).toBeInstanceOf(Float32Array);
      expect(fields.z).toBeInstanceOf(Float32Array);
      expect(fields.x.length).toBe(16 * 16 * 16);
    });
  });

  describe('getDensityField', () => {
    it('should return density field array', () => {
      const field = fluid.getDensityField();
      expect(field).toBeInstanceOf(Float32Array);
      expect(field.length).toBe(16 * 16 * 16);
    });
  });
});

describe('PensieveFluidSimulator', () => {
  let simulator: PensieveFluidSimulator;

  beforeEach(() => {
    simulator = new PensieveFluidSimulator(32);
  });

  afterEach(() => {
    simulator.clear();
  });

  it('should create fluid with default size', () => {
    const defaultSimulator = new PensieveFluidSimulator();
    expect(defaultSimulator.getFluid()).toBeDefined();
  });

  it('should add memory splash', () => {
    simulator.addMemorySplash(new Vector3(16, 16, 16), 0.5);
    const density = simulator.getFluid().getDensityAt(new Vector3(16, 16, 16));
    expect(density).toBeGreaterThan(0);
  });

  it('should step simulation with swirl', () => {
    expect(() => simulator.step(0.016)).not.toThrow();
  });

  it('should get velocity at point', () => {
    const velocity = simulator.getVelocityAt(new Vector3(16, 16, 16));
    expect(velocity).toBeDefined();
    expect(velocity.x).toBeDefined();
    expect(velocity.y).toBeDefined();
    expect(velocity.z).toBeDefined();
  });

  it('should clear simulation', () => {
    simulator.addMemorySplash(new Vector3(16, 16, 16), 1);
    simulator.clear();
    const density = simulator.getFluid().getDensityAt(new Vector3(16, 16, 16));
    expect(density).toBe(0);
  });
});
