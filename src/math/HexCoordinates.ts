/**
 * Hexagonal Coordinate Systems
 * 
 * This module provides multiple coordinate representations for hexagonal grids:
 * 
 * 1. OFFSET COORDINATES (odd-q / even-q / odd-r / even-r)
 *    - Simple row/column indices
 *    - Good for storage and iteration
 *    - Awkward for algorithms (neighbor detection, distance, etc.)
 * 
 * 2. AXIAL COORDINATES (q, r)
 *    - Two-axis system where the third axis is implicit (s = -q - r)
 *    - Efficient for most operations
 *    - Standard representation for algorithms
 * 
 * 3. CUBE COORDINATES (x, y, z) where x + y + z = 0
 *    - Three-axis system with constraint
 *    - Best for algorithms (distance, rotation, reflection)
 *    - Natural extension of Cartesian coordinates
 * 
 * 4. DOUBLED COORDINATES
 *    - Alternative system that doubles one axis
 *    - Useful for certain layouts
 * 
 * This module also provides geodesic hexagonal grids based on:
 * - Icosahedron subdivision (Goldberg polyhedra)
 * - HEALPix (Hierarchical Equal Area isoLatitude Pixelization)
 * 
 * @module math/HexCoordinates
 */

import { Vector2, Vector3 } from './Vector3'

// ═══════════════════════════════════════════════════════════════════════════
// COORDINATE TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface AxialCoord {
  q: number
  r: number
}

export interface CubeCoord {
  x: number
  y: number
  z: number
}

export interface OffsetCoord {
  col: number
  row: number
}

export interface DoubledCoord {
  col: number
  row: number
}

export interface GeoCoord {
  lat: number  // Latitude in degrees [-90, 90]
  lng: number  // Longitude in degrees [-180, 180]
}

