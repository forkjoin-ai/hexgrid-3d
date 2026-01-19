/**
 * Quaternion Mathematics for 3D Rotations
 * 
 * Quaternions provide gimbal-lock-free rotation representation
 * with smooth interpolation (SLERP) capabilities.
 * 
 * A quaternion q = w + xi + yj + zk where:
 * - w is the scalar (real) part
 * - (x, y, z) is the vector (imaginary) part
 * 
 * For unit quaternions representing rotations:
 * - q = cos(θ/2) + sin(θ/2)(xi + yj + zk)
 * - where (x, y, z) is the rotation axis and θ is the angle
 * 
 * @module math/Quaternion
 */

import { Vector3 } from './Vector3'
import { Matrix4, Matrix3 } from './Matrix4'

export class Quaternion {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0,
    public w: number = 1
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // STATIC CONSTRUCTORS
  // ═══════════════════════════════════════════════════════════════════════════

  static identity(): Quaternion {
    return new Quaternion(0, 0, 0, 1)
  }

  /**
   * Create quaternion from axis-angle representation
   * @param axis Rotation axis (will be normalized)
   * @param angle Rotation angle in radians
   */
  static fromAxisAngle(axis: Vector3, angle: number): Quaternion {
    const halfAngle = angle / 2
    const s = Math.sin(halfAngle)
    const n = axis.normalize()
    return new Quaternion(
      n.x * s,
      n.y * s,
      n.z * s,
      Math.cos(halfAngle)
    )
  }

  /**
   * Create quaternion from Euler angles (XYZ order)
   * @param x Rotation around X axis in radians
   * @param y Rotation around Y axis in radians
   * @param z Rotation around Z axis in radians
   */
  static fromEuler(x: number, y: number, z: number): Quaternion {
    const cx = Math.cos(x / 2)
    const sx = Math.sin(x / 2)
    const cy = Math.cos(y / 2)
    const sy = Math.sin(y / 2)
    const cz = Math.cos(z / 2)
    const sz = Math.sin(z / 2)

    return new Quaternion(
      sx * cy * cz + cx * sy * sz,
      cx * sy * cz - sx * cy * sz,
      cx * cy * sz + sx * sy * cz,
      cx * cy * cz - sx * sy * sz
    )
  }

  /**
   * Create quaternion from Euler angles in degrees
   */
  static fromEulerDegrees(x: number, y: number, z: number): Quaternion {
    const toRad = Math.PI / 180
    return Quaternion.fromEuler(x * toRad, y * toRad, z * toRad)
  }

  /**
   * Create quaternion that rotates from one direction to another
   * @param from Starting direction
   * @param to Target direction
   */
  static fromToRotation(from: Vector3, to: Vector3): Quaternion {
    const f = from.normalize()
    const t = to.normalize()
    const dot = f.dot(t)

    // Vectors are parallel
    if (dot > 0.9999) {
      return Quaternion.identity()
    }

    // Vectors are opposite
    if (dot < -0.9999) {
      // Find orthogonal axis
      let axis = new Vector3(1, 0, 0).cross(f)
      if (axis.magnitudeSquared() < 0.00001) {
        axis = new Vector3(0, 1, 0).cross(f)
      }
      return Quaternion.fromAxisAngle(axis.normalize(), Math.PI)
    }

    const axis = f.cross(t)
    const s = Math.sqrt((1 + dot) * 2)
    const invs = 1 / s

    return new Quaternion(
      axis.x * invs,
      axis.y * invs,
      axis.z * invs,
      s * 0.5
    ).normalize()
  }

