/**
 * High-performance 3D Vector Mathematics
 * Optimized for hexagonal grid computations with spherical projections
 * 
 * @module math/Vector3
 */

export class Vector3 {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // STATIC CONSTRUCTORS
  // ═══════════════════════════════════════════════════════════════════════════

  static zero(): Vector3 {
    return new Vector3(0, 0, 0)
  }

  static one(): Vector3 {
    return new Vector3(1, 1, 1)
  }

  static up(): Vector3 {
    return new Vector3(0, 1, 0)
  }

  static down(): Vector3 {
    return new Vector3(0, -1, 0)
  }

  static forward(): Vector3 {
    return new Vector3(0, 0, 1)
  }

  static back(): Vector3 {
    return new Vector3(0, 0, -1)
  }

  static right(): Vector3 {
    return new Vector3(1, 0, 0)
  }

  static left(): Vector3 {
    return new Vector3(-1, 0, 0)
  }

  static fromArray(arr: [number, number, number]): Vector3 {
    return new Vector3(arr[0], arr[1], arr[2])
  }

  static fromSpherical(lat: number, lon: number, radius: number = 1): Vector3 {
    const cosLat = Math.cos(lat)
    return new Vector3(
      radius * cosLat * Math.cos(lon),
      radius * Math.sin(lat),
      radius * cosLat * Math.sin(lon)
    )
  }

  static fromLatLng(latDeg: number, lngDeg: number, radius: number = 1): Vector3 {
    const lat = latDeg * (Math.PI / 180)
    const lng = lngDeg * (Math.PI / 180)
    return Vector3.fromSpherical(lat, lng, radius)
  }

