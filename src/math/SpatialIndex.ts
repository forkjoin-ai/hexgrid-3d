import { Vector2, Vector3 } from './Vector3';

type _Point = number[];

export interface KDTreeResult<T> {
  data: T;
  distance: number;
}

interface KDNode<T> {
  point: number[];
  data: T;
  left: KDNode<T> | null;
  right: KDNode<T> | null;
  splitDimension: number;
}

export class KDTree<T> {
  private root: KDNode<T> | null = null;
  private dimensions: number;

  constructor(dimensions: number) {
    this.dimensions = dimensions;
  }

  static build<T>(points: number[][], data: T[]): KDTree<T> {
    if (points.length !== data.length) {
      throw new Error('points and data arrays must have the same length');
    }
    if (points.length === 0) {
      const tree = new KDTree<T>(0);
      return tree;
    }
    const dimensions = points[0].length;
    const tree = new KDTree<T>(dimensions);
    const indices = points.map((_, i) => i);
    tree.root = tree.buildRecursive(points, data, indices, 0);
    return tree;
  }

  static fromVector3<T>(vectors: Vector3[], data: T[]): KDTree<T> {
    const points = vectors.map((v) => [v.x, v.y, v.z]);
    return KDTree.build(points, data);
  }

  static fromVector2<T>(vectors: Vector2[], data: T[]): KDTree<T> {
    const points = vectors.map((v) => [v.x, v.y]);
    return KDTree.build(points, data);
  }

  private buildRecursive(
    points: number[][],
    data: T[],
    indices: number[],
    depth: number
  ): KDNode<T> | null {
    if (indices.length === 0) return null;

    const dim = depth % this.dimensions;
    indices.sort((a, b) => points[a][dim] - points[b][dim]);
    const mid = Math.floor(indices.length / 2);
    const midIndex = indices[mid];

    return {
      point: points[midIndex],
      data: data[midIndex],
      splitDimension: dim,
      left: this.buildRecursive(points, data, indices.slice(0, mid), depth + 1),
      right: this.buildRecursive(points, data, indices.slice(mid + 1), depth + 1),
    };
  }

  insert(point: number[], data: T): void {
    if (this.dimensions === 0) {
      this.dimensions = point.length;
    }
    this.root = this.insertRecursive(this.root, point, data, 0);
  }

  private insertRecursive(
    node: KDNode<T> | null,
    point: number[],
    data: T,
    depth: number
  ): KDNode<T> {
    if (node === null) {
      return {
        point,
        data,
        left: null,
        right: null,
        splitDimension: depth % this.dimensions,
      };
    }

    const dim = node.splitDimension;
    if (point[dim] < node.point[dim]) {
      node.left = this.insertRecursive(node.left, point, data, depth + 1);
    } else {
      node.right = this.insertRecursive(node.right, point, data, depth + 1);
    }
    return node;
  }

  nearestNeighbor(target: number[]): KDTreeResult<T> | null {
    if (this.root === null) return null;
    const best = { node: null as KDNode<T> | null, distance: Infinity };
    this.nearestRecursive(this.root, target, best);
    if (best.node === null) return null;
    return { data: best.node.data, distance: best.distance };
  }

  private nearestRecursive(
    node: KDNode<T> | null,
    target: number[],
    best: { node: KDNode<T> | null; distance: number }
  ): void {
    if (node === null) return;

    const dist = KDTree.distance(node.point, target);
    if (dist < best.distance) {
      best.distance = dist;
      best.node = node;
    }

    const dim = node.splitDimension;
    const diff = target[dim] - node.point[dim];
    const first = diff < 0 ? node.left : node.right;
    const second = diff < 0 ? node.right : node.left;

    this.nearestRecursive(first, target, best);
    if (Math.abs(diff) < best.distance) {
      this.nearestRecursive(second, target, best);
    }
  }

  kNearest(target: number[], k: number): Array<KDTreeResult<T>> {
    if (k <= 0) return [];
    const results: Array<KDTreeResult<T>> = [];
    this.collectAll(this.root, target, results);
    results.sort((a, b) => a.distance - b.distance);
    return results.slice(0, k);
  }

  rangeQuery(target: number[], radius: number): Array<KDTreeResult<T>> {
    const results: Array<KDTreeResult<T>> = [];
    this.rangeRecursive(this.root, target, radius, results);
    return results;
  }

  private rangeRecursive(
    node: KDNode<T> | null,
    target: number[],
    radius: number,
    results: Array<KDTreeResult<T>>
  ): void {
    if (node === null) return;

    const dist = KDTree.distance(node.point, target);
    if (dist <= radius) {
      results.push({ data: node.data, distance: dist });
    }

    const dim = node.splitDimension;
    const diff = target[dim] - node.point[dim];

    const first = diff < 0 ? node.left : node.right;
    const second = diff < 0 ? node.right : node.left;

    this.rangeRecursive(first, target, radius, results);
    if (Math.abs(diff) <= radius) {
      this.rangeRecursive(second, target, radius, results);
    }
  }