// ═══════════════════════════════════════════════════════════════════════════
// AXIAL COORDINATE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export class Axial implements AxialCoord {
  constructor(public q: number, public r: number) {}

  static zero(): Axial {
    return new Axial(0, 0)
  }

  static fromCube(cube: CubeCoord): Axial {
    return new Axial(cube.x, cube.z)
  }

  static fromOffset(offset: OffsetCoord, isOddQ: boolean = true): Axial {
    const q = offset.col
    const r = isOddQ
      ? offset.row - Math.floor((offset.col - (offset.col & 1)) / 2)
      : offset.row - Math.floor((offset.col + (offset.col & 1)) / 2)
    return new Axial(q, r)
  }

  /**
   * Convert from pixel position to axial coordinates
   * @param x Pixel x position
   * @param y Pixel y position
   * @param size Hex size (radius)
   * @param flatTop Whether hexagons have flat tops (vs pointy tops)
   */
  static fromPixel(x: number, y: number, size: number, flatTop: boolean = true): Axial {
    if (flatTop) {
      const q = (2 / 3 * x) / size
      const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / size
      return Axial.round(q, r)
    } else {
      const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / size
      const r = (2 / 3 * y) / size
      return Axial.round(q, r)
    }
  }

  /**
   * Convert fractional axial to nearest hex center
   */
  static round(q: number, r: number): Axial {
    return Axial.fromCube(Cube.round(q, -q - r, r))
  }

  clone(): Axial {
    return new Axial(this.q, this.r)
  }

  equals(other: AxialCoord): boolean {
    return this.q === other.q && this.r === other.r
  }

  add(other: AxialCoord): Axial {
    return new Axial(this.q + other.q, this.r + other.r)
  }

  subtract(other: AxialCoord): Axial {
    return new Axial(this.q - other.q, this.r - other.r)
  }

  scale(k: number): Axial {
    return new Axial(this.q * k, this.r * k)
  }

  /**
   * Get the implicit third coordinate
   */
  get s(): number {
    return -this.q - this.r
  }

  /**
   * Convert to cube coordinates
   */
  toCube(): Cube {
    return new Cube(this.q, this.s, this.r)
  }

  /**
   * Convert to offset coordinates
   */
  toOffset(isOddQ: boolean = true): OffsetCoord {
    const col = this.q
    const row = isOddQ
      ? this.r + Math.floor((this.q - (this.q & 1)) / 2)
      : this.r + Math.floor((this.q + (this.q & 1)) / 2)
    return { col, row }
  }

  /**
   * Convert to pixel position
   */
  toPixel(size: number, flatTop: boolean = true): Vector2 {
    if (flatTop) {
      const x = size * (3 / 2 * this.q)
      const y = size * (Math.sqrt(3) / 2 * this.q + Math.sqrt(3) * this.r)
      return new Vector2(x, y)
    } else {
      const x = size * (Math.sqrt(3) * this.q + Math.sqrt(3) / 2 * this.r)
      const y = size * (3 / 2 * this.r)
      return new Vector2(x, y)
    }
  }

  /**
   * Manhattan distance to another hex
   */
  distanceTo(other: AxialCoord): number {
    return (
      Math.abs(this.q - other.q) +
      Math.abs(this.q + this.r - other.q - other.r) +
      Math.abs(this.r - other.r)
    ) / 2
  }

  /**
   * Get all 6 neighbors
   */
  neighbors(): Axial[] {
    return AXIAL_DIRECTIONS.map(d => this.add(d))
  }

  /**
   * Get neighbor in specific direction (0-5)
   */
  neighbor(direction: number): Axial {
    return this.add(AXIAL_DIRECTIONS[direction % 6])
  }

  /**
   * Get all hexes within radius
   */
  range(radius: number): Axial[] {
    const results: Axial[] = []
    for (let q = -radius; q <= radius; q++) {
      for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
        results.push(this.add({ q, r }))
      }
    }
    return results
  }

  /**
   * Get ring of hexes at exactly radius distance
   */
  ring(radius: number): Axial[] {
    if (radius === 0) return [this.clone()]
    
    const results: Axial[] = []
    let hex = this.add(AXIAL_DIRECTIONS[4].scale(radius) as AxialCoord)
    
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < radius; j++) {
        results.push(hex.clone())
        hex = hex.neighbor(i)
      }
    }
    
    return results
  }

  /**
   * Spiral outward from center
   */
  spiral(radius: number): Axial[] {
    const results: Axial[] = [this.clone()]
    for (let k = 1; k <= radius; k++) {
      results.push(...this.ring(k))
    }
    return results
  }

  /**
   * Line to another hex using linear interpolation
   */
  lineTo(other: AxialCoord): Axial[] {
    const distance = this.distanceTo(other)
    if (distance === 0) return [this.clone()]
    
    const results: Axial[] = []
    for (let i = 0; i <= distance; i++) {
      const t = i / distance
      const q = this.q + (other.q - this.q) * t
      const r = this.r + (other.r - this.r) * t
      results.push(Axial.round(q, r))
    }
    return results
  }

  /**
   * Rotate 60° clockwise around origin
   */
  rotateCW(): Axial {
    return new Axial(-this.r, -this.s)
  }

  /**
   * Rotate 60° counter-clockwise around origin
   */
  rotateCCW(): Axial {
    return new Axial(-this.s, -this.q)
  }

  /**
   * Rotate 60° clockwise around a center point
   */
  rotateAroundCW(center: AxialCoord): Axial {
    return this.subtract(center).rotateCW().add(center)
  }

  /**
   * Rotate 60° counter-clockwise around a center point
   */
  rotateAroundCCW(center: AxialCoord): Axial {
    return this.subtract(center).rotateCCW().add(center)
  }

  /**
   * Reflect across the q axis
   */
  reflectQ(): Axial {
    return new Axial(this.q, this.s)
  }

  /**
   * Reflect across the r axis
   */
  reflectR(): Axial {
    return new Axial(this.s, this.r)
  }

  /**
   * Reflect across the s axis
   */
  reflectS(): Axial {
    return new Axial(this.r, this.q)
  }

  toString(): string {
    return `Axial(${this.q}, ${this.r})`
  }

  toKey(): string {
    return `${this.q},${this.r}`
  }

  static fromKey(key: string): Axial {
    const [q, r] = key.split(',').map(Number)
    return new Axial(q, r)
  }
}

