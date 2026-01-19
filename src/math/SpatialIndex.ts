/**
 * Spatial Data Structures for High-Performance Queries
 * 
 * This module provides:
 * - KD-Tree: O(log n) nearest neighbor queries
 * - Spatial Hash Grid: O(1) average case range queries
 * - R-Tree: Hierarchical bounding box queries
 * - Ball Tree: For spherical/geodesic queries
 * 
 * These structures enable efficient neighbor detection and range queries
 * that scale to 100,000+ hexagons.
 * 
 * @module math/SpatialIndex
 */

import { Vector2, Vector3 } from './Vector3'

// ═══════════════════════════════════════════════════════════════════════════
// KD-TREE (k-Dimensional Tree)
// ═══════════════════════════════════════════════════════════════════════════

interface KDNode<T> {
  point: number[]
  data: T
  left: KDNode<T> | null
  right: KDNode<T> | null
  splitDimension: number
}

export class KDTree<T> {
  private root: KDNode<T> | null = null
  private dimensions: number

  constructor(dimensions: number = 3) {
    this.dimensions = dimensions
  }

  /**
   * Build tree from array of points with associated data
   */
  static build<T>(
    points: number[][],
    data: T[],
    dimensions: number = 3
  ): KDTree<T> {
    const tree = new KDTree<T>(dimensions)
    
    if (points.length !== data.length) {
      throw new Error('Points and data arrays must have same length')
    }

    if (points.length === 0) return tree

    // Create array of indices to sort
    const indices = points.map((_, i) => i)
    tree.root = tree.buildRecursive(points, data, indices, 0)
    
    return tree
  }

  /**
   * Build tree from Vector3 array
   */
  static fromVector3<T>(vectors: Vector3[], data: T[]): KDTree<T> {
    const points = vectors.map(v => [v.x, v.y, v.z])
    return KDTree.build(points, data, 3)
  }

  /**
   * Build tree from Vector2 array
   */
  static fromVector2<T>(vectors: Vector2[], data: T[]): KDTree<T> {
    const points = vectors.map(v => [v.x, v.y])
    return KDTree.build(points, data, 2)
  }

  private buildRecursive(
    points: number[][],
    data: T[],
    indices: number[],
    depth: number
  ): KDNode<T> | null {
    if (indices.length === 0) return null

    const dim = depth % this.dimensions

    // Sort indices by current dimension
    indices.sort((a, b) => points[a][dim] - points[b][dim])

    const medianIdx = Math.floor(indices.length / 2)
    const medianPointIdx = indices[medianIdx]

    return {
      point: points[medianPointIdx],
      data: data[medianPointIdx],
      splitDimension: dim,
      left: this.buildRecursive(points, data, indices.slice(0, medianIdx), depth + 1),
      right: this.buildRecursive(points, data, indices.slice(medianIdx + 1), depth + 1)
    }
  }

  /**
   * Insert a new point
   */
  insert(point: number[], data: T): void {
    this.root = this.insertRecursive(this.root, point, data, 0)
  }

  private insertRecursive(
    node: KDNode<T> | null,
    point: number[],
    data: T,
    depth: number
  ): KDNode<T> {
    if (!node) {
      return {
        point,
        data,
        left: null,
        right: null,
        splitDimension: depth % this.dimensions
      }
    }

    const dim = depth % this.dimensions

    if (point[dim] < node.point[dim]) {
      node.left = this.insertRecursive(node.left, point, data, depth + 1)
    } else {
      node.right = this.insertRecursive(node.right, point, data, depth + 1)
    }

    return node
  }

  /**
   * Find the nearest neighbor to a query point
   */
  nearestNeighbor(query: number[]): { point: number[]; data: T; distance: number } | null {
    if (!this.root) return null

    const best = { node: this.root, distance: this.squaredDistance(query, this.root.point) }
    this.nearestRecursive(this.root, query, best)

    return {
      point: best.node.point,
      data: best.node.data,
      distance: Math.sqrt(best.distance)
    }
  }

