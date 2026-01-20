import { Vector2 } from '../math/Vector3';

export interface FlowFieldConfig {
  width: number;
  height: number;
  resolution: number;
}

export interface Streamline {
  points: Vector2[];
}

interface Source {
  x: number;
  y: number;
  vx: number;
  vy: number;
  strength: number;
}

export class FlowField2D {
  private config: FlowFieldConfig;
  private sources: Source[] = [];

  constructor(config: FlowFieldConfig) {
    this.config = config;
  }

  clear(): void {
    this.sources = [];
  }

  addSource(x: number, y: number, vx: number, vy: number, strength: number): void {
    this.sources.push({ x, y, vx, vy, strength });
  }

  update(_deltaTime: number): void {
    // No-op for stub
  }

  sample(x: number, y: number): Vector2 {
    if (this.sources.length === 0) {
      return new Vector2(0, 0);
    }
    let vx = 0;
    let vy = 0;
    for (const source of this.sources) {
      const dx = x - source.x;
      const dy = y - source.y;
      const distance = Math.hypot(dx, dy) || 1;
      const influence = source.strength / distance;
      vx += source.vx * influence;
      vy += source.vy * influence;
    }
    return new Vector2(vx, vy);
  }

  sampleFull(x: number, y: number): { velocity: Vector2; divergence: number; curl: number } {
    const velocity = this.sample(x, y);
    return {
      velocity,
      divergence: velocity.x * 0.01,
      curl: velocity.y * 0.01,
    };
  }

  traceStreamline(x: number, y: number, options: { maxLength: number; stepSize: number; maxSteps: number }): Streamline {
    const points: Vector2[] = [new Vector2(x, y)];
    let current = new Vector2(x, y);
    for (let i = 0; i < options.maxSteps; i++) {
      const velocity = this.sample(current.x, current.y);
      const next = new Vector2(
        current.x + velocity.x * options.stepSize,
        current.y + velocity.y * options.stepSize
      );
      points.push(next);
      current = next;
      if (points.length * options.stepSize >= options.maxLength) {
        break;
      }
    }
    return { points };
  }
}

export class InfectionFlowAnalyzer {
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getFlowData(
    _infections: Map<number, unknown>,
    _positions: Array<{ x: number; y: number }>
  ): Array<{ centroid: Vector2; velocity: Vector2 }> {
    return [];
  }
}

export class HeatMap {
  private width: number;
  private height: number;
  private resolution: number;
  private data: Float32Array;

  constructor(config: { width: number; height: number; resolution: number; kernelRadius: number }) {
    this.width = Math.max(1, Math.round(config.width / config.resolution));
    this.height = Math.max(1, Math.round(config.height / config.resolution));
    this.resolution = config.resolution;
    this.data = new Float32Array(this.width * this.height);
  }

  addPoint(x: number, y: number, value: number): void {
    const gridX = Math.min(this.width - 1, Math.max(0, Math.floor(x / this.resolution)));
    const gridY = Math.min(this.height - 1, Math.max(0, Math.floor(y / this.resolution)));
    const index = gridY * this.width + gridX;
    this.data[index] += value;
  }

  getData(): Float32Array {
    return this.data;
  }
}