// Direction vectors for axial coordinates (flat-top hexagons)
export const AXIAL_DIRECTIONS: Axial[] = [
  new Axial(1, 0),   // East
  new Axial(1, -1),  // Northeast
  new Axial(0, -1),  // Northwest
  new Axial(-1, 0),  // West
  new Axial(-1, 1),  // Southwest
  new Axial(0, 1),   // Southeast
]

// ═══════════════════════════════════════════════════════════════════════════
// CUBE COORDINATE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export class Cube implements CubeCoord {
  constructor(
    public x: number,
    public y: number,
    public z: number
  ) {}

  static zero(): Cube {
    return new Cube(0, 0, 0)
  }

  static fromAxial(axial: AxialCoord): Cube {
    return new Cube(axial.q, -axial.q - axial.r, axial.r)
  }

  /**
   * Round fractional cube coordinates to nearest hex
   * Uses the constraint x + y + z = 0
   */
  static round(x: number, y: number, z: number): Cube {
    let rx = Math.round(x)
    let ry = Math.round(y)
    let rz = Math.round(z)

    const xDiff = Math.abs(rx - x)
    const yDiff = Math.abs(ry - y)
    const zDiff = Math.abs(rz - z)

    // Reset the component with largest rounding error
    if (xDiff > yDiff && xDiff > zDiff) {
      rx = -ry - rz
    } else if (yDiff > zDiff) {
      ry = -rx - rz
    } else {
      rz = -rx - ry
    }

    return new Cube(rx, ry, rz)
  }

  clone(): Cube {
    return new Cube(this.x, this.y, this.z)
  }

  equals(other: CubeCoord): boolean {
    return this.x === other.x && this.y === other.y && this.z === other.z
  }

  add(other: CubeCoord): Cube {
    return new Cube(this.x + other.x, this.y + other.y, this.z + other.z)
  }

  subtract(other: CubeCoord): Cube {
    return new Cube(this.x - other.x, this.y - other.y, this.z - other.z)
  }

  scale(k: number): Cube {
    return new Cube(this.x * k, this.y * k, this.z * k)
  }

  toAxial(): Axial {
    return new Axial(this.x, this.z)
  }

  /**
   * Manhattan distance
   */
  distanceTo(other: CubeCoord): number {
    return (
      Math.abs(this.x - other.x) +
      Math.abs(this.y - other.y) +
      Math.abs(this.z - other.z)
    ) / 2
  }

  /**
   * Get all 6 neighbors
   */
  neighbors(): Cube[] {
    return CUBE_DIRECTIONS.map(d => this.add(d))
  }

  neighbor(direction: number): Cube {
    return this.add(CUBE_DIRECTIONS[direction % 6])
  }

  /**
   * Rotate 60° clockwise around origin
   */
  rotateCW(): Cube {
    return new Cube(-this.z, -this.x, -this.y)
  }

  /**
   * Rotate 60° counter-clockwise around origin
   */
  rotateCCW(): Cube {
    return new Cube(-this.y, -this.z, -this.x)
  }

  /**
   * Rotate by n * 60°
   */
  rotate(steps: number): Cube {
    let result = this.clone()
    const n = ((steps % 6) + 6) % 6
    for (let i = 0; i < n; i++) {
      result = result.rotateCW()
    }
    return result
  }

  /**
   * Reflect through origin
   */
  reflect(): Cube {
    return new Cube(-this.x, -this.y, -this.z)
  }

  /**
   * Interpolate between two cube coordinates
   */
  lerp(other: CubeCoord, t: number): Cube {
    return new Cube(
      this.x + (other.x - this.x) * t,
      this.y + (other.y - this.y) * t,
      this.z + (other.z - this.z) * t
    )
  }

  /**
   * Line to another hex
   */
  lineTo(other: CubeCoord): Cube[] {
    const distance = this.distanceTo(other)
    if (distance === 0) return [this.clone()]
    
    const results: Cube[] = []
    for (let i = 0; i <= distance; i++) {
      const lerped = this.lerp(other, i / distance)
      results.push(Cube.round(lerped.x, lerped.y, lerped.z))
    }
    return results
  }

  toString(): string {
    return `Cube(${this.x}, ${this.y}, ${this.z})`
  }

  toKey(): string {
    return `${this.x},${this.y},${this.z}`
  }
}