  private nearestRecursive(
    node: KDNode<T> | null,
    query: number[],
    best: { node: KDNode<T>; distance: number }
  ): void {
    if (!node) return

    const dist = this.squaredDistance(query, node.point)
    if (dist < best.distance) {
      best.node = node
      best.distance = dist
    }

    const dim = node.splitDimension
    const diff = query[dim] - node.point[dim]
    const diffSq = diff * diff

    // Search the nearer subtree first
    const nearer = diff < 0 ? node.left : node.right
    const farther = diff < 0 ? node.right : node.left

    this.nearestRecursive(nearer, query, best)

    // Only search farther subtree if it could contain a closer point
    if (diffSq < best.distance) {
      this.nearestRecursive(farther, query, best)
    }
  }

  /**
   * Find k nearest neighbors
   */
  kNearest(query: number[], k: number): Array<{ point: number[]; data: T; distance: number }> {
    if (!this.root || k <= 0) return []

    const heap = new MaxHeap<{ node: KDNode<T>; distance: number }>((a, b) => a.distance - b.distance)
    this.kNearestRecursive(this.root, query, k, heap)

    return heap.toArray()
      .map(item => ({
        point: item.node.point,
        data: item.node.data,
        distance: Math.sqrt(item.distance)
      }))
      .sort((a, b) => a.distance - b.distance)
  }

  private kNearestRecursive(
    node: KDNode<T> | null,
    query: number[],
    k: number,
    heap: MaxHeap<{ node: KDNode<T>; distance: number }>
  ): void {
    if (!node) return

    const dist = this.squaredDistance(query, node.point)

    if (heap.size() < k) {
      heap.push({ node, distance: dist })
    } else if (dist < heap.peek()!.distance) {
      heap.pop()
      heap.push({ node, distance: dist })
    }

    const dim = node.splitDimension
    const diff = query[dim] - node.point[dim]
    const diffSq = diff * diff

    const nearer = diff < 0 ? node.left : node.right
    const farther = diff < 0 ? node.right : node.left

    this.kNearestRecursive(nearer, query, k, heap)

    if (heap.size() < k || diffSq < heap.peek()!.distance) {
      this.kNearestRecursive(farther, query, k, heap)
    }
  }

  /**
   * Find all points within a radius
   */
  rangeQuery(center: number[], radius: number): Array<{ point: number[]; data: T; distance: number }> {
    const results: Array<{ point: number[]; data: T; distance: number }> = []
    const radiusSq = radius * radius
    this.rangeQueryRecursive(this.root, center, radiusSq, results)
    return results.map(r => ({ ...r, distance: Math.sqrt(r.distance) }))
  }

  private rangeQueryRecursive(
    node: KDNode<T> | null,
    center: number[],
    radiusSq: number,
    results: Array<{ point: number[]; data: T; distance: number }>
  ): void {
    if (!node) return

    const dist = this.squaredDistance(center, node.point)
    if (dist <= radiusSq) {
      results.push({ point: node.point, data: node.data, distance: dist })
    }

    const dim = node.splitDimension
    const diff = center[dim] - node.point[dim]
    const diffSq = diff * diff

    // Always search the side containing the center
    if (diff < 0) {
      this.rangeQueryRecursive(node.left, center, radiusSq, results)
      if (diffSq <= radiusSq) {
        this.rangeQueryRecursive(node.right, center, radiusSq, results)
      }
    } else {
      this.rangeQueryRecursive(node.right, center, radiusSq, results)
      if (diffSq <= radiusSq) {
        this.rangeQueryRecursive(node.left, center, radiusSq, results)
      }
    }
  }

  /**
   * Find all points within a bounding box
   */
  boxQuery(min: number[], max: number[]): Array<{ point: number[]; data: T }> {
    const results: Array<{ point: number[]; data: T }> = []
    this.boxQueryRecursive(this.root, min, max, results)
    return results
  }