  /**
   * Create quaternion from rotation matrix
   */
  static fromMatrix(m: Matrix4 | Matrix3): Quaternion {
    const e = m.elements
    const trace = e[0] + e[4] + e[8]
    
    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1)
      return new Quaternion(
        (e[5] - e[7]) * s,
        (e[6] - e[2]) * s,
        (e[1] - e[3]) * s,
        0.25 / s
      )
    } else if (e[0] > e[4] && e[0] > e[8]) {
      const s = 2 * Math.sqrt(1 + e[0] - e[4] - e[8])
      return new Quaternion(
        0.25 * s,
        (e[1] + e[3]) / s,
        (e[6] + e[2]) / s,
        (e[5] - e[7]) / s
      )
    } else if (e[4] > e[8]) {
      const s = 2 * Math.sqrt(1 + e[4] - e[0] - e[8])
      return new Quaternion(
        (e[1] + e[3]) / s,
        0.25 * s,
        (e[5] + e[7]) / s,
        (e[6] - e[2]) / s
      )
    } else {
      const s = 2 * Math.sqrt(1 + e[8] - e[0] - e[4])
      return new Quaternion(
        (e[6] + e[2]) / s,
        (e[5] + e[7]) / s,
        0.25 * s,
        (e[1] - e[3]) / s
      )
    }
  }

  /**
   * Create quaternion that looks in a direction
   * @param forward Direction to look
   * @param up Up vector
   */
  static lookRotation(forward: Vector3, up: Vector3 = Vector3.up()): Quaternion {
    const lookAt = Matrix4.lookAt(Vector3.zero(), forward, up)
    return Quaternion.fromMatrix(lookAt.getRotationMatrix())
  }

  /**
   * Create random rotation quaternion (uniform distribution on SO(3))
   */
  static random(): Quaternion {
    const u1 = Math.random()
    const u2 = Math.random()
    const u3 = Math.random()
    
    const sqrt1u1 = Math.sqrt(1 - u1)
    const sqrtu1 = Math.sqrt(u1)
    const twoPiU2 = 2 * Math.PI * u2
    const twoPiU3 = 2 * Math.PI * u3
    
    return new Quaternion(
      sqrt1u1 * Math.sin(twoPiU2),
      sqrt1u1 * Math.cos(twoPiU2),
      sqrtu1 * Math.sin(twoPiU3),
      sqrtu1 * Math.cos(twoPiU3)
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BASIC OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  clone(): Quaternion {
    return new Quaternion(this.x, this.y, this.z, this.w)
  }

  set(x: number, y: number, z: number, w: number): this {
    this.x = x
    this.y = y
    this.z = z
    this.w = w
    return this
  }

  copy(q: Quaternion): this {
    this.x = q.x
    this.y = q.y
    this.z = q.z
    this.w = q.w
    return this
  }

  /**
   * Quaternion multiplication: this * q
   * Combines rotations (applies this rotation, then q)
   */
  multiply(q: Quaternion): Quaternion {
    return new Quaternion(
      this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y,
      this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x,
      this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w,
      this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z
    )
  }

  /**
   * Pre-multiply: q * this
   */
  premultiply(q: Quaternion): Quaternion {
    return q.multiply(this)
  }

  /**
   * Add quaternions (useful for averaging)
   */
  add(q: Quaternion): Quaternion {
    return new Quaternion(
      this.x + q.x,
      this.y + q.y,
      this.z + q.z,
      this.w + q.w
    )
  }

  /**
   * Scale quaternion
   */
  scale(s: number): Quaternion {
    return new Quaternion(this.x * s, this.y * s, this.z * s, this.w * s)
  }

  /**
   * Dot product (useful for determining similarity)
   */
  dot(q: Quaternion): number {
    return this.x * q.x + this.y * q.y + this.z * q.z + this.w * q.w
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NORMALIZATION & MAGNITUDE
  // ═══════════════════════════════════════════════════════════════════════════

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w)
  }

  magnitudeSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w
  }

  normalize(): Quaternion {
    const mag = this.magnitude()
    if (mag < 0.00001) return Quaternion.identity()
    return this.scale(1 / mag)
  }

  normalizeInPlace(): this {
    const mag = this.magnitude()
    if (mag > 0.00001) {
      const invMag = 1 / mag
      this.x *= invMag
      this.y *= invMag
      this.z *= invMag
      this.w *= invMag
    }
    return this
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INVERSE & CONJUGATE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Conjugate: negates the vector part
   * For unit quaternions, conjugate equals inverse
   */
  conjugate(): Quaternion {
    return new Quaternion(-this.x, -this.y, -this.z, this.w)
  }

  /**
   * Inverse: q⁻¹ = conjugate(q) / |q|²
   */
  inverse(): Quaternion {
    const magSq = this.magnitudeSquared()
    if (magSq < 0.00001) return Quaternion.identity()
    const invMagSq = 1 / magSq
    return new Quaternion(
      -this.x * invMagSq,
      -this.y * invMagSq,
      -this.z * invMagSq,
      this.w * invMagSq
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERPOLATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Spherical Linear Interpolation (SLERP)
   * Maintains constant angular velocity between rotations
   * @param q Target quaternion
   * @param t Interpolation factor [0, 1]
   */
  slerp(q: Quaternion, t: number): Quaternion {
    let qb = q.clone()
    let dot = this.dot(qb)

    // If dot product is negative, negate one to take shorter path
    if (dot < 0) {
      qb = qb.scale(-1)
      dot = -dot
    }

    // If quaternions are very close, use linear interpolation
    if (dot > 0.9995) {
      return this.lerp(qb, t).normalize()
    }

    const theta0 = Math.acos(dot)
    const theta = theta0 * t
    const sinTheta = Math.sin(theta)
    const sinTheta0 = Math.sin(theta0)

    const s0 = Math.cos(theta) - dot * sinTheta / sinTheta0
    const s1 = sinTheta / sinTheta0

    return new Quaternion(
      this.x * s0 + qb.x * s1,
      this.y * s0 + qb.y * s1,
      this.z * s0 + qb.z * s1,
      this.w * s0 + qb.w * s1
    )
  }

  /**
   * Linear interpolation (faster but doesn't maintain constant velocity)
   */
  lerp(q: Quaternion, t: number): Quaternion {
    return new Quaternion(
      this.x + (q.x - this.x) * t,
      this.y + (q.y - this.y) * t,
      this.z + (q.z - this.z) * t,
      this.w + (q.w - this.w) * t
    )
  }

  /**
   * Normalized Linear Interpolation
   * Faster than SLERP, good approximation for small angles
   */
  nlerp(q: Quaternion, t: number): Quaternion {
    return this.lerp(q, t).normalize()
  }

  /**
   * Squad interpolation for smooth rotation through multiple keyframes
   * @param a First control point
   * @param b Second control point
   * @param c Third control point
   * @param d Fourth control point
   * @param t Interpolation factor
   */
  static squad(a: Quaternion, b: Quaternion, c: Quaternion, d: Quaternion, t: number): Quaternion {
    const slerp1 = a.slerp(d, t)
    const slerp2 = b.slerp(c, t)
    return slerp1.slerp(slerp2, 2 * t * (1 - t))
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROTATION OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Rotate a vector by this quaternion
   * v' = q * v * q⁻¹
   */
  rotateVector(v: Vector3): Vector3 {
    // Optimized rotation formula
    const qv = new Vector3(this.x, this.y, this.z)
    const uv = qv.cross(v)
    const uuv = qv.cross(uv)
    return v.add(uv.scale(2 * this.w)).add(uuv.scale(2))
  }

  /**
   * Get the angle of rotation in radians
   */
  getAngle(): number {
    return 2 * Math.acos(Math.max(-1, Math.min(1, this.w)))
  }

  /**
   * Get the rotation axis
   */
  getAxis(): Vector3 {
    const sinHalfAngle = Math.sqrt(1 - this.w * this.w)
    if (sinHalfAngle < 0.00001) {
      return new Vector3(1, 0, 0) // Arbitrary axis for zero rotation
    }
    return new Vector3(
      this.x / sinHalfAngle,
      this.y / sinHalfAngle,
      this.z / sinHalfAngle
    )
  }

  /**
   * Get axis-angle representation
   */
  toAxisAngle(): { axis: Vector3; angle: number } {
    return {
      axis: this.getAxis(),
      angle: this.getAngle()
    }
  }

  /**
   * Convert to Euler angles (XYZ order) in radians
   */
  toEuler(): { x: number; y: number; z: number } {
    const sinr_cosp = 2 * (this.w * this.x + this.y * this.z)
    const cosr_cosp = 1 - 2 * (this.x * this.x + this.y * this.y)
    const x = Math.atan2(sinr_cosp, cosr_cosp)

    const sinp = 2 * (this.w * this.y - this.z * this.x)
    let y: number
    if (Math.abs(sinp) >= 1) {
      y = Math.sign(sinp) * Math.PI / 2 // Gimbal lock
    } else {
      y = Math.asin(sinp)
    }

    const siny_cosp = 2 * (this.w * this.z + this.x * this.y)
    const cosy_cosp = 1 - 2 * (this.y * this.y + this.z * this.z)
    const z = Math.atan2(siny_cosp, cosy_cosp)

    return { x, y, z }
  }

  /**
   * Convert to Euler angles in degrees
   */
  toEulerDegrees(): { x: number; y: number; z: number } {
    const euler = this.toEuler()
    const toDeg = 180 / Math.PI
    return {
      x: euler.x * toDeg,
      y: euler.y * toDeg,
      z: euler.z * toDeg
    }
  }

  /**
   * Convert to rotation matrix
   */
  toMatrix4(): Matrix4 {
    const m = Matrix4.identity()
    const e = m.elements

    const x2 = this.x + this.x
    const y2 = this.y + this.y
    const z2 = this.z + this.z

    const xx = this.x * x2
    const xy = this.x * y2
    const xz = this.x * z2
    const yy = this.y * y2
    const yz = this.y * z2
    const zz = this.z * z2
    const wx = this.w * x2
    const wy = this.w * y2
    const wz = this.w * z2

    e[0] = 1 - (yy + zz)
    e[1] = xy + wz
    e[2] = xz - wy
    e[4] = xy - wz
    e[5] = 1 - (xx + zz)
    e[6] = yz + wx
    e[8] = xz + wy
    e[9] = yz - wx
    e[10] = 1 - (xx + yy)

    return m
  }

  toMatrix3(): Matrix3 {
    const m = Matrix3.identity()
    const e = m.elements

    const x2 = this.x + this.x
    const y2 = this.y + this.y
    const z2 = this.z + this.z

    const xx = this.x * x2
    const xy = this.x * y2
    const xz = this.x * z2
    const yy = this.y * y2
    const yz = this.y * z2
    const zz = this.z * z2
    const wx = this.w * x2
    const wy = this.w * y2
    const wz = this.w * z2

    e[0] = 1 - (yy + zz)
    e[1] = xy + wz
    e[2] = xz - wy
    e[3] = xy - wz
    e[4] = 1 - (xx + zz)
    e[5] = yz + wx
    e[6] = xz + wy
    e[7] = yz - wx
    e[8] = 1 - (xx + yy)

    return m
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Angular distance to another quaternion
   */
  angleTo(q: Quaternion): number {
    const dot = Math.abs(this.dot(q))
    return 2 * Math.acos(Math.min(1, dot))
  }

  /**
   * Check if quaternions represent same rotation
   * Note: q and -q represent the same rotation
   */
  equals(q: Quaternion, epsilon: number = 0.00001): boolean {
    return Math.abs(this.dot(q)) > 1 - epsilon
  }

  /**
   * Check if this is the identity rotation
   */
  isIdentity(epsilon: number = 0.00001): boolean {
    return Math.abs(this.w - 1) < epsilon &&
           Math.abs(this.x) < epsilon &&
           Math.abs(this.y) < epsilon &&
           Math.abs(this.z) < epsilon
  }

  /**
   * Exponential map (axis-angle to quaternion)
   * Input is angular velocity vector (axis * angle)
   */
  static exp(v: Vector3): Quaternion {
    const angle = v.magnitude()
    if (angle < 0.00001) {
      return Quaternion.identity()
    }
    const axis = v.scale(1 / angle)
    return Quaternion.fromAxisAngle(axis, angle)
  }

  /**
   * Logarithmic map (quaternion to axis-angle)
   * Returns angular velocity vector
   */
  log(): Vector3 {
    const angle = this.getAngle()
    if (angle < 0.00001) {
      return Vector3.zero()
    }
    return this.getAxis().scale(angle)
  }

  /**
   * Power function: q^t (interpolation along geodesic)
   */
  pow(t: number): Quaternion {
    if (Math.abs(this.w) > 0.9999) {
      return this.clone()
    }
    const angle = Math.acos(this.w)
    const newAngle = angle * t
    const s = Math.sin(newAngle) / Math.sin(angle)
    return new Quaternion(
      this.x * s,
      this.y * s,
      this.z * s,
      Math.cos(newAngle)
    )
  }

  toArray(): [number, number, number, number] {
    return [this.x, this.y, this.z, this.w]
  }

  toString(): string {
    return `Quaternion(${this.x.toFixed(4)}, ${this.y.toFixed(4)}, ${this.z.toFixed(4)}, ${this.w.toFixed(4)})`
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DUAL QUATERNION (for screw motions / rigid body transforms)
// ═══════════════════════════════════════════════════════════════════════════

export class DualQuaternion {
  constructor(
    public real: Quaternion = Quaternion.identity(),
    public dual: Quaternion = new Quaternion(0, 0, 0, 0)
  ) {}

  /**
   * Create from rotation and translation
   */
  static fromRotationTranslation(rotation: Quaternion, translation: Vector3): DualQuaternion {
    const t = new Quaternion(translation.x, translation.y, translation.z, 0)
    const dual = t.multiply(rotation).scale(0.5)
    return new DualQuaternion(rotation.clone(), dual)
  }

  /**
   * Create from screw parameters
   */
  static fromScrew(axis: Vector3, point: Vector3, angle: number, pitch: number): DualQuaternion {
    const d = pitch * angle / 2
    const real = Quaternion.fromAxisAngle(axis, angle)
    
    const moment = point.cross(axis)
    const dualPart = new Quaternion(
      moment.x * Math.sin(angle / 2) + axis.x * d * Math.cos(angle / 2),
      moment.y * Math.sin(angle / 2) + axis.y * d * Math.cos(angle / 2),
      moment.z * Math.sin(angle / 2) + axis.z * d * Math.cos(angle / 2),
      -d * Math.sin(angle / 2)
    )
    
    return new DualQuaternion(real, dualPart)
  }

  clone(): DualQuaternion {
    return new DualQuaternion(this.real.clone(), this.dual.clone())
  }

  multiply(dq: DualQuaternion): DualQuaternion {
    return new DualQuaternion(
      this.real.multiply(dq.real),
      this.real.multiply(dq.dual).add(this.dual.multiply(dq.real))
    )
  }

  conjugate(): DualQuaternion {
    return new DualQuaternion(this.real.conjugate(), this.dual.conjugate())
  }

  normalize(): DualQuaternion {
    const mag = this.real.magnitude()
    if (mag < 0.00001) return this.clone()
    const invMag = 1 / mag
    return new DualQuaternion(
      this.real.scale(invMag),
      this.dual.scale(invMag)
    )
  }

  /**
   * Transform a point using dual quaternion
   */
  transformPoint(v: Vector3): Vector3 {
    const p = new Quaternion(v.x, v.y, v.z, 0)
    const conj = this.conjugate()
    
    // p' = q * p * q̄ + 2 * qd * q̄r
    const rotated = this.real.multiply(p).multiply(conj.real)
    const translated = this.dual.multiply(conj.real).scale(2)
    
    return new Vector3(
      rotated.x + translated.x,
      rotated.y + translated.y,
      rotated.z + translated.z
    )
  }

  /**
   * Extract rotation and translation
   */
  toRotationTranslation(): { rotation: Quaternion; translation: Vector3 } {
    const rotation = this.real.normalize()
    const t = this.dual.scale(2).multiply(rotation.conjugate())
    return {
      rotation,
      translation: new Vector3(t.x, t.y, t.z)
    }
  }

  /**
   * Screw Linear Interpolation
   */
  sclerp(dq: DualQuaternion, t: number): DualQuaternion {
    // Check shortest path
    let q2 = dq.clone()
    if (this.real.dot(q2.real) < 0) {
      q2 = new DualQuaternion(q2.real.scale(-1), q2.dual.scale(-1))
    }

    // Difference
    const diff = this.conjugate().multiply(q2)
    
    // Power
    const powered = diff.pow(t)
    
    return this.multiply(powered)
  }

  /**
   * Power function for dual quaternions
   */
  pow(t: number): DualQuaternion {
    // Extract screw parameters, scale by t, reconstruct
    const realAngle = this.real.getAngle()
    if (Math.abs(realAngle) < 0.00001) {
      // Pure translation
      return new DualQuaternion(
        Quaternion.identity(),
        this.dual.scale(t)
      )
    }

    const axis = this.real.getAxis()
    const { translation } = this.toRotationTranslation()
    const pitch = translation.dot(axis) / realAngle

    return DualQuaternion.fromScrew(axis, Vector3.zero(), realAngle * t, pitch)
  }
}