  boxQuery(min: number[], max: number[]): Array<KDTreeResult<T>> {
    const results: Array<KDTreeResult<T>> = [];
    this.boxRecursive(this.root, min, max, results);
    return results;
  }

  private boxRecursive(
    node: KDNode<T> | null,
    min: number[],
    max: number[],
    results: Array<KDTreeResult<T>>
  ): void {
    if (node === null) return;

    let inside = true;
    for (let i = 0; i < node.point.length; i++) {
      if (node.point[i] < min[i] || node.point[i] > max[i]) {
        inside = false;
        break;
      }
    }
    if (inside) {
      const dist = KDTree.distance(node.point, min);
      results.push({ data: node.data, distance: dist });
    }

    const dim = node.splitDimension;
    if (min[dim] <= node.point[dim]) {
      this.boxRecursive(node.left, min, max, results);
    }
    if (max[dim] >= node.point[dim]) {
      this.boxRecursive(node.right, min, max, results);
    }
  }

  private collectAll(
    node: KDNode<T> | null,
    target: number[],
    results: Array<KDTreeResult<T>>
  ): void {
    if (node === null) return;
    results.push({
      data: node.data,
      distance: KDTree.distance(node.point, target),
    });
    this.collectAll(node.left, target, results);
    this.collectAll(node.right, target, results);
  }

  private static distance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - b[i];
      sum += d * d;
    }
    return Math.sqrt(sum);
  }
}

export interface SpatialHashEntry<T> {
  data: T;
  position: number[];
}

export class SpatialHashGrid<T> {
  private cellSize: number;
  private dimensions: number;
  private grid: Map<string, SpatialHashEntry<T>[]> = new Map();

  constructor(cellSize: number,  dimensions: number = 3) {
    this.cellSize = cellSize;
    this.dimensions = dimensions;
  }

  insert(position: number[], data: T): void {
    const key = this.keyFor(position);
    const bucket = this.grid.get(key) ?? [];
    bucket.push({ data, position });
    this.grid.set(key, bucket);
  }

  insertAll(entries: Array<{ position: number[]; data: T }>): void {
    for (const entry of entries) {
      this.insert(entry.position, entry.data);
    }
  }

  remove(position: number[], data: T): boolean {
    const key = this.keyFor(position);
    const bucket = this.grid.get(key);
    if (!bucket) return false;
    const index = bucket.findIndex(
      (entry) => entry.data === data && this.positionsEqual(entry.position, position)
    );
    if (index === -1) return false;
    bucket.splice(index, 1);
    if (bucket.length === 0) {
      this.grid.delete(key);
    }
    return true;
  }

  clear(): void {
    this.grid.clear();
  }

  query(position: number[], radius: number): Array<SpatialHashEntry<T>> {
    const cellsToCheck = this.nearbyKeys(position, radius);
    const results: Array<SpatialHashEntry<T>> = [];

    for (const key of cellsToCheck) {
      const bucket = this.grid.get(key);
      if (!bucket) continue;
      for (const entry of bucket) {
        const dist = this.distance(entry.position, position);
        if (dist <= radius) {
          results.push(entry);
        }
      }
    }

    return results;
  }

  nearest(position: number[], searchRadius: number): SpatialHashEntry<T> | null {
    const candidates = this.query(position, searchRadius);
    if (candidates.length === 0) return null;
    let bestEntry: SpatialHashEntry<T> | null = null;
    let bestDist = Infinity;
    for (const entry of candidates) {
      const dist = this.distance(entry.position, position);
      if (dist < bestDist) {
        bestDist = dist;
        bestEntry = entry;
      }
    }
    return bestEntry;
  }

  private positionsEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  private distance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - b[i];
      sum += d * d;
    }
    return Math.sqrt(sum);
  }

  private keyFor(position: number[]): string {
    const parts: number[] = [];
    for (let i = 0; i < this.dimensions; i++) {
      parts.push(Math.floor((position[i] ?? 0) / this.cellSize));
    }
    return parts.join(',');
  }

  private nearbyKeys(position: number[], radius: number): string[] {
    const mins: number[] = [];
    const maxs: number[] = [];
    for (let i = 0; i < this.dimensions; i++) {
      const val = position[i] ?? 0;
      mins.push(Math.floor((val - radius) / this.cellSize));
      maxs.push(Math.floor((val + radius) / this.cellSize));
    }

    const keys: string[] = [];
    const coords = new Array(this.dimensions).fill(0);

    const generate = (dim: number): void => {
      if (dim === this.dimensions) {
        keys.push(coords.join(','));
        return;
      }
      for (let v = mins[dim]; v <= maxs[dim]; v++) {
        coords[dim] = v;
        generate(dim + 1);
      }
    };

    generate(0);
    return keys;
  }
}

export interface SpatialNode {
  position: Vector2;
  data: unknown;
}