  private boxQueryRecursive(
    node: KDNode<T> | null,
    min: number[],
    max: number[],
    results: Array<{ point: number[]; data: T }>
  ): void {
    if (!node) return

    // Check if point is in box
    let inBox = true
    for (let i = 0; i < this.dimensions; i++) {
      if (node.point[i] < min[i] || node.point[i] > max[i]) {
        inBox = false
        break
      }
    }
    if (inBox) {
      results.push({ point: node.point, data: node.data })
    }

    const dim = node.splitDimension

    // Check if we need to search left subtree
    if (min[dim] <= node.point[dim]) {
      this.boxQueryRecursive(node.left, min, max, results)
    }

    // Check if we need to search right subtree
    if (max[dim] >= node.point[dim]) {
      this.boxQueryRecursive(node.right, min, max, results)
    }
  }

  private squaredDistance(a: number[], b: number[]): number {
    let sum = 0
    for (let i = 0; i < this.dimensions; i++) {
      const diff = a[i] - b[i]
      sum += diff * diff
    }
    return sum
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SPATIAL HASH GRID (O(1) average case queries)
// ═══════════════════════════════════════════════════════════════════════════

export class SpatialHashGrid<T> {
  private grid: Map<string, Array<{ position: number[]; data: T }>> = new Map()
  private cellSize: number
  private dimensions: number

  constructor(cellSize: number, dimensions: number = 3) {
    this.cellSize = cellSize
    this.dimensions = dimensions
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.grid.clear()
  }

  /**
   * Insert a point with data
   */
  insert(position: number[], data: T): void {
    const key = this.positionToKey(position)
    
    if (!this.grid.has(key)) {
      this.grid.set(key, [])
    }
    
    this.grid.get(key)!.push({ position, data })
  }

  /**
   * Bulk insert
   */
  insertAll(items: Array<{ position: number[]; data: T }>): void {
    for (const item of items) {
      this.insert(item.position, item.data)
    }
  }

  /**
   * Remove a point (by reference equality of data)
   */
  remove(position: number[], data: T): boolean {
    const key = this.positionToKey(position)
    const cell = this.grid.get(key)
    
    if (!cell) return false
    
    const idx = cell.findIndex(item => item.data === data)
    if (idx === -1) return false
    
    cell.splice(idx, 1)
    if (cell.length === 0) {
      this.grid.delete(key)
    }
    
    return true
  }

  /**
   * Query all points within radius (O(1) average for small radius)
   */
  query(center: number[], radius: number): Array<{ position: number[]; data: T; distance: number }> {
    const results: Array<{ position: number[]; data: T; distance: number }> = []
    const radiusSq = radius * radius
    
    // Calculate cell range to check
    const minCell = this.positionToCell(center.map(c => c - radius))
    const maxCell = this.positionToCell(center.map(c => c + radius))
    
    // Iterate over all cells in range
    this.forEachCellInRange(minCell, maxCell, (cell) => {
      for (const item of cell) {
        const distSq = this.squaredDistance(center, item.position)
        if (distSq <= radiusSq) {
          results.push({
            position: item.position,
            data: item.data,
            distance: Math.sqrt(distSq)
          })
        }
      }
    })
    
    return results
  }

  /**
   * Find nearest neighbor (approximate for large grids, exact for small radius)
   */
  nearest(center: number[], maxRadius: number = Infinity): { position: number[]; data: T; distance: number } | null {
    let radius = this.cellSize
    
    while (radius <= maxRadius) {
      const results = this.query(center, radius)
      
      if (results.length > 0) {
        results.sort((a, b) => a.distance - b.distance)
        return results[0]
      }
      
      radius *= 2
    }
    
    return null
  }

  /**
   * Find k nearest (approximate)
   */
  kNearest(center: number[], k: number, maxRadius: number = Infinity): Array<{ position: number[]; data: T; distance: number }> {
    let radius = this.cellSize
    
    while (radius <= maxRadius) {
      const results = this.query(center, radius)
      
      if (results.length >= k) {
        results.sort((a, b) => a.distance - b.distance)
        return results.slice(0, k)
      }
      
      radius *= 2
    }
    
    // Return what we have if we couldn't find k
    const results = this.query(center, maxRadius)
    results.sort((a, b) => a.distance - b.distance)
    return results.slice(0, k)
  }

  /**
   * Get all items in a specific cell
   */
  getCell(cellCoords: number[]): Array<{ position: number[]; data: T }> {
    const key = cellCoords.join(',')
    return this.grid.get(key) || []
  }

  /**
   * Get statistics
   */
  getStats(): { cellCount: number; itemCount: number; averageItemsPerCell: number } {
    let itemCount = 0
    for (const cell of this.grid.values()) {
      itemCount += cell.length
    }
    
    return {
      cellCount: this.grid.size,
      itemCount,
      averageItemsPerCell: this.grid.size > 0 ? itemCount / this.grid.size : 0
    }
  }

  private positionToCell(position: number[]): number[] {
    return position.map(c => Math.floor(c / this.cellSize))
  }

  private positionToKey(position: number[]): string {
    return this.positionToCell(position).join(',')
  }

  private forEachCellInRange(
    min: number[],
    max: number[],
    callback: (cell: Array<{ position: number[]; data: T }>) => void
  ): void {
    // Generate all cell keys in range
    const iterate = (dim: number, current: number[]): void => {
      if (dim === this.dimensions) {
        const key = current.join(',')
        const cell = this.grid.get(key)
        if (cell) {
          callback(cell)
        }
        return
      }
      
      for (let i = min[dim]; i <= max[dim]; i++) {
        iterate(dim + 1, [...current, i])
      }
    }
    
    iterate(0, [])
  }

  private squaredDistance(a: number[], b: number[]): number {
    let sum = 0
    for (let i = 0; i < this.dimensions; i++) {
      const diff = a[i] - b[i]
      sum += diff * diff
    }
    return sum
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BALL TREE (for spherical/geodesic queries)
// ═══════════════════════════════════════════════════════════════════════════

interface BallNode<T> {
  center: Vector3
  radius: number
  data: T | null
  point: Vector3 | null
  left: BallNode<T> | null
  right: BallNode<T> | null
}

export class BallTree<T> {
  private root: BallNode<T> | null = null

  /**
   * Build tree from Vector3 points (on unit sphere for geodesic queries)
   */
  static build<T>(points: Vector3[], data: T[]): BallTree<T> {
    const tree = new BallTree<T>()
    
    if (points.length !== data.length || points.length === 0) {
      return tree
    }

    const indices = points.map((_, i) => i)
    tree.root = tree.buildRecursive(points, data, indices)
    
    return tree
  }

  private buildRecursive(
    points: Vector3[],
    data: T[],
    indices: number[]
  ): BallNode<T> | null {
    if (indices.length === 0) return null

    if (indices.length === 1) {
      const idx = indices[0]
      return {
        center: points[idx].clone(),
        radius: 0,
        data: data[idx],
        point: points[idx].clone(),
        left: null,
        right: null
      }
    }

    // Find bounding sphere
    const center = this.computeCentroid(points, indices)
    let maxRadius = 0
    for (const idx of indices) {
      const dist = center.distanceTo(points[idx])
      if (dist > maxRadius) maxRadius = dist
    }

    // Find dimension with largest spread
    let bestDim = 0
    let bestSpread = 0
    
    for (let dim = 0; dim < 3; dim++) {
      let min = Infinity
      let max = -Infinity
      
      for (const idx of indices) {
        const val = dim === 0 ? points[idx].x : dim === 1 ? points[idx].y : points[idx].z
        if (val < min) min = val
        if (val > max) max = val
      }
      
      const spread = max - min
      if (spread > bestSpread) {
        bestSpread = spread
        bestDim = dim
      }
    }

    // Sort by best dimension and split
    indices.sort((a, b) => {
      const va = bestDim === 0 ? points[a].x : bestDim === 1 ? points[a].y : points[a].z
      const vb = bestDim === 0 ? points[b].x : bestDim === 1 ? points[b].y : points[b].z
      return va - vb
    })

    const mid = Math.floor(indices.length / 2)

    return {
      center,
      radius: maxRadius,
      data: null,
      point: null,
      left: this.buildRecursive(points, data, indices.slice(0, mid)),
      right: this.buildRecursive(points, data, indices.slice(mid))
    }
  }

  private computeCentroid(points: Vector3[], indices: number[]): Vector3 {
    let x = 0, y = 0, z = 0
    for (const idx of indices) {
      x += points[idx].x
      y += points[idx].y
      z += points[idx].z
    }
    const n = indices.length
    return new Vector3(x / n, y / n, z / n)
  }

  /**
   * Find nearest neighbor using geodesic (great circle) distance
   */
  nearestGeodesic(query: Vector3): { point: Vector3; data: T; distance: number } | null {
    if (!this.root) return null

    const queryNorm = query.normalize()
    const best = { 
      node: this.findFirstLeaf(this.root)!, 
      distance: queryNorm.greatCircleDistanceTo(this.findFirstLeaf(this.root)!.point!) 
    }
    
    this.nearestGeodesicRecursive(this.root, queryNorm, best)

    return {
      point: best.node.point!,
      data: best.node.data!,
      distance: best.distance
    }
  }

  private findFirstLeaf(node: BallNode<T>): BallNode<T> | null {
    if (node.point) return node
    if (node.left) return this.findFirstLeaf(node.left)
    if (node.right) return this.findFirstLeaf(node.right)
    return null
  }

  private nearestGeodesicRecursive(
    node: BallNode<T> | null,
    query: Vector3,
    best: { node: BallNode<T>; distance: number }
  ): void {
    if (!node) return

    // Leaf node
    if (node.point) {
      const dist = query.greatCircleDistanceTo(node.point)
      if (dist < best.distance) {
        best.node = node
        best.distance = dist
      }
      return
    }

    // Internal node - check if we need to explore
    const centerDist = query.greatCircleDistanceTo(node.center)
    
    // If the ball is entirely farther than our best, skip
    if (centerDist - node.radius > best.distance) {
      return
    }

    // Explore children (closer first)
    const leftDist = node.left ? query.distanceTo(node.left.center) : Infinity
    const rightDist = node.right ? query.distanceTo(node.right.center) : Infinity

    if (leftDist < rightDist) {
      this.nearestGeodesicRecursive(node.left, query, best)
      this.nearestGeodesicRecursive(node.right, query, best)
    } else {
      this.nearestGeodesicRecursive(node.right, query, best)
      this.nearestGeodesicRecursive(node.left, query, best)
    }
  }

  /**
   * Find all points within geodesic radius (in radians)
   */
  rangeQueryGeodesic(query: Vector3, radiusRadians: number): Array<{ point: Vector3; data: T; distance: number }> {
    const results: Array<{ point: Vector3; data: T; distance: number }> = []
    const queryNorm = query.normalize()
    this.rangeQueryGeodesicRecursive(this.root, queryNorm, radiusRadians, results)
    return results
  }

  private rangeQueryGeodesicRecursive(
    node: BallNode<T> | null,
    query: Vector3,
    radius: number,
    results: Array<{ point: Vector3; data: T; distance: number }>
  ): void {
    if (!node) return

    if (node.point) {
      const dist = query.greatCircleDistanceTo(node.point)
      if (dist <= radius) {
        results.push({ point: node.point, data: node.data!, distance: dist })
      }
      return
    }

    const centerDist = query.greatCircleDistanceTo(node.center)
    
    // Approximate: if ball could overlap with query radius
    // This is conservative - node.radius is Euclidean but we compare geodesic
    if (centerDist - node.radius * 2 > radius) {
      return
    }

    this.rangeQueryGeodesicRecursive(node.left, query, radius, results)
    this.rangeQueryGeodesicRecursive(node.right, query, radius, results)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// R-TREE (for bounding box queries)
// ═══════════════════════════════════════════════════════════════════════════

export interface BoundingBox {
  min: number[]
  max: number[]
}

interface RTreeNode<T> {
  bbox: BoundingBox
  children: RTreeNode<T>[]
  data: T | null
  isLeaf: boolean
}

export class RTree<T> {
  private root: RTreeNode<T>
  private maxChildren: number
  private dimensions: number

  constructor(dimensions: number = 3, maxChildren: number = 16) {
    this.dimensions = dimensions
    this.maxChildren = maxChildren
    this.root = this.createNode(true)
  }

  private createNode(isLeaf: boolean): RTreeNode<T> {
    return {
      bbox: {
        min: Array(this.dimensions).fill(Infinity),
        max: Array(this.dimensions).fill(-Infinity)
      },
      children: [],
      data: null,
      isLeaf
    }
  }

  /**
   * Insert a point with data
   */
  insert(point: number[], data: T): void {
    const leaf: RTreeNode<T> = {
      bbox: { min: [...point], max: [...point] },
      children: [],
      data,
      isLeaf: true
    }

    this.insertNode(leaf)
  }

  /**
   * Insert a bounding box with data
   */
  insertBox(bbox: BoundingBox, data: T): void {
    const leaf: RTreeNode<T> = {
      bbox: { min: [...bbox.min], max: [...bbox.max] },
      children: [],
      data,
      isLeaf: true
    }

    this.insertNode(leaf)
  }

  private insertNode(node: RTreeNode<T>): void {
    // Find best leaf node
    const path = this.findInsertPath(this.root, node.bbox)
    let current = path[path.length - 1]

    // Insert
    current.children.push(node)
    this.expandBBox(current.bbox, node.bbox)

    // Split if necessary
    if (current.children.length > this.maxChildren) {
      this.split(path)
    }

    // Update bounding boxes up the tree
    for (let i = path.length - 2; i >= 0; i--) {
      this.expandBBox(path[i].bbox, node.bbox)
    }
  }

  private findInsertPath(node: RTreeNode<T>, bbox: BoundingBox): RTreeNode<T>[] {
    const path: RTreeNode<T>[] = [node]

    while (!node.isLeaf && node.children.length > 0 && !node.children[0].data) {
      // Find child with minimum enlargement
      let bestChild = node.children[0]
      let bestEnlargement = this.enlargement(bestChild.bbox, bbox)

      for (let i = 1; i < node.children.length; i++) {
        const enlargement = this.enlargement(node.children[i].bbox, bbox)
        if (enlargement < bestEnlargement) {
          bestEnlargement = enlargement
          bestChild = node.children[i]
        }
      }

      node = bestChild
      path.push(node)
    }

    return path
  }

  private split(path: RTreeNode<T>[]): void {
    const node = path[path.length - 1]
    
    // Simple split: sort by center and divide
    const centers = node.children.map(child => {
      const center: number[] = []
      for (let i = 0; i < this.dimensions; i++) {
        center.push((child.bbox.min[i] + child.bbox.max[i]) / 2)
      }
      return center
    })

    // Find axis with largest spread
    let bestAxis = 0
    let bestSpread = 0
    for (let axis = 0; axis < this.dimensions; axis++) {
      const values = centers.map(c => c[axis])
      const spread = Math.max(...values) - Math.min(...values)
      if (spread > bestSpread) {
        bestSpread = spread
        bestAxis = axis
      }
    }

    // Sort children by center on best axis
    const sortedChildren = [...node.children].sort((a, b) => {
      const ca = (a.bbox.min[bestAxis] + a.bbox.max[bestAxis]) / 2
      const cb = (b.bbox.min[bestAxis] + b.bbox.max[bestAxis]) / 2
      return ca - cb
    })

    const mid = Math.floor(sortedChildren.length / 2)
    const newNode = this.createNode(node.isLeaf)

    node.children = sortedChildren.slice(0, mid)
    newNode.children = sortedChildren.slice(mid)

    this.recalculateBBox(node)
    this.recalculateBBox(newNode)

    // Insert new node into parent
    if (path.length > 1) {
      const parent = path[path.length - 2]
      parent.children.push(newNode)
      
      if (parent.children.length > this.maxChildren) {
        this.split(path.slice(0, -1))
      }
    } else {
      // Split root
      const newRoot = this.createNode(false)
      newRoot.children = [node, newNode]
      this.recalculateBBox(newRoot)
      this.root = newRoot
    }
  }

  /**
   * Search for all items whose bounding boxes intersect with query
   */
  search(query: BoundingBox): Array<{ bbox: BoundingBox; data: T }> {
    const results: Array<{ bbox: BoundingBox; data: T }> = []
    this.searchRecursive(this.root, query, results)
    return results
  }

  private searchRecursive(
    node: RTreeNode<T>,
    query: BoundingBox,
    results: Array<{ bbox: BoundingBox; data: T }>
  ): void {
    if (!this.intersects(node.bbox, query)) {
      return
    }

    if (node.data !== null) {
      results.push({ bbox: node.bbox, data: node.data })
      return
    }

    for (const child of node.children) {
      this.searchRecursive(child, query, results)
    }
  }

  /**
   * Search for items containing a point
   */
  searchPoint(point: number[]): Array<{ bbox: BoundingBox; data: T }> {
    return this.search({ min: point, max: point })
  }

  private intersects(a: BoundingBox, b: BoundingBox): boolean {
    for (let i = 0; i < this.dimensions; i++) {
      if (a.max[i] < b.min[i] || a.min[i] > b.max[i]) {
        return false
      }
    }
    return true
  }

  private expandBBox(target: BoundingBox, source: BoundingBox): void {
    for (let i = 0; i < this.dimensions; i++) {
      target.min[i] = Math.min(target.min[i], source.min[i])
      target.max[i] = Math.max(target.max[i], source.max[i])
    }
  }

  private recalculateBBox(node: RTreeNode<T>): void {
    node.bbox.min = Array(this.dimensions).fill(Infinity)
    node.bbox.max = Array(this.dimensions).fill(-Infinity)
    
    for (const child of node.children) {
      this.expandBBox(node.bbox, child.bbox)
    }
  }

  private enlargement(bbox: BoundingBox, addition: BoundingBox): number {
    const originalVolume = this.volume(bbox)
    
    const expanded: BoundingBox = {
      min: bbox.min.map((v, i) => Math.min(v, addition.min[i])),
      max: bbox.max.map((v, i) => Math.max(v, addition.max[i]))
    }
    
    return this.volume(expanded) - originalVolume
  }

  private volume(bbox: BoundingBox): number {
    let vol = 1
    for (let i = 0; i < this.dimensions; i++) {
      vol *= Math.max(0, bbox.max[i] - bbox.min[i])
    }
    return vol
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAX HEAP (helper for k-nearest)
// ═══════════════════════════════════════════════════════════════════════════

class MaxHeap<T> {
  private heap: T[] = []
  private compare: (a: T, b: T) => number

  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare
  }

  size(): number {
    return this.heap.length
  }

  peek(): T | undefined {
    return this.heap[0]
  }

  push(item: T): void {
    this.heap.push(item)
    this.bubbleUp(this.heap.length - 1)
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined
    
    const result = this.heap[0]
    const last = this.heap.pop()!
    
    if (this.heap.length > 0) {
      this.heap[0] = last
      this.bubbleDown(0)
    }
    
    return result
  }

  toArray(): T[] {
    return [...this.heap]
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (this.compare(this.heap[index], this.heap[parent]) <= 0) break
      
      [this.heap[index], this.heap[parent]] = [this.heap[parent], this.heap[index]]
      index = parent
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const left = 2 * index + 1
      const right = 2 * index + 2
      let largest = index

      if (left < this.heap.length && this.compare(this.heap[left], this.heap[largest]) > 0) {
        largest = left
      }
      if (right < this.heap.length && this.compare(this.heap[right], this.heap[largest]) > 0) {
        largest = right
      }

      if (largest === index) break

      [this.heap[index], this.heap[largest]] = [this.heap[largest], this.heap[index]]
      index = largest
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TOROIDAL/SPHERICAL SPATIAL HASH (for wrapping grids)
// ═══════════════════════════════════════════════════════════════════════════

export class ToroidalSpatialHash<T> {
  private grid: Map<string, Array<{ position: number[]; data: T }>> = new Map()
  private cellSize: number
  private bounds: number[]

  constructor(cellSize: number, bounds: number[]) {
    this.cellSize = cellSize
    this.bounds = bounds
  }

  /**
   * Wrap position to valid range
   */
  private wrapPosition(position: number[]): number[] {
    return position.map((v, i) => {
      const b = this.bounds[i]
      return ((v % b) + b) % b
    })
  }

  insert(position: number[], data: T): void {
    const wrapped = this.wrapPosition(position)
    const key = this.positionToKey(wrapped)
    
    if (!this.grid.has(key)) {
      this.grid.set(key, [])
    }
    
    this.grid.get(key)!.push({ position: wrapped, data })
  }

  /**
   * Query with toroidal wrapping
   */
  query(center: number[], radius: number): Array<{ position: number[]; data: T; distance: number }> {
    const results: Array<{ position: number[]; data: T; distance: number }> = []
    const wrapped = this.wrapPosition(center)
    const radiusSq = radius * radius
    
    const cellRadius = Math.ceil(radius / this.cellSize)
    const centerCell = this.positionToCell(wrapped)
    
    // Check all cells within range (with wrapping)
    const dimensions = this.bounds.length
    const checkCell = (cellCoords: number[]): void => {
      const key = cellCoords.join(',')
      const cell = this.grid.get(key)
      if (!cell) return
      
      for (const item of cell) {
        const distSq = this.toroidalDistanceSq(wrapped, item.position)
        if (distSq <= radiusSq) {
          results.push({
            position: item.position,
            data: item.data,
            distance: Math.sqrt(distSq)
          })
        }
      }
    }
    
    // Iterate over all cells in range
    const iterate = (dim: number, current: number[]): void => {
      if (dim === dimensions) {
        checkCell(current)
        return
      }
      
      const cellsInDim = Math.ceil(this.bounds[dim] / this.cellSize)
      for (let offset = -cellRadius; offset <= cellRadius; offset++) {
        const cellIdx = ((centerCell[dim] + offset) % cellsInDim + cellsInDim) % cellsInDim
        iterate(dim + 1, [...current, cellIdx])
      }
    }
    
    iterate(0, [])
    
    return results
  }

  private positionToCell(position: number[]): number[] {
    return position.map(c => Math.floor(c / this.cellSize))
  }

  private positionToKey(position: number[]): string {
    return this.positionToCell(position).join(',')
  }

  private toroidalDistanceSq(a: number[], b: number[]): number {
    let sum = 0
    for (let i = 0; i < a.length; i++) {
      let diff = Math.abs(a[i] - b[i])
      if (diff > this.bounds[i] / 2) {
        diff = this.bounds[i] - diff
      }
      sum += diff * diff
    }
    return sum
  }
}
