/**
 * 4x4 Transformation Matrix for 3D graphics
 * Column-major order (like OpenGL/WebGL)
 * 
 * Matrix layout:
 * | m[0]  m[4]  m[8]   m[12] |   | right.x   up.x   forward.x   tx |
 * | m[1]  m[5]  m[9]   m[13] | = | right.y   up.y   forward.y   ty |
 * | m[2]  m[6]  m[10]  m[14] |   | right.z   up.z   forward.z   tz |
 * | m[3]  m[7]  m[11]  m[15] |   | 0         0      0           1  |
 * 
 * @module math/Matrix4
 */

import { Vector3 } from './Vector3'

export class Matrix4 {
  public elements: Float32Array

  constructor(elements?: ArrayLike<number>) {
    this.elements = new Float32Array(16)
    if (elements) {
      this.elements.set(elements)
    } else {
      this.identity()
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATIC CONSTRUCTORS
  // ═══════════════════════════════════════════════════════════════════════════

  static identity(): Matrix4 {
    const m = new Matrix4()
    return m.identity()
  }

  static zero(): Matrix4 {
    return new Matrix4(new Float32Array(16))
  }

  /**
   * Create perspective projection matrix
   * @param fovY Field of view in Y direction (radians)
   * @param aspect Aspect ratio (width/height)
   * @param near Near clipping plane
   * @param far Far clipping plane
   */
  static perspective(fovY: number, aspect: number, near: number, far: number): Matrix4 {
    const m = new Matrix4()
    const f = 1.0 / Math.tan(fovY / 2)
    const nf = 1 / (near - far)

    m.elements[0] = f / aspect
    m.elements[1] = 0
    m.elements[2] = 0
    m.elements[3] = 0
    m.elements[4] = 0
    m.elements[5] = f
    m.elements[6] = 0
    m.elements[7] = 0
    m.elements[8] = 0
    m.elements[9] = 0
    m.elements[10] = (far + near) * nf
    m.elements[11] = -1
    m.elements[12] = 0
    m.elements[13] = 0
    m.elements[14] = 2 * far * near * nf
    m.elements[15] = 0

    return m
  }

  /**
   * Create orthographic projection matrix
   */
  static orthographic(
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number
  ): Matrix4 {
    const m = new Matrix4()
    const lr = 1 / (left - right)
    const bt = 1 / (bottom - top)
    const nf = 1 / (near - far)

    m.elements[0] = -2 * lr
    m.elements[1] = 0
    m.elements[2] = 0
    m.elements[3] = 0
    m.elements[4] = 0
    m.elements[5] = -2 * bt
    m.elements[6] = 0
    m.elements[7] = 0
    m.elements[8] = 0
    m.elements[9] = 0
    m.elements[10] = 2 * nf
    m.elements[11] = 0
    m.elements[12] = (left + right) * lr
    m.elements[13] = (top + bottom) * bt
    m.elements[14] = (far + near) * nf
    m.elements[15] = 1

    return m
  }

  /**
   * Create look-at view matrix
   * @param eye Camera position
   * @param target Point to look at
   * @param up Up vector
   */
  static lookAt(eye: Vector3, target: Vector3, up: Vector3): Matrix4 {
    const m = new Matrix4()
    
    let zAxis = eye.subtract(target)
    if (zAxis.magnitudeSquared() < 0.00001) {
      zAxis = new Vector3(0, 0, 1)
    } else {
      zAxis = zAxis.normalize()
    }

    let xAxis = up.cross(zAxis)
    if (xAxis.magnitudeSquared() < 0.00001) {
      // up and zAxis are parallel - pick arbitrary perpendicular
      if (Math.abs(up.z) > 0.9999) {
        xAxis = new Vector3(1, 0, 0)
      } else {
        xAxis = new Vector3(0, 0, 1).cross(zAxis).normalize()
      }
    } else {
      xAxis = xAxis.normalize()
    }

    const yAxis = zAxis.cross(xAxis)

    m.elements[0] = xAxis.x
    m.elements[1] = yAxis.x
    m.elements[2] = zAxis.x
    m.elements[3] = 0
    m.elements[4] = xAxis.y
    m.elements[5] = yAxis.y
    m.elements[6] = zAxis.y
    m.elements[7] = 0
    m.elements[8] = xAxis.z
    m.elements[9] = yAxis.z
    m.elements[10] = zAxis.z
    m.elements[11] = 0
    m.elements[12] = -xAxis.dot(eye)
    m.elements[13] = -yAxis.dot(eye)
    m.elements[14] = -zAxis.dot(eye)
    m.elements[15] = 1

    return m
  }

  /**
   * Create translation matrix
   */
  static translation(x: number, y: number, z: number): Matrix4 {
    const m = Matrix4.identity()
    m.elements[12] = x
    m.elements[13] = y
    m.elements[14] = z
    return m
  }

  static translationFromVector(v: Vector3): Matrix4 {
    return Matrix4.translation(v.x, v.y, v.z)
  }

  /**
   * Create scale matrix
   */
  static scale(x: number, y: number, z: number): Matrix4 {
    const m = new Matrix4()
    m.elements[0] = x
    m.elements[5] = y
    m.elements[10] = z
    m.elements[15] = 1
    return m
  }

  static uniformScale(s: number): Matrix4 {
    return Matrix4.scale(s, s, s)
  }

  /**
   * Create rotation matrix around X axis
   */
  static rotationX(angle: number): Matrix4 {
    const m = Matrix4.identity()
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    m.elements[5] = c
    m.elements[6] = s
    m.elements[9] = -s
    m.elements[10] = c
    return m
  }

  /**
   * Create rotation matrix around Y axis
   */
  static rotationY(angle: number): Matrix4 {
    const m = Matrix4.identity()
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    m.elements[0] = c
    m.elements[2] = -s
    m.elements[8] = s
    m.elements[10] = c
    return m
  }

  /**
   * Create rotation matrix around Z axis
   */
  static rotationZ(angle: number): Matrix4 {
    const m = Matrix4.identity()
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    m.elements[0] = c
    m.elements[1] = s
    m.elements[4] = -s
    m.elements[5] = c
    return m
  }

  /**
   * Create rotation matrix around arbitrary axis (Rodrigues' formula)
   */
  static rotationAxis(axis: Vector3, angle: number): Matrix4 {
    const m = new Matrix4()
    const { x, y, z } = axis.normalize()
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    const t = 1 - c

    m.elements[0] = t * x * x + c
    m.elements[1] = t * x * y + s * z
    m.elements[2] = t * x * z - s * y
    m.elements[3] = 0
    m.elements[4] = t * x * y - s * z
    m.elements[5] = t * y * y + c
    m.elements[6] = t * y * z + s * x
    m.elements[7] = 0
    m.elements[8] = t * x * z + s * y
    m.elements[9] = t * y * z - s * x
    m.elements[10] = t * z * z + c
    m.elements[11] = 0
    m.elements[12] = 0
    m.elements[13] = 0
    m.elements[14] = 0
    m.elements[15] = 1

    return m
  }

  /**
   * Create rotation from Euler angles (XYZ order)
   */
  static rotationEuler(x: number, y: number, z: number): Matrix4 {
    return Matrix4.rotationZ(z).multiply(Matrix4.rotationY(y)).multiply(Matrix4.rotationX(x))
  }

  /**
   * Create TRS (Translation-Rotation-Scale) matrix
   */
  static compose(translation: Vector3, rotation: Matrix4, scale: Vector3): Matrix4 {
    const m = rotation.clone()
    // Apply scale to rotation columns
    m.elements[0] *= scale.x
    m.elements[1] *= scale.x
    m.elements[2] *= scale.x
    m.elements[4] *= scale.y
    m.elements[5] *= scale.y
    m.elements[6] *= scale.y
    m.elements[8] *= scale.z
    m.elements[9] *= scale.z
    m.elements[10] *= scale.z
    // Set translation
    m.elements[12] = translation.x
    m.elements[13] = translation.y
    m.elements[14] = translation.z
    return m
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INSTANCE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  identity(): this {
    this.elements.fill(0)
    this.elements[0] = 1
    this.elements[5] = 1
    this.elements[10] = 1
    this.elements[15] = 1
    return this
  }

  clone(): Matrix4 {
    return new Matrix4(this.elements)
  }

  copy(m: Matrix4): this {
    this.elements.set(m.elements)
    return this
  }

  /**
   * Matrix multiplication: this * m
   */
  multiply(m: Matrix4): Matrix4 {
    const result = new Matrix4()
    const a = this.elements
    const b = m.elements
    const r = result.elements

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        r[i * 4 + j] =
          a[j] * b[i * 4] +
          a[j + 4] * b[i * 4 + 1] +
          a[j + 8] * b[i * 4 + 2] +
          a[j + 12] * b[i * 4 + 3]
      }
    }

    return result
  }

  /**
   * Pre-multiply: m * this
   */
  premultiply(m: Matrix4): Matrix4 {
    return m.multiply(this)
  }

  /**
   * Transform a 3D point (applies full transformation including translation)
   */
  transformPoint(v: Vector3): Vector3 {
    const e = this.elements
    const w = 1 / (e[3] * v.x + e[7] * v.y + e[11] * v.z + e[15])
    return new Vector3(
      (e[0] * v.x + e[4] * v.y + e[8] * v.z + e[12]) * w,
      (e[1] * v.x + e[5] * v.y + e[9] * v.z + e[13]) * w,
      (e[2] * v.x + e[6] * v.y + e[10] * v.z + e[14]) * w
    )
  }

  /**
   * Transform a 3D direction (ignores translation)
   */
  transformDirection(v: Vector3): Vector3 {
    const e = this.elements
    return new Vector3(
      e[0] * v.x + e[4] * v.y + e[8] * v.z,
      e[1] * v.x + e[5] * v.y + e[9] * v.z,
      e[2] * v.x + e[6] * v.y + e[10] * v.z
    )
  }

  /**
   * Transform a normal vector (uses inverse transpose)
   */
  transformNormal(v: Vector3): Vector3 {
    const inv = this.inverse()
    if (!inv) return v.clone()
    const e = inv.elements
    // Transpose of inverse for normal transformation
    return new Vector3(
      e[0] * v.x + e[1] * v.y + e[2] * v.z,
      e[4] * v.x + e[5] * v.y + e[6] * v.z,
      e[8] * v.x + e[9] * v.y + e[10] * v.z
    ).normalize()
  }

  /**
   * Transform array of points in-place for performance
   */
  transformPoints(points: Vector3[]): Vector3[] {
    return points.map(p => this.transformPoint(p))
  }

  /**
   * Calculate determinant
   */
  determinant(): number {
    const e = this.elements

    const a00 = e[0], a01 = e[1], a02 = e[2], a03 = e[3]
    const a10 = e[4], a11 = e[5], a12 = e[6], a13 = e[7]
    const a20 = e[8], a21 = e[9], a22 = e[10], a23 = e[11]
    const a30 = e[12], a31 = e[13], a32 = e[14], a33 = e[15]

    const b00 = a00 * a11 - a01 * a10
    const b01 = a00 * a12 - a02 * a10
    const b02 = a00 * a13 - a03 * a10
    const b03 = a01 * a12 - a02 * a11
    const b04 = a01 * a13 - a03 * a11
    const b05 = a02 * a13 - a03 * a12
    const b06 = a20 * a31 - a21 * a30
    const b07 = a20 * a32 - a22 * a30
    const b08 = a20 * a33 - a23 * a30
    const b09 = a21 * a32 - a22 * a31
    const b10 = a21 * a33 - a23 * a31
    const b11 = a22 * a33 - a23 * a32

    return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06
  }

  /**
   * Calculate inverse matrix
   * Returns null if matrix is singular (not invertible)
   */
  inverse(): Matrix4 | null {
    const e = this.elements
    const result = new Matrix4()
    const r = result.elements

    const a00 = e[0], a01 = e[1], a02 = e[2], a03 = e[3]
    const a10 = e[4], a11 = e[5], a12 = e[6], a13 = e[7]
    const a20 = e[8], a21 = e[9], a22 = e[10], a23 = e[11]
    const a30 = e[12], a31 = e[13], a32 = e[14], a33 = e[15]

    const b00 = a00 * a11 - a01 * a10
    const b01 = a00 * a12 - a02 * a10
    const b02 = a00 * a13 - a03 * a10
    const b03 = a01 * a12 - a02 * a11
    const b04 = a01 * a13 - a03 * a11
    const b05 = a02 * a13 - a03 * a12
    const b06 = a20 * a31 - a21 * a30
    const b07 = a20 * a32 - a22 * a30
    const b08 = a20 * a33 - a23 * a30
    const b09 = a21 * a32 - a22 * a31
    const b10 = a21 * a33 - a23 * a31
    const b11 = a22 * a33 - a23 * a32

    const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06

    if (Math.abs(det) < 0.00001) {
      return null // Singular matrix
    }

    const invDet = 1 / det

    r[0] = (a11 * b11 - a12 * b10 + a13 * b09) * invDet
    r[1] = (a02 * b10 - a01 * b11 - a03 * b09) * invDet
    r[2] = (a31 * b05 - a32 * b04 + a33 * b03) * invDet
    r[3] = (a22 * b04 - a21 * b05 - a23 * b03) * invDet
    r[4] = (a12 * b08 - a10 * b11 - a13 * b07) * invDet
    r[5] = (a00 * b11 - a02 * b08 + a03 * b07) * invDet
    r[6] = (a32 * b02 - a30 * b05 - a33 * b01) * invDet
    r[7] = (a20 * b05 - a22 * b02 + a23 * b01) * invDet
    r[8] = (a10 * b10 - a11 * b08 + a13 * b06) * invDet
    r[9] = (a01 * b08 - a00 * b10 - a03 * b06) * invDet
    r[10] = (a30 * b04 - a31 * b02 + a33 * b00) * invDet
    r[11] = (a21 * b02 - a20 * b04 - a23 * b00) * invDet
    r[12] = (a11 * b07 - a10 * b09 - a12 * b06) * invDet
    r[13] = (a00 * b09 - a01 * b07 + a02 * b06) * invDet
    r[14] = (a31 * b01 - a30 * b03 - a32 * b00) * invDet
    r[15] = (a20 * b03 - a21 * b01 + a22 * b00) * invDet

    return result
  }

  /**
   * Calculate transpose
   */
  transpose(): Matrix4 {
    const result = new Matrix4()
    const e = this.elements
    const r = result.elements

    r[0] = e[0]; r[1] = e[4]; r[2] = e[8]; r[3] = e[12]
    r[4] = e[1]; r[5] = e[5]; r[6] = e[9]; r[7] = e[13]
    r[8] = e[2]; r[9] = e[6]; r[10] = e[10]; r[11] = e[14]
    r[12] = e[3]; r[13] = e[7]; r[14] = e[11]; r[15] = e[15]

    return result
  }

  /**
   * Extract translation component
   */
  getTranslation(): Vector3 {
    return new Vector3(this.elements[12], this.elements[13], this.elements[14])
  }

  /**
   * Extract scale component (assumes no shear)
   */
  getScale(): Vector3 {
    const e = this.elements
    return new Vector3(
      Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]),
      Math.sqrt(e[4] * e[4] + e[5] * e[5] + e[6] * e[6]),
      Math.sqrt(e[8] * e[8] + e[9] * e[9] + e[10] * e[10])
    )
  }

  /**
   * Extract rotation as 3x3 matrix (removes scale)
   */
  getRotationMatrix(): Matrix4 {
    const scale = this.getScale()
    const result = this.clone()
    const e = result.elements

    if (scale.x !== 0) {
      e[0] /= scale.x; e[1] /= scale.x; e[2] /= scale.x
    }
    if (scale.y !== 0) {
      e[4] /= scale.y; e[5] /= scale.y; e[6] /= scale.y
    }
    if (scale.z !== 0) {
      e[8] /= scale.z; e[9] /= scale.z; e[10] /= scale.z
    }

    e[12] = 0; e[13] = 0; e[14] = 0

    return result
  }

  /**
   * Decompose into translation, rotation, and scale
   */
  decompose(): { translation: Vector3; rotation: Matrix4; scale: Vector3 } {
    return {
      translation: this.getTranslation(),
      rotation: this.getRotationMatrix(),
      scale: this.getScale()
    }
  }

  /**
   * Linear interpolation between two matrices
   */
  lerp(m: Matrix4, t: number): Matrix4 {
    const result = new Matrix4()
    for (let i = 0; i < 16; i++) {
      result.elements[i] = this.elements[i] + (m.elements[i] - this.elements[i]) * t
    }
    return result
  }

  equals(m: Matrix4, epsilon: number = 0.00001): boolean {
    for (let i = 0; i < 16; i++) {
      if (Math.abs(this.elements[i] - m.elements[i]) > epsilon) {
        return false
      }
    }
    return true
  }

  toArray(): number[] {
    return Array.from(this.elements)
  }

  toString(): string {
    const e = this.elements
    return `Matrix4(
  ${e[0].toFixed(4)}, ${e[4].toFixed(4)}, ${e[8].toFixed(4)}, ${e[12].toFixed(4)}
  ${e[1].toFixed(4)}, ${e[5].toFixed(4)}, ${e[9].toFixed(4)}, ${e[13].toFixed(4)}
  ${e[2].toFixed(4)}, ${e[6].toFixed(4)}, ${e[10].toFixed(4)}, ${e[14].toFixed(4)}
  ${e[3].toFixed(4)}, ${e[7].toFixed(4)}, ${e[11].toFixed(4)}, ${e[15].toFixed(4)}
)`
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3x3 MATRIX (for rotations and normal transforms)
// ═══════════════════════════════════════════════════════════════════════════

export class Matrix3 {
  public elements: Float32Array

  constructor(elements?: ArrayLike<number>) {
    this.elements = new Float32Array(9)
    if (elements) {
      this.elements.set(elements)
    } else {
      this.identity()
    }
  }

  static identity(): Matrix3 {
    const m = new Matrix3()
    return m.identity()
  }

  static fromMatrix4(m: Matrix4): Matrix3 {
    const result = new Matrix3()
    const e = m.elements
    const r = result.elements
    r[0] = e[0]; r[1] = e[1]; r[2] = e[2]
    r[3] = e[4]; r[4] = e[5]; r[5] = e[6]
    r[6] = e[8]; r[7] = e[9]; r[8] = e[10]
    return result
  }

  identity(): this {
    this.elements.fill(0)
    this.elements[0] = 1
    this.elements[4] = 1
    this.elements[8] = 1
    return this
  }

  clone(): Matrix3 {
    return new Matrix3(this.elements)
  }

  multiply(m: Matrix3): Matrix3 {
    const result = new Matrix3()
    const a = this.elements
    const b = m.elements
    const r = result.elements

    r[0] = a[0] * b[0] + a[3] * b[1] + a[6] * b[2]
    r[1] = a[1] * b[0] + a[4] * b[1] + a[7] * b[2]
    r[2] = a[2] * b[0] + a[5] * b[1] + a[8] * b[2]
    r[3] = a[0] * b[3] + a[3] * b[4] + a[6] * b[5]
    r[4] = a[1] * b[3] + a[4] * b[4] + a[7] * b[5]
    r[5] = a[2] * b[3] + a[5] * b[4] + a[8] * b[5]
    r[6] = a[0] * b[6] + a[3] * b[7] + a[6] * b[8]
    r[7] = a[1] * b[6] + a[4] * b[7] + a[7] * b[8]
    r[8] = a[2] * b[6] + a[5] * b[7] + a[8] * b[8]

    return result
  }

  transformVector(v: Vector3): Vector3 {
    const e = this.elements
    return new Vector3(
      e[0] * v.x + e[3] * v.y + e[6] * v.z,
      e[1] * v.x + e[4] * v.y + e[7] * v.z,
      e[2] * v.x + e[5] * v.y + e[8] * v.z
    )
  }

  determinant(): number {
    const e = this.elements
    return (
      e[0] * (e[4] * e[8] - e[5] * e[7]) -
      e[3] * (e[1] * e[8] - e[2] * e[7]) +
      e[6] * (e[1] * e[5] - e[2] * e[4])
    )
  }

  inverse(): Matrix3 | null {
    const det = this.determinant()
    if (Math.abs(det) < 0.00001) return null

    const e = this.elements
    const invDet = 1 / det
    const result = new Matrix3()
    const r = result.elements

    r[0] = (e[4] * e[8] - e[5] * e[7]) * invDet
    r[1] = (e[2] * e[7] - e[1] * e[8]) * invDet
    r[2] = (e[1] * e[5] - e[2] * e[4]) * invDet
    r[3] = (e[5] * e[6] - e[3] * e[8]) * invDet
    r[4] = (e[0] * e[8] - e[2] * e[6]) * invDet
    r[5] = (e[2] * e[3] - e[0] * e[5]) * invDet
    r[6] = (e[3] * e[7] - e[4] * e[6]) * invDet
    r[7] = (e[1] * e[6] - e[0] * e[7]) * invDet
    r[8] = (e[0] * e[4] - e[1] * e[3]) * invDet

    return result
  }

  transpose(): Matrix3 {
    const result = new Matrix3()
    const e = this.elements
    const r = result.elements
    r[0] = e[0]; r[1] = e[3]; r[2] = e[6]
    r[3] = e[1]; r[4] = e[4]; r[5] = e[7]
    r[6] = e[2]; r[7] = e[5]; r[8] = e[8]
    return result
  }
}