export const CUBE_DIRECTIONS: Cube[] = [
  new Cube(1, -1, 0),  // East
  new Cube(1, 0, -1),  // Northeast
  new Cube(0, 1, -1),  // Northwest
  new Cube(-1, 1, 0),  // West
  new Cube(-1, 0, 1),  // Southwest
  new Cube(0, -1, 1),  // Southeast
]

// ═══════════════════════════════════════════════════════════════════════════
// GEODESIC HEXAGONAL GRID (Icosahedron-based)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generates a geodesic grid based on icosahedron subdivision
 * Results in a sphere tessellated with hexagons (and 12 pentagons at vertices)
 */
export class GeodesicHexGrid {
  public vertices: Vector3[] = []
  public faces: number[][] = []
  public hexCenters: Vector3[] = []
  public neighbors: number[][] = []

  private readonly phi = (1 + Math.sqrt(5)) / 2 // Golden ratio

  constructor(public subdivisions: number = 3) {
    this.generateIcosahedron()
    this.subdivide(subdivisions)
    this.generateDualGrid()
  }

  /**
   * Generate base icosahedron vertices and faces
   */
  private generateIcosahedron(): void {
    // 12 vertices of icosahedron (normalized to unit sphere)
    const t = this.phi
    const vertices = [
      new Vector3(-1, t, 0),
      new Vector3(1, t, 0),
      new Vector3(-1, -t, 0),
      new Vector3(1, -t, 0),
      new Vector3(0, -1, t),
      new Vector3(0, 1, t),
      new Vector3(0, -1, -t),
      new Vector3(0, 1, -t),
      new Vector3(t, 0, -1),
      new Vector3(t, 0, 1),
      new Vector3(-t, 0, -1),
      new Vector3(-t, 0, 1),
    ]

    this.vertices = vertices.map(v => v.normalize())

    // 20 triangular faces (vertex indices)
    this.faces = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
    ]
  }

  /**
   * Recursively subdivide each triangle
   */
  private subdivide(depth: number): void {
    for (let i = 0; i < depth; i++) {
      const newFaces: number[][] = []
      const midpointCache = new Map<string, number>()

      for (const face of this.faces) {
        // Get midpoints of each edge
        const a = this.getMidpoint(face[0], face[1], midpointCache)
        const b = this.getMidpoint(face[1], face[2], midpointCache)
        const c = this.getMidpoint(face[2], face[0], midpointCache)

        // Create 4 new triangles
        newFaces.push([face[0], a, c])
        newFaces.push([face[1], b, a])
        newFaces.push([face[2], c, b])
        newFaces.push([a, b, c])
      }

      this.faces = newFaces
    }
  }

  private getMidpoint(i1: number, i2: number, cache: Map<string, number>): number {
    const key = i1 < i2 ? `${i1}-${i2}` : `${i2}-${i1}`
    
    if (cache.has(key)) {
      return cache.get(key)!
    }

    const v1 = this.vertices[i1]
    const v2 = this.vertices[i2]
    const midpoint = v1.add(v2).normalize()
    
    const index = this.vertices.length
    this.vertices.push(midpoint)
    cache.set(key, index)
    
    return index
  }

  /**
   * Generate dual grid (hexagons from triangle vertices)
   * Each vertex becomes a hex center, each face contributes to hex edges
   */
  private generateDualGrid(): void {
    // Build adjacency for each vertex
    const vertexFaces: number[][] = Array.from({ length: this.vertices.length }, () => [])
    
    for (let i = 0; i < this.faces.length; i++) {
      for (const v of this.faces[i]) {
        vertexFaces[v].push(i)
      }
    }

    // Hex centers are the triangle vertices
    this.hexCenters = [...this.vertices]

    // Build neighbor relationships
    this.neighbors = Array.from({ length: this.vertices.length }, () => [])
    
    for (const face of this.faces) {
      // Each edge of the triangle connects two hex centers
      for (let i = 0; i < 3; i++) {
        const a = face[i]
        const b = face[(i + 1) % 3]
        
        if (!this.neighbors[a].includes(b)) {
          this.neighbors[a].push(b)
        }
        if (!this.neighbors[b].includes(a)) {
          this.neighbors[b].push(a)
        }
      }
    }
  }

  /**
   * Find the hex containing a point on the sphere
   */
  findHex(point: Vector3): number {
    const normalized = point.normalize()
    let minDist = Infinity
    let closest = 0

    for (let i = 0; i < this.hexCenters.length; i++) {
      const dist = normalized.distanceSquaredTo(this.hexCenters[i])
      if (dist < minDist) {
        minDist = dist
        closest = i
      }
    }

    return closest
  }

  /**
   * Convert lat/lng to hex index
   */
  latLngToHex(lat: number, lng: number): number {
    const point = Vector3.fromLatLng(lat, lng)
    return this.findHex(point)
  }

  /**
   * Get lat/lng of hex center
   */
  hexToLatLng(hexIndex: number): GeoCoord {
    const center = this.hexCenters[hexIndex]
    const { lat, lng } = center.toLatLng()
    return { lat, lng }
  }

  /**
   * Get number of sides for a hex (5 for pentagon vertices, 6 for hex)
   */
  getHexSides(hexIndex: number): number {
    return this.neighbors[hexIndex].length
  }

  /**
   * Check if hex is a pentagon (one of 12 icosahedron vertices)
   */
  isPentagon(hexIndex: number): boolean {
    return this.neighbors[hexIndex].length === 5
  }

  /**
   * Get all hexes within n steps
   */
  getHexesInRange(hexIndex: number, range: number): number[] {
    const visited = new Set<number>([hexIndex])
    let frontier = [hexIndex]

    for (let i = 0; i < range; i++) {
      const newFrontier: number[] = []
      for (const hex of frontier) {
        for (const neighbor of this.neighbors[hex]) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor)
            newFrontier.push(neighbor)
          }
        }
      }
      frontier = newFrontier
    }

    return Array.from(visited)
  }

  /**
   * Great circle distance between hex centers
   */
  distanceBetweenHexes(hex1: number, hex2: number): number {
    return this.hexCenters[hex1].greatCircleDistanceTo(this.hexCenters[hex2])
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HEALPix (Hierarchical Equal Area isoLatitude Pixelization)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * HEALPix implementation for equal-area spherical pixelization
 * Used in cosmology for CMB analysis - perfect for uniform sampling
 */
export class HEALPixGrid {
  public readonly nside: number
  public readonly npix: number
  public readonly pixelArea: number

  constructor(nside: number = 4) {
    // nside must be power of 2
    this.nside = nside
    this.npix = 12 * nside * nside
    this.pixelArea = 4 * Math.PI / this.npix
  }

  /**
   * Convert pixel index to angular coordinates (theta, phi)
   * theta: colatitude [0, π]
   * phi: longitude [0, 2π]
   */
  pixToAng(ipix: number): { theta: number; phi: number } {
    const nside = this.nside
    const npix = this.npix
    const ncap = 2 * nside * (nside - 1) // Number of pixels in north polar cap

    if (ipix < ncap) {
      // North polar cap
      const ip = ipix + 1
      const iring = Math.floor((1 + Math.sqrt(1 + 2 * ip)) / 2)
      const iphi = ip - 2 * iring * (iring - 1)
      const theta = Math.acos(1 - iring * iring / (3 * nside * nside))
      const phi = (iphi - 0.5) * Math.PI / (2 * iring)
      return { theta, phi }
    } else if (ipix < npix - ncap) {
      // Equatorial region
      const ip = ipix - ncap
      const iring = Math.floor(ip / (4 * nside)) + nside
      const iphi = ip % (4 * nside) + 1
      const fodd = ((iring + nside) & 1) ? 1 : 0.5
      const theta = Math.acos((2 * nside - iring) / (1.5 * nside))
      const phi = (iphi - fodd) * Math.PI / (2 * nside)
      return { theta, phi }
    } else {
      // South polar cap
      const ip = npix - ipix
      const iring = Math.floor((1 + Math.sqrt(2 * ip - 1)) / 2)
      const iphi = 4 * iring + 1 - (ip - 2 * iring * (iring - 1))
      const theta = Math.acos(-1 + iring * iring / (3 * nside * nside))
      const phi = (iphi - 0.5) * Math.PI / (2 * iring)
      return { theta, phi }
    }
  }

  /**
   * Convert pixel to lat/lng
   */
  pixToLatLng(ipix: number): GeoCoord {
    const { theta, phi } = this.pixToAng(ipix)
    return {
      lat: 90 - theta * (180 / Math.PI),
      lng: phi * (180 / Math.PI) - 180
    }
  }

  /**
   * Convert pixel to 3D position on unit sphere
   */
  pixToVector(ipix: number): Vector3 {
    const { theta, phi } = this.pixToAng(ipix)
    return new Vector3(
      Math.sin(theta) * Math.cos(phi),
      Math.sin(theta) * Math.sin(phi),
      Math.cos(theta)
    )
  }

  /**
   * Convert angular coordinates to pixel index
   */
  angToPix(theta: number, phi: number): number {
    const nside = this.nside
    const z = Math.cos(theta)
    const za = Math.abs(z)
    let phi_t = phi % (2 * Math.PI)
    if (phi_t < 0) phi_t += 2 * Math.PI

    if (za <= 2 / 3) {
      // Equatorial region
      const temp1 = nside * (0.5 + phi_t / (Math.PI / 2))
      const temp2 = nside * z * 0.75
      const jp = Math.floor(temp1 - temp2)
      const jm = Math.floor(temp1 + temp2)
      const ir = nside + 1 + jp - jm
      const kshift = 1 - (ir & 1)
      const ip = Math.floor((jp + jm - nside + kshift + 1) / 2)
      const ipix = 2 * nside * (nside - 1) + (ir - 1) * 4 * nside + ip
      return ipix
    } else {
      // Polar regions
      const tp = phi_t / (Math.PI / 2)
      const tmp = nside * Math.sqrt(3 * (1 - za))
      const jp = Math.floor(tp * tmp)
      const jm = Math.floor((1 - tp) * tmp)
      const ir = jp + jm + 1
      const ip = Math.floor(tp * ir)

      if (z > 0) {
        return 2 * ir * (ir - 1) + ip
      } else {
        return 12 * nside * nside - 2 * ir * (ir + 1) + ip
      }
    }
  }

  /**
   * Convert lat/lng to pixel index
   */
  latLngToPix(lat: number, lng: number): number {
    const theta = (90 - lat) * (Math.PI / 180)
    const phi = (lng + 180) * (Math.PI / 180)
    return this.angToPix(theta, phi)
  }

  /**
   * Get neighboring pixels (8-connected)
   */
  getNeighbors(ipix: number): number[] {
    // This is a simplified version - full implementation would use ring scheme
    const neighbors: number[] = []
    const { theta, phi } = this.pixToAng(ipix)
    
    // Sample in 8 directions and find different pixels
    const deltas = [0.1, -0.1]
    for (const dTheta of [0, ...deltas]) {
      for (const dPhi of [0, ...deltas]) {
        if (dTheta === 0 && dPhi === 0) continue
        
        let newTheta = theta + dTheta
        let newPhi = phi + dPhi
        
        // Clamp theta
        newTheta = Math.max(0.001, Math.min(Math.PI - 0.001, newTheta))
        // Wrap phi
        newPhi = ((newPhi % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
        
        const neighbor = this.angToPix(newTheta, newPhi)
        if (neighbor !== ipix && !neighbors.includes(neighbor)) {
          neighbors.push(neighbor)
        }
      }
    }
    
    return neighbors
  }

  /**
   * Get all pixel centers as Vector3 array
   */
  getAllCenters(): Vector3[] {
    const centers: Vector3[] = []
    for (let i = 0; i < this.npix; i++) {
      centers.push(this.pixToVector(i))
    }
    return centers
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FLAT HEX GRID GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

export interface HexGridConfig {
  radius: number           // Hex size
  width: number           // Grid width in hexes
  height: number          // Grid height in hexes
  flatTop?: boolean       // Flat-top vs pointy-top hexes
  origin?: Vector2        // Grid origin position
}

/**
 * Generate a flat hexagonal grid
 */
export function generateFlatHexGrid(config: HexGridConfig): {
  positions: Vector2[]
  axialCoords: Axial[]
  neighbors: number[][]
} {
  const { radius, width, height, flatTop = true, origin = Vector2.zero() } = config
  
  const positions: Vector2[] = []
  const axialCoords: Axial[] = []
  const coordToIndex = new Map<string, number>()

  // Generate positions
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const axial = Axial.fromOffset({ col, row }, true)
      const pixel = axial.toPixel(radius, flatTop).add(origin)
      
      const index = positions.length
      positions.push(pixel)
      axialCoords.push(axial)
      coordToIndex.set(axial.toKey(), index)
    }
  }

  // Generate neighbors
  const neighbors: number[][] = axialCoords.map(coord => {
    return coord.neighbors()
      .map(n => coordToIndex.get(n.toKey()))
      .filter((idx): idx is number => idx !== undefined)
  })

  return { positions, axialCoords, neighbors }
}

/**
 * Generate a spherical hex grid by projecting flat grid onto sphere
 */
export function generateSphericalHexGrid(config: {
  hexRadius: number
  sphereRadius: number
  latRange?: [number, number]  // [minLat, maxLat] in degrees
  lngRange?: [number, number]  // [minLng, maxLng] in degrees
}): {
  positions: Vector3[]
  geoCoords: GeoCoord[]
  neighbors: number[][]
} {
  const {
    hexRadius,
    sphereRadius,
    latRange = [-80, 80],
    lngRange = [-180, 180]
  } = config

  const positions: Vector3[] = []
  const geoCoords: GeoCoord[] = []
  
  // Calculate hex spacing in degrees
  const latSpacing = (hexRadius / sphereRadius) * (180 / Math.PI) * 1.5
  const baseLngSpacing = (hexRadius / sphereRadius) * (180 / Math.PI) * Math.sqrt(3)

  let rowIndex = 0
  for (let lat = latRange[0]; lat <= latRange[1]; lat += latSpacing) {
    // Adjust longitude spacing based on latitude (spherical compensation)
    const cosLat = Math.cos(lat * Math.PI / 180)
    const lngSpacing = baseLngSpacing / Math.max(0.1, cosLat)
    
    // Offset every other row
    const offset = (rowIndex % 2) * (lngSpacing / 2)
    
    for (let lng = lngRange[0] + offset; lng <= lngRange[1]; lng += lngSpacing) {
      const position = Vector3.fromLatLng(lat, lng, sphereRadius)
      positions.push(position)
      geoCoords.push({ lat, lng })
    }
    
    rowIndex++
  }

  // Build neighbors using spatial proximity
  const neighbors: number[][] = positions.map((pos, i) => {
    const nearby: number[] = []
    const threshold = hexRadius * 2.5
    
    for (let j = 0; j < positions.length; j++) {
      if (i === j) continue
      const dist = pos.distanceTo(positions[j])
      if (dist < threshold) {
        nearby.push(j)
      }
    }
    
    // Sort by distance and take closest 6
    nearby.sort((a, b) => pos.distanceTo(positions[a]) - pos.distanceTo(positions[b]))
    return nearby.slice(0, 6)
  })

  return { positions, geoCoords, neighbors }
}
