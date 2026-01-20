export interface FluidConfig {
  width: number;
  height: number;
  viscosity: number;
  diffusion: number;
}

export class StableFluids {
  private width: number;
  private height: number;
  private density: Float32Array;
  private velocityX: Float32Array;
  private velocityY: Float32Array;

  constructor(config: FluidConfig) {
    this.width = Math.max(1, Math.round(config.width));
    this.height = Math.max(1, Math.round(config.height));
    const size = this.width * this.height;
    this.density = new Float32Array(size);
    this.velocityX = new Float32Array(size);
    this.velocityY = new Float32Array(size);
  }

  addDensity(x: number, y: number, amount: number, radius: number): void {
    const index = this.indexFor(x, y);
    this.density[index] += amount;
  }

  addForce(x: number, y: number, vx: number, vy: number, _radius: number): void {
    const index = this.indexFor(x, y);
    this.velocityX[index] += vx;
    this.velocityY[index] += vy;
  }

  step(_deltaTime: number): void {
    // Simple damping
    for (let i = 0; i < this.velocityX.length; i++) {
      this.velocityX[i] *= 0.98;
      this.velocityY[i] *= 0.98;
    }
  }

  getDensity(x: number, y: number): number {
    return this.density[this.indexFor(x, y)] || 0;
  }

  getVelocity(x: number, y: number): { x: number; y: number } {
    const index = this.indexFor(x, y);
    return { x: this.velocityX[index] || 0, y: this.velocityY[index] || 0 };
  }

  getDensityField(): Float32Array {
    return this.density;
  }

  getVelocityField(): { x: Float32Array; y: Float32Array } {
    return { x: this.velocityX, y: this.velocityY };
  }

  clear(): void {
    this.density.fill(0);
    this.velocityX.fill(0);
    this.velocityY.fill(0);
  }

  private indexFor(x: number, y: number): number {
    const ix = Math.min(this.width - 1, Math.max(0, Math.floor(x)));
    const iy = Math.min(this.height - 1, Math.max(0, Math.floor(y)));
    return iy * this.width + ix;
  }
}

export class LatticeBoltzmann {
  constructor(_width: number, _height: number) {}
}

export class InfectionFluidSimulator {
  private fluid: StableFluids;

  constructor(width: number, height: number) {
    this.fluid = new StableFluids({ width, height, viscosity: 0, diffusion: 0 });
  }

  registerTerritory(_ownerId: number, x: number, y: number, intensity: number): void {
    this.fluid.addDensity(x, y, intensity, 1);
  }

  update(deltaTime: number): void {
    this.fluid.step(deltaTime);
  }

  getFluid(): StableFluids {
    return this.fluid;
  }

  clear(): void {
    this.fluid.clear();
  }
}
