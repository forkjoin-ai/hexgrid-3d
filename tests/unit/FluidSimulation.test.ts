import { describe, it, expect } from 'bun:test';
import { StableFluids } from '../../src/algorithms/FluidSimulation';

describe('FluidSimulation', () => {
  describe('StableFluids', () => {
    describe('Construction', () => {
      it('creates fluid simulation', () => {
        const fluid = new StableFluids({
          width: 64,
          height: 64,
        });
        expect(fluid).toBeDefined();
      });

      it('uses default configuration', () => {
        const fluid = new StableFluids({
          width: 32,
          height: 32,
        });
        expect(fluid).toBeDefined();
      });

      it('accepts custom configuration', () => {
        const fluid = new StableFluids({
          width: 64,
          height: 64,
          diffusion: 0.001,
          viscosity: 0.0001,
          pressureIterations: 30,
          dt: 0.02,
          vorticityConfinement: 0.2,
          dissipation: 0.99,
        });
        expect(fluid).toBeDefined();
      });
    });

    describe('Simulation', () => {
      it('steps simulation', () => {
        const fluid = new StableFluids({
          width: 32,
          height: 32,
        });
        // Should not throw
        fluid.step();
        expect(fluid).toBeDefined();
      });
    });

    describe('Sources', () => {
      it('adds density source', () => {
        const fluid = new StableFluids({
          width: 32,
          height: 32,
        });
        fluid.addSource({
          x: 16,
          y: 16,
          radius: 3,
          density: 1,
          velocityX: 0,
          velocityY: 0,
        });
        expect(fluid).toBeDefined();
      });

      it('adds velocity source', () => {
        const fluid = new StableFluids({
          width: 32,
          height: 32,
        });
        fluid.addSource({
          x: 16,
          y: 16,
          radius: 3,
          density: 0,
          velocityX: 5,
          velocityY: 3,
        });
        expect(fluid).toBeDefined();
      });

      it('adds colored source', () => {
        const fluid = new StableFluids({
          width: 32,
          height: 32,
        });
        fluid.addSource({
          x: 16,
          y: 16,
          radius: 3,
          density: 1,
          velocityX: 1,
          velocityY: 0,
          color: [255, 0, 0],
        });
        expect(fluid).toBeDefined();
      });
    });

    describe('Data Access', () => {
      it('gets density at position', () => {
        const fluid = new StableFluids({
          width: 32,
          height: 32,
        });
        const density = fluid.getDensity(16, 16);
        expect(typeof density).toBe('number');
      });

      it('gets velocity at position', () => {
        const fluid = new StableFluids({
          width: 32,
          height: 32,
        });
        const velocity = fluid.getVelocity(16, 16);
        expect(typeof velocity.x).toBe('number');
        expect(typeof velocity.y).toBe('number');
      });

      it('gets color at position', () => {
        const fluid = new StableFluids({
          width: 32,
          height: 32,
        });
        const color = fluid.getColor(16, 16);
        expect(color.length).toBe(3);
      });

      it('gets density field', () => {
        const fluid = new StableFluids({
          width: 32,
          height: 32,
        });
        const field = fluid.getDensityField();
        expect(field).toBeInstanceOf(Float32Array);
      });

      it('gets velocity field', () => {
        const fluid = new StableFluids({
          width: 32,
          height: 32,
        });
        const { x, y } = fluid.getVelocityField();
        expect(x).toBeInstanceOf(Float32Array);
        expect(y).toBeInstanceOf(Float32Array);
      });
    });
  });
});
