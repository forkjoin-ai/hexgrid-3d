import { Vector2 } from './Vector3';

type Point = [number, number];

export interface KDTreeResult<T> {
  data: T;
  distance: number;
}

export class KDTree<T> {
  private points: Point[];
  private data: T[];

  private constructor(points: Point[], data: T[]) {
    this.points = points;
    this.data = data;
  }

  static build<T>(points: Point[], data: T[], _dimensions: number): KDTree<T> {
    return new KDTree(points, data);
  }

  kNearest(target: Point, k: number): Array<KDTreeResult<T>> {
    const results = this.points.map((point, index) => ({
      data: this.data[index],
      distance: KDTree.distance(point, target),
    }));

    return results.sort((a, b) => a.distance - b.distance).slice(0, k);
  }

  rangeQuery(target: Point, radius: number): Array<KDTreeResult<T>> {
    return this.points
      .map((point, index) => ({
        data: this.data[index],
        distance: KDTree.distance(point, target),
      }))
      .filter((result) => result.distance <= radius);
  }

  private static distance(a: Point, b: Point): number {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
  }
}

export interface SpatialHashEntry<T> {
  data: T;
  position: Point;
}

export class SpatialHashGrid<T> {
  private cellSize: number;
  private grid: Map<string, SpatialHashEntry<T>[]> = new Map();

  constructor(cellSize: number, _dimensions: number) {
    this.cellSize = cellSize;
  }

  insert(position: Point, data: T): void {
    const key = this.keyFor(position);
    const bucket = this.grid.get(key) ?? [];
    bucket.push({ data, position });
    this.grid.set(key, bucket);
  }

  query(position: Point, radius: number): Array<SpatialHashEntry<T>> {
    const cellsToCheck = this.nearbyKeys(position, radius);
    const results: Array<SpatialHashEntry<T>> = [];

    for (const key of cellsToCheck) {
      const bucket = this.grid.get(key);
      if (!bucket) continue;
      for (const entry of bucket) {
        const distance = Math.hypot(
          entry.position[0] - position[0],
          entry.position[1] - position[1]
        );
        if (distance <= radius) {
          results.push(entry);
        }
      }
    }

    return results;
  }

  private keyFor(position: Point): string {
    const x = Math.floor(position[0] / this.cellSize);
    const y = Math.floor(position[1] / this.cellSize);
    return `${x},${y}`;
  }

  private nearbyKeys(position: Point, radius: number): string[] {
    const minX = Math.floor((position[0] - radius) / this.cellSize);
    const maxX = Math.floor((position[0] + radius) / this.cellSize);
    const minY = Math.floor((position[1] - radius) / this.cellSize);
    const maxY = Math.floor((position[1] + radius) / this.cellSize);

    const keys: string[] = [];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        keys.push(`${x},${y}`);
      }
    }
    return keys;
  }
}

export interface SpatialNode {
  position: Vector2;
  data: unknown;
}