  static random(): Vector3 {
    return new Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).normalize()
  }

  static randomInSphere(radius: number = 1): Vector3 {
    // Uniform distribution in sphere using rejection sampling
    let v: Vector3
    do {
      v = new Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      )
    } while (v.magnitudeSquared() > 1)
    return v.scale(radius)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BASIC OPERATIONS (Immutable - return new Vector3)
  // ═══════════════════════════════════════════════════════════════════════════

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z)
  }

  add(v: Vector3): Vector3 {
    return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z)
  }

  subtract(v: Vector3): Vector3 {
    return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z)
  }

  scale(s: number): Vector3 {
    return new Vector3(this.x * s, this.y * s, this.z * s)
  }

  multiply(v: Vector3): Vector3 {
    return new Vector3(this.x * v.x, this.y * v.y, this.z * v.z)
  }

  divide(v: Vector3): Vector3 {
    return new Vector3(
      v.x !== 0 ? this.x / v.x : 0,
      v.y !== 0 ? this.y / v.y : 0,
      v.z !== 0 ? this.z / v.z : 0
    )
  }

  negate(): Vector3 {
    return new Vector3(-this.x, -this.y, -this.z)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MUTABLE OPERATIONS (for performance in tight loops)
  // ═══════════════════════════════════════════════════════════════════════════

  set(x: number, y: number, z: number): this {
    this.x = x
    this.y = y
    this.z = z
    return this
  }

  copy(v: Vector3): this {
    this.x = v.x
    this.y = v.y
    this.z = v.z
    return this
  }

  addInPlace(v: Vector3): this {
    this.x += v.x
    this.y += v.y
    this.z += v.z
    return this
  }

  subtractInPlace(v: Vector3): this {
    this.x -= v.x
    this.y -= v.y
    this.z -= v.z
    return this
  }

  scaleInPlace(s: number): this {
    this.x *= s
    this.y *= s
    this.z *= s
    return this
  }

  normalizeInPlace(): this {
    const mag = this.magnitude()
    if (mag > 0.00001) {
      this.x /= mag
      this.y /= mag
      this.z /= mag
    }
    return this
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VECTOR PRODUCTS & PROJECTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  dot(v: Vector3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z
  }

  cross(v: Vector3): Vector3 {
    return new Vector3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    )
  }

  /**
   * Scalar triple product: this · (a × b)
   * Equals the signed volume of the parallelepiped formed by the three vectors
   */
  tripleProduct(a: Vector3, b: Vector3): number {
    return this.dot(a.cross(b))
  }

  /**
   * Project this vector onto another vector
   */
  projectOnto(v: Vector3): Vector3 {
    const magSq = v.magnitudeSquared()
    if (magSq < 0.00001) return Vector3.zero()
    return v.scale(this.dot(v) / magSq)
  }

  /**
   * Project this vector onto a plane defined by its normal
   */
  projectOntoPlane(normal: Vector3): Vector3 {
    return this.subtract(this.projectOnto(normal))
  }

  /**
   * Reflect this vector across a surface with given normal
   */
  reflect(normal: Vector3): Vector3 {
    const d = 2 * this.dot(normal)
    return this.subtract(normal.scale(d))
  }

  /**
   * Refract this vector through a surface
   * @param normal Surface normal
   * @param eta Ratio of indices of refraction (n1/n2)
   */
  refract(normal: Vector3, eta: number): Vector3 {
    const cosi = -this.dot(normal)
    const sint2 = eta * eta * (1 - cosi * cosi)
    if (sint2 > 1) return this.reflect(normal) // Total internal reflection
    const cost = Math.sqrt(1 - sint2)
    return this.scale(eta).add(normal.scale(eta * cosi - cost))
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAGNITUDE & NORMALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z)
  }

  magnitudeSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z
  }

  normalize(): Vector3 {
    const mag = this.magnitude()
    if (mag < 0.00001) return Vector3.zero()
    return this.scale(1 / mag)
  }

  setMagnitude(length: number): Vector3 {
    return this.normalize().scale(length)
  }

  clampMagnitude(max: number): Vector3 {
    const magSq = this.magnitudeSquared()
    if (magSq > max * max) {
      return this.scale(max / Math.sqrt(magSq))
    }
    return this.clone()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DISTANCE & ANGLE CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  distanceTo(v: Vector3): number {
    return this.subtract(v).magnitude()
  }

  distanceSquaredTo(v: Vector3): number {
    return this.subtract(v).magnitudeSquared()
  }

  /**
   * Angle between this and another vector in radians
   */
  angleTo(v: Vector3): number {
    const denom = Math.sqrt(this.magnitudeSquared() * v.magnitudeSquared())
    if (denom < 0.00001) return 0
    const cos = Math.max(-1, Math.min(1, this.dot(v) / denom))
    return Math.acos(cos)
  }

  /**
   * Signed angle around an axis (useful for rotation calculations)
   */
  signedAngleTo(v: Vector3, axis: Vector3): number {
    const angle = this.angleTo(v)
    const cross = this.cross(v)
    return cross.dot(axis) < 0 ? -angle : angle
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERPOLATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Linear interpolation between this and another vector
   */
  lerp(v: Vector3, t: number): Vector3 {
    return new Vector3(
      this.x + (v.x - this.x) * t,
      this.y + (v.y - this.y) * t,
      this.z + (v.z - this.z) * t
    )
  }

  /**
   * Spherical linear interpolation (for smooth rotation/direction changes)
   * Maintains constant angular velocity
   */
  slerp(v: Vector3, t: number): Vector3 {
    const dot = Math.max(-1, Math.min(1, this.normalize().dot(v.normalize())))
    const theta = Math.acos(dot) * t
    const relative = v.subtract(this.scale(dot)).normalize()
    return this.scale(Math.cos(theta)).add(relative.scale(Math.sin(theta)))
  }

  /**
   * Normalized linear interpolation (faster approximation of slerp)
   */
  nlerp(v: Vector3, t: number): Vector3 {
    return this.lerp(v, t).normalize()
  }

  /**
   * Cubic Hermite spline interpolation
   */
  hermite(tangent1: Vector3, p2: Vector3, tangent2: Vector3, t: number): Vector3 {
    const t2 = t * t
    const t3 = t2 * t
    const h1 = 2 * t3 - 3 * t2 + 1
    const h2 = -2 * t3 + 3 * t2
    const h3 = t3 - 2 * t2 + t
    const h4 = t3 - t2
    return this.scale(h1)
      .add(p2.scale(h2))
      .add(tangent1.scale(h3))
      .add(tangent2.scale(h4))
  }

  /**
   * Catmull-Rom spline interpolation (smooth curve through control points)
   */
  static catmullRom(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number): Vector3 {
    const t2 = t * t
    const t3 = t2 * t
    return new Vector3(
      0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)
    )
  }

  /**
   * Bezier curve evaluation
   */
  static bezier(points: Vector3[], t: number): Vector3 {
    if (points.length === 1) return points[0].clone()
    const newPoints: Vector3[] = []
    for (let i = 0; i < points.length - 1; i++) {
      newPoints.push(points[i].lerp(points[i + 1], t))
    }
    return Vector3.bezier(newPoints, t)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPHERICAL COORDINATES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Convert to spherical coordinates [radius, theta (azimuth), phi (elevation)]
   */
  toSpherical(): { radius: number; theta: number; phi: number } {
    const radius = this.magnitude()
    if (radius < 0.00001) return { radius: 0, theta: 0, phi: 0 }
    return {
      radius,
      theta: Math.atan2(this.z, this.x),
      phi: Math.asin(Math.max(-1, Math.min(1, this.y / radius)))
    }
  }

  /**
   * Convert to lat/lng in degrees
   */
  toLatLng(): { lat: number; lng: number } {
    const spherical = this.toSpherical()
    return {
      lat: spherical.phi * (180 / Math.PI),
      lng: spherical.theta * (180 / Math.PI)
    }
  }

  /**
   * Great circle distance on unit sphere (Haversine)
   */
  greatCircleDistanceTo(v: Vector3): number {
    const a = this.normalize()
    const b = v.normalize()
    return Math.acos(Math.max(-1, Math.min(1, a.dot(b))))
  }

  /**
   * Great circle interpolation (geodesic on sphere)
   */
  greatCircleLerp(v: Vector3, t: number): Vector3 {
    return this.slerp(v, t).normalize().scale(this.magnitude())
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROTATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Rotate around an arbitrary axis using Rodrigues' rotation formula
   */
  rotateAround(axis: Vector3, angle: number): Vector3 {
    const k = axis.normalize()
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    // v' = v*cos(θ) + (k×v)*sin(θ) + k*(k·v)*(1-cos(θ))
    return this.scale(cos)
      .add(k.cross(this).scale(sin))
      .add(k.scale(k.dot(this) * (1 - cos)))
  }

  rotateX(angle: number): Vector3 {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return new Vector3(
      this.x,
      this.y * cos - this.z * sin,
      this.y * sin + this.z * cos
    )
  }

  rotateY(angle: number): Vector3 {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return new Vector3(
      this.x * cos + this.z * sin,
      this.y,
      -this.x * sin + this.z * cos
    )
  }

  rotateZ(angle: number): Vector3 {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return new Vector3(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos,
      this.z
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════════════════════════════

  toArray(): [number, number, number] {
    return [this.x, this.y, this.z]
  }

  toFloat32Array(): Float32Array {
    return new Float32Array([this.x, this.y, this.z])
  }

  equals(v: Vector3, epsilon: number = 0.00001): boolean {
    return (
      Math.abs(this.x - v.x) < epsilon &&
      Math.abs(this.y - v.y) < epsilon &&
      Math.abs(this.z - v.z) < epsilon
    )
  }

  isZero(epsilon: number = 0.00001): boolean {
    return this.magnitudeSquared() < epsilon * epsilon
  }

  abs(): Vector3 {
    return new Vector3(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z))
  }

  floor(): Vector3 {
    return new Vector3(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z))
  }

  ceil(): Vector3 {
    return new Vector3(Math.ceil(this.x), Math.ceil(this.y), Math.ceil(this.z))
  }

  round(): Vector3 {
    return new Vector3(Math.round(this.x), Math.round(this.y), Math.round(this.z))
  }

  min(v: Vector3): Vector3 {
    return new Vector3(
      Math.min(this.x, v.x),
      Math.min(this.y, v.y),
      Math.min(this.z, v.z)
    )
  }

  max(v: Vector3): Vector3 {
    return new Vector3(
      Math.max(this.x, v.x),
      Math.max(this.y, v.y),
      Math.max(this.z, v.z)
    )
  }

  clamp(min: Vector3, max: Vector3): Vector3 {
    return this.max(min).min(max)
  }

  toString(): string {
    return `Vector3(${this.x.toFixed(4)}, ${this.y.toFixed(4)}, ${this.z.toFixed(4)})`
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2D VECTOR (for hex grid calculations)
// ═══════════════════════════════════════════════════════════════════════════

export class Vector2 {
  constructor(
    public x: number = 0,
    public y: number = 0
  ) {}

  static zero(): Vector2 {
    return new Vector2(0, 0)
  }

  static one(): Vector2 {
    return new Vector2(1, 1)
  }

  static fromAngle(angle: number, length: number = 1): Vector2 {
    return new Vector2(Math.cos(angle) * length, Math.sin(angle) * length)
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y)
  }

  add(v: Vector2): Vector2 {
    return new Vector2(this.x + v.x, this.y + v.y)
  }

  subtract(v: Vector2): Vector2 {
    return new Vector2(this.x - v.x, this.y - v.y)
  }

  scale(s: number): Vector2 {
    return new Vector2(this.x * s, this.y * s)
  }

  dot(v: Vector2): number {
    return this.x * v.x + this.y * v.y
  }

  /**
   * 2D cross product (returns scalar - z-component of 3D cross)
   */
  cross(v: Vector2): number {
    return this.x * v.y - this.y * v.x
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y)
  }

  magnitudeSquared(): number {
    return this.x * this.x + this.y * this.y
  }

  normalize(): Vector2 {
    const mag = this.magnitude()
    if (mag < 0.00001) return Vector2.zero()
    return this.scale(1 / mag)
  }

  angle(): number {
    return Math.atan2(this.y, this.x)
  }

  angleTo(v: Vector2): number {
    return Math.atan2(this.cross(v), this.dot(v))
  }

  rotate(angle: number): Vector2 {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return new Vector2(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos
    )
  }

  perpendicular(): Vector2 {
    return new Vector2(-this.y, this.x)
  }

  lerp(v: Vector2, t: number): Vector2 {
    return new Vector2(
      this.x + (v.x - this.x) * t,
      this.y + (v.y - this.y) * t
    )
  }

  distanceTo(v: Vector2): number {
    return this.subtract(v).magnitude()
  }

  toArray(): [number, number] {
    return [this.x, this.y]
  }

  toVector3(z: number = 0): Vector3 {
    return new Vector3(this.x, this.y, z)
  }

  equals(v: Vector2, epsilon: number = 0.00001): boolean {
    return Math.abs(this.x - v.x) < epsilon && Math.abs(this.y - v.y) < epsilon
  }

  toString(): string {
    return `Vector2(${this.x.toFixed(4)}, ${this.y.toFixed(4)})`
  }
}
